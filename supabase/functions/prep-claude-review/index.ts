// Admin-only: "ตรวจด้วย Claude" for up to 10 questions per call (แอดมิน → ข้อสอบรอตรวจ).
// Body: { ids: number[] }. Reads the questions and saves the verdicts through admin RPCs called with the admin's own
// token, so the function holds no database privilege of its own. Needs the ANTHROPIC_API_KEY secret.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.137.0";
import { SCHEMA, SYSTEM, normalize, userPrompt, type Q } from "./logic.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const MODEL = "claude-opus-5-5";
const MAX_IDS = 10;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "กรุณาเข้าสู่ระบบ" }, 401);
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: isAdmin, error: adminErr } = await sb.rpc("prep_admin_check");
  if (adminErr || isAdmin !== true) return json({ error: "ไม่มีสิทธิ์แอดมิน" }, 403);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY ใน Supabase (Edge Functions → Secrets)" }, 503);

  const body = await req.json().catch(() => ({}));
  const ids = (Array.isArray(body.ids) ? body.ids : []).map(Number).filter(Number.isInteger).slice(0, MAX_IDS);
  if (!ids.length) return json({ error: "ไม่มีข้อที่จะตรวจ" }, 400);

  const { data: qs, error: pickErr } = await sb.rpc("prep_admin_claude_pick", { p_ids: ids });
  if (pickErr) return json({ error: pickErr.message }, 500);
  const questions = (qs ?? []) as Q[];
  if (!questions.length) return json({ ok: true, results: [], saved: 0 });

  const client = new Anthropic({ apiKey });
  let message;
  try {
    // Streaming keeps a long thinking turn clear of HTTP timeouts. fallbacks "default": if a safety classifier
    // declines, the API re-runs the request on Anthropic's recommended model instead of returning a refusal.
    message = await client.beta.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt(questions) }],
    } as never).finalMessage();
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "ANTHROPIC_API_KEY ใช้งานไม่ได้ (คีย์ผิดหรือถูกยกเลิก)" }, 502);
    if (e instanceof Anthropic.PermissionDeniedError) return json({ error: "คีย์ Claude ไม่มีสิทธิ์ใช้โมเดลนี้ หรือเครดิตหมด" }, 502);
    if (e instanceof Anthropic.RateLimitError) return json({ error: "Claude ใช้งานถี่เกินไป ลองใหม่อีกครั้งในอีกสักครู่" }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `Claude: ${e.status ?? ""} ${e.message}` }, 502);
    return json({ error: `ติดต่อ Claude ไม่ได้: ${(e as Error).message}` }, 502);
  }

  if (message.stop_reason === "refusal") return json({ error: "Claude ปฏิเสธการตรวจชุดนี้ ลองตรวจทีละข้อ" }, 422);
  if (message.stop_reason === "max_tokens") return json({ error: "คำตอบของ Claude ยาวเกิน ลองตรวจทีละน้อยข้อลง" }, 422);
  const text = message.content.map((b: { type: string; text?: string }) => (b.type === "text" ? b.text ?? "" : "")).join("");
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return json({ error: "อ่านผลจาก Claude ไม่ได้" }, 502); }
  const results = normalize(questions, parsed);

  const { data: saved, error: saveErr } = await sb.rpc("prep_admin_claude_save", { p_items: results, p_model: message.model });
  if (saveErr) return json({ error: saveErr.message }, 500);
  return json({ ok: true, model: message.model, saved, results, usage: message.usage });
});
