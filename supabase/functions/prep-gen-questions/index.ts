// Writes new questions for one major sub-topic (prep.subtopics) with Gemini or DeepSeek (admin switch, _shared/deepseek.ts), then has a second, stronger model answer
// them blind; only questions where it picks the same answer and calls them sound are saved (approved, labelled).
// Callers: pg_cron via prep.gen_tick() with header x-cron-secret (checked in the database), or an admin JWT.
// Body: { subtopic: "B3-HEALTH-BODY", count?: number }. Work and writes go through service_role RPCs only.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  GENERATE_SCHEMA, VERIFY_SCHEMA, accept, cleanDraft, generatePrompt, parseJson, shuffleChoices, verifyPrompt,
  type Draft, type Verdict, type Work,
} from "./logic.ts";
import { DEEPSEEK_FAST, DEEPSEEK_STRONG, aiProvider, deepseekJson } from "../_shared/deepseek.ts";

const GEMINI_KEY = Deno.env.get("GEMINI_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEN_MODELS = [Deno.env.get("PREP_GEN_MODEL") || "gemini-3.5-flash", "gemini-flash-latest", "gemini-pro-latest"];
const VERIFY_MODELS = [Deno.env.get("PREP_VERIFY_MODEL") || "gemini-pro-latest", "gemini-3.5-flash", "gemini-flash-latest"];
const BATCH = 10;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function ask(models: string[], prompt: string, schema: unknown, temperature: number): Promise<{ data: Record<string, unknown>; model: string }> {
  const payload = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens: 16000, responseMimeType: "application/json", responseSchema: schema },
  });
  let last = "";
  const tried: string[] = [];
  for (const model of models) {
    // Overload (429/503) usually clears within seconds: one more try on the same model before moving on.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY }, body: payload,
        });
        const data = await res.json().catch(() => ({}));
        if (data.error) {
          last = `${model}: ${data.error.message ?? data.error.code}`;
          if (data.error.code === 403 || /spending cap|billing|API key not valid/i.test(String(data.error.message))) throw new Error(last);
          if ([429, 503].includes(data.error.code) && attempt === 0) { await new Promise(r => setTimeout(r, 4000)); continue; }
          tried.push(last.slice(0, 120));
          break;
        }
        const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
        if (!text) { last = `${model}: ${data.candidates?.[0]?.finishReason ?? "ไม่มีผลลัพธ์"}`; tried.push(last); break; }
        return { data: parseJson(text), model };
      } catch (e) {
        last = `${model}: ${(e as Error).message}`;
        if (/spending cap|billing|API key not valid|403/i.test(last)) throw new Error(last);
        tried.push(last.slice(0, 120));
        break;
      }
    }
  }
  throw new Error("AI ไม่ตอบ: " + tried.join(" | "));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const started = Date.now();
  const svc = createClient(SUPABASE_URL, SERVICE_KEY);
  try {
    const cron = req.headers.get("x-cron-secret");
    if (cron) {
      const { data } = await svc.rpc("prep_subtopic_secret_ok", { p_secret: cron });
      if (data !== true) return json({ error: "forbidden" }, 403);
    } else {
      const auth = req.headers.get("Authorization") ?? "";
      const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
      const { data: isAdmin } = await sb.rpc("prep_admin_check");
      if (isAdmin !== true) return json({ error: "ไม่มีสิทธิ์แอดมิน" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const sub = typeof body.subtopic === "string" ? body.subtopic : "";
    if (!sub) return json({ error: "ไม่ระบุหมวดย่อย" }, 400);
    const { data: w, error: wErr } = await svc.rpc("prep_gen_work", { p_subtopic: sub, p_force: body.force === true });
    if (wErr) throw new Error(wErr.message);
    const work = w as Work | null;
    if (!work || work.need <= 0) return json({ ok: true, subtopic: sub, saved: 0, skipped: "ไม่ต้องสร้างเพิ่ม" });

    const count = Math.max(1, Math.min(Number(body.count) || BATCH, BATCH, work.need));
    // DeepSeek: Flash writes, Pro (thinking) checks, so the checker is still a different, stronger model.
    const ds = (await aiProvider(svc)) === "deepseek";
    const gen = ds
      ? await deepseekJson(DEEPSEEK_FAST, generatePrompt(work, count), GENERATE_SCHEMA, { temperature: 0.8, timeoutMs: 60_000 })
      : await ask(GEN_MODELS, generatePrompt(work, count), GENERATE_SCHEMA, 0.8);
    const dropped: string[] = [];
    const drafts: Draft[] = [];
    for (const raw of (gen.data.questions as unknown[]) ?? []) {
      const r = cleanDraft(raw);
      if (r.d) drafts.push(r.d); else dropped.push(r.drop!);
    }
    if (!drafts.length) return json({ ok: true, subtopic: sub, saved: 0, dropped, model: gen.model });

    const ver = ds
      ? await deepseekJson(DEEPSEEK_STRONG, verifyPrompt(work, drafts), VERIFY_SCHEMA, { thinking: true, timeoutMs: 80_000 })
      : await ask(VERIFY_MODELS, verifyPrompt(work, drafts), VERIFY_SCHEMA, 0);
    const { kept, rejected } = accept(drafts, ((ver.data.results as Verdict[]) ?? []).filter(v => Number.isInteger(v?.id)));
    const items = kept.map(d => shuffleChoices(d)).map(d => ({ level: d.level, stem: d.stem, choices: d.choices, answer: d.answer, explanation: d.explanation }));
    let saved = 0;
    if (items.length) {
      const { data: s, error: sErr } = await svc.rpc("prep_gen_save", {
        p_subtopic: sub, p_items: items, p_source: `gen:${gen.model}|check:${ver.model}`,
      });
      if (sErr) throw new Error(sErr.message);
      saved = Number(s) || 0;
    }
    return json({ ok: true, subtopic: sub, asked: count, drafted: drafts.length, checked_ok: kept.length, saved, dropped, rejected,
                  gen_model: gen.model, check_model: ver.model, ms: Date.now() - started });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
