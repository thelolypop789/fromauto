// Admin-only: AI check of ONE reported question. Same GEMINI_KEY secret and the same admin check as prep-import.
// 1) the model answers the question blind; 2) the model judges the reports; the guards in logic.ts downgrade anything
// the blind answer does not support to "human". The review is stored with public.prep_admin_save_report_review and
// returned to the browser, where the admin applies it (public.prep_admin_apply_report_review) or dismisses it.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  BLIND_SCHEMA, JUDGE_SCHEMA, blindPrompt, finalize, judgePrompt, normalizeBlind, parseJson, type Ctx,
} from "./logic.ts";

const GEMINI_KEY = Deno.env.get("GEMINI_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// PREP_REPORT_MODEL (secret) overrides the first model of both chains.
const FIRST = Deno.env.get("PREP_REPORT_MODEL");
const BLIND_MODELS = [FIRST || "gemini-3.5-flash", "gemini-flash-latest", "gemini-3.5-pro"];
const JUDGE_MODELS = [FIRST || "gemini-3.5-pro", "gemini-pro-latest", "gemini-3.5-flash", "gemini-flash-latest"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

class Fatal extends Error { constructor(msg: string, public status = 502) { super(msg); } }

async function ask(models: string[], prompt: string, schema: unknown, temperature: number): Promise<{ data: Record<string, unknown>; model: string }> {
  const payload = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens: 16000, responseMimeType: "application/json", responseSchema: schema },
  });
  let lastError = "";
  for (const model of models) {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY }, body: payload,
      });
    } catch (e) { lastError = `${model}: ${(e as Error).message}`; continue; }
    const data = await res.json().catch(() => ({}));
    if (data.error) {
      const msg = String(data.error.message ?? "");
      lastError = `${model}: ${msg || JSON.stringify(data.error)}`;
      if (/spending cap|billing|API key not valid|API_KEY_INVALID|PERMISSION_DENIED|has been suspended/i.test(msg) || data.error.code === 403) {
        throw new Fatal(/spending cap/i.test(msg)
          ? "โปรเจกต์ Gemini ใช้เงินถึงวงเงินรายเดือนแล้ว"
          : "คีย์ Gemini ใช้งานไม่ได้ (คีย์ผิด ถูกระงับ หรือยังไม่เปิด billing) — ตรวจ GEMINI_KEY ใน Supabase", 402);
      }
      const unknownModel = data.error.code === 400 && /models\/|not found|not supported/i.test(msg);
      if ([404, 429, 500, 503].includes(data.error.code) || unknownModel) continue;
      throw new Fatal("Gemini: " + lastError);
    }
    const cand = data.candidates?.[0];
    const text = (cand?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    if (!text) { lastError = `${model}: ${cand?.finishReason ?? "ไม่มีผลลัพธ์"}`; continue; }
    try { return { data: parseJson(text), model }; }
    catch (e) { lastError = `${model}: ${(e as Error).message}`; continue; }
  }
  throw new Fatal("AI ไม่ตอบ: " + lastError);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "กรุณาเข้าสู่ระบบ" }, 401);
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: isAdmin, error: adminErr } = await sb.rpc("prep_admin_check");
    if (adminErr || isAdmin !== true) return json({ error: "ไม่มีสิทธิ์แอดมิน" }, 403);

    const body = await req.json().catch(() => ({}));
    const id = Number(body.question_id);
    if (!Number.isInteger(id) || id <= 0) return json({ error: "ไม่พบเลขข้อสอบ" }, 400);

    const { data: ctx, error: ctxErr } = await sb.rpc("prep_admin_report_context", { p_question: id });
    if (ctxErr) return json({ error: ctxErr.message === "not_found" ? "ไม่พบข้อสอบนี้" : "อ่านข้อสอบไม่ได้: " + ctxErr.message }, 404);
    const c = ctx as Ctx;
    if (!c.reports?.length) return json({ error: "ข้อนี้ไม่มีรายงานที่รอตรวจ" }, 409);

    const blindRes = await ask(BLIND_MODELS, blindPrompt(c), BLIND_SCHEMA, 0);
    const blind = normalizeBlind(blindRes.data);
    const judgeRes = await ask(JUDGE_MODELS, judgePrompt(c, blind), JUDGE_SCHEMA, 0.2);
    const review = finalize(c, blind, judgeRes.data);

    const { data: reviewId, error: saveErr } = await sb.rpc("prep_admin_save_report_review", {
      p_question: id,
      p_review: {
        verdict: review.verdict, confidence: review.confidence, analysis: review.analysis, fix: review.fix,
        user_message: review.user_message, blind_answer: review.blind_answer, model: judgeRes.model,
      },
    });
    if (saveErr) {
      return json({ error: saveErr.message === "no_open_reports" ? "ข้อนี้ไม่มีรายงานที่รอตรวจแล้ว" : "บันทึกผลไม่สำเร็จ: " + saveErr.message }, 409);
    }
    return json({ review_id: reviewId, review, model: judgeRes.model });
  } catch (e) {
    if (e instanceof Fatal) return json({ error: e.message, fatal: e.status === 402 }, e.status);
    return json({ error: "เกิดข้อผิดพลาด: " + ((e as Error).message ?? String(e)) }, 500);
  }
});
