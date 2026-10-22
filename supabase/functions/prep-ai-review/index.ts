// Admin-only: "ตรวจด้วย AI" for up to 5 questions per call (แอดมิน → ข้อสอบรอตรวจ). Two cheap models instead of one
// expensive one: DeepSeek and Qwen answer blind, then DeepSeek judges with the key (rules in logic.ts).
// Body: { ids: number[] }. Questions are read and verdicts saved through admin RPCs called with the admin's own token.
// Secrets: DEEPSEEK_API_KEY, QWEN_API_KEY (Alibaba Cloud Model Studio, International). Optional: DEEPSEEK_MODEL,
// QWEN_MODEL, QWEN_BASE_URL. With only one key the review still runs, but can never reach high confidence.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  BLIND_SYSTEM, JUDGE_SYSTEM, blindPrompt, combine, costUSD, judgePrompt, parseJson, readBlind, readJudge, type Blind, type Q,
} from "./logic.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const MAX_IDS = 5;

type Provider = { name: string; url: string; key: string; model: string; extra: Record<string, unknown> };
function providers(): Provider[] {
  const out: Provider[] = [];
  const ds = Deno.env.get("DEEPSEEK_API_KEY");
  if (ds) out.push({ name: "DeepSeek", url: "https://api.deepseek.com/chat/completions", key: ds,
    model: Deno.env.get("DEEPSEEK_MODEL") || "deepseek-v4-pro", extra: { thinking: { type: "enabled" }, reasoning_effort: "high" } });
  const qw = Deno.env.get("QWEN_API_KEY");
  if (qw) out.push({ name: "Qwen", url: `${(Deno.env.get("QWEN_BASE_URL") || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1").replace(/\/$/, "")}/chat/completions`,
    key: qw, model: Deno.env.get("QWEN_MODEL") || "qwen3.7-plus", extra: { enable_thinking: true } });
  return out;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

class Fatal extends Error {}

// OpenAI-compatible chat call. Retries once on 429/5xx/timeouts and once more if the reply is not valid JSON.
async function ask(p: Provider, system: string, user: string, spend: { usd: number }): Promise<unknown> {
  let last = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(p.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
        body: JSON.stringify({ model: p.model, stream: false, max_tokens: 32000, ...p.extra,
          messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
        signal: AbortSignal.timeout(110_000),
      });
    } catch (e) { last = `${p.name}: ${(e as Error).message}`; continue; }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = String(data?.error?.message ?? data?.message ?? res.statusText);
      if (res.status === 401 || res.status === 403) throw new Fatal(`${p.name}: คีย์ใช้งานไม่ได้ (${msg})`);
      if (res.status === 402 || /insufficient|balance|quota|arrearage/i.test(msg)) throw new Fatal(`${p.name}: เครดิตหมดหรือเกินโควตา (${msg})`);
      last = `${p.name}: ${res.status} ${msg}`;
      if (res.status === 429 || res.status >= 500) continue;
      throw new Fatal(last);
    }
    spend.usd += costUSD(p.model, data.usage, new Date());
    const text = String(data?.choices?.[0]?.message?.content ?? "");
    try { return parseJson(text); } catch { last = `${p.name}: ตอบไม่เป็น JSON`; }
  }
  throw new Error(last || `${p.name}: ไม่ตอบ`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "กรุณาเข้าสู่ระบบ" }, 401);
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: isAdmin, error: adminErr } = await sb.rpc("prep_admin_check");
  if (adminErr || isAdmin !== true) return json({ error: "ไม่มีสิทธิ์แอดมิน" }, 403);

  const ps = providers();
  if (!ps.length) return json({ error: "ยังไม่ได้ตั้งค่า DEEPSEEK_API_KEY หรือ QWEN_API_KEY ใน Supabase (Edge Functions → Secrets)" }, 503);

  const body = await req.json().catch(() => ({}));
  const ids = (Array.isArray(body.ids) ? body.ids : []).map(Number).filter(Number.isInteger).slice(0, MAX_IDS);
  if (!ids.length) return json({ error: "ไม่มีข้อที่จะตรวจ" }, 400);
  const { data: qs, error: pickErr } = await sb.rpc("prep_admin_ai_pick", { p_ids: ids });
  if (pickErr) return json({ error: pickErr.message }, 500);
  const questions = (qs ?? []) as Q[];
  if (!questions.length) return json({ ok: true, results: [], saved: 0 });

  const spend = { usd: 0 };
  try {
    // 1) blind answers, both models in parallel. A model that fails is reported as "did not answer".
    const blindRaw = await Promise.allSettled(ps.map(p => ask(p, BLIND_SYSTEM, blindPrompt(questions), spend)));
    const fatal = blindRaw.find(r => r.status === "rejected" && r.reason instanceof Fatal) as PromiseRejectedResult | undefined;
    if (fatal) return json({ error: (fatal.reason as Error).message }, 502);
    const blind: Record<string, Map<number, Blind>> = {};
    ps.forEach((p, i) => { const r = blindRaw[i]; blind[p.name] = r.status === "fulfilled" ? readBlind(questions, r.value) : new Map(); });

    // 2) judge with the key: DeepSeek when available, otherwise Qwen.
    const judgeRaw = await ask(ps[0], JUDGE_SYSTEM, judgePrompt(questions, blind), spend);
    const judges = readJudge(questions, judgeRaw);

    const results = questions.map(q => combine(q, Object.fromEntries(ps.map(p => [p.name, blind[p.name].get(q.id)])), judges.get(q.id)));
    const model = ps.map(p => p.model).join(" + ");
    const { data: saved, error: saveErr } = await sb.rpc("prep_admin_ai_save", { p_items: results, p_model: model });
    if (saveErr) return json({ error: saveErr.message }, 500);
    return json({ ok: true, model, saved, results, cost_usd: Math.round(spend.usd * 10000) / 10000 });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
});
