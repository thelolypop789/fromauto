// SOBPREP chat bot: one function, three ways in (deployed with --no-verify-jwt; each way checks its own caller).
//   * LINE webhook (LINE @701pvghq): trusted only when x-line-signature matches LINE_CHANNEL_SECRET. A text that is one
//     of the preset keywords gets the preset reply (logic.ts, same texts as LINE OA Manager); any other text is
//     answered by Gemini from the facts in systemPrompt() plus the session so far; a picture (usually a slip) gets
//     SLIP_TEXT (slips are accepted in the app only). Typing แอดมิน hands the chat to a human: the bot stays quiet for
//     that customer until 2 hours pass without a message (prep_line_session). Only 1:1 chats are answered.
//     A burst of messages gets one answer: each message is queued (prep_line_pending), LINE gets its 200 at once, and
//     after PREP_LINE_DEBOUNCE_S (default 8) the newest message of the burst answers them all (planBurst).
//   * action "chat" / "history" from the app (user JWT): the in-app chat. Same facts, plus the signed-in customer's
//     own plan, orders and readiness read with their token; a human is reached through LINE. APP_DAILY_LIMIT a day.
//   * action "summarize" {day}: pg_cron (x-cron-secret, prep_chat_secret_ok) or an admin (JWT) writes the AI summary of
//     one Bangkok day of chats (prep_chat_day → prep_chat_summary_save), shown in แอดมิน → ผู้ใช้ → แชทลูกค้า.
// Every message of both channels is logged (prep.chat_log, 90 days). Secrets: LINE_CHANNEL_SECRET,
// LINE_CHANNEL_ACCESS_TOKEN, GEMINI_KEY (shared); optional PREP_LINE_MODEL (default gemini-flash-latest) and
// PREP_SUMMARY_MODEL (default gemini-pro-latest).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  APP_ADMIN_TEXT, APP_DAILY_LIMIT, APP_LIMIT_TEXT, DEFAULT_TEXT, FALLBACK_PRICES, PRESETS, SLIP_TEXT, WELCOME_TEXT, aiMessages,
  appSystemPrompt, cleanReply, matchPreset, planBurst, signatureOk, summaryPrompt, systemPrompt,
  type AppContext, type DayData, type Pending, type Price, type Turn,
} from "./logic.ts";

const SECRET = (Deno.env.get("LINE_CHANNEL_SECRET") ?? "").trim(); // trim: a pasted secret often ends with a newline
const TOKEN = (Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "").trim();
const GEMINI_KEY = Deno.env.get("GEMINI_KEY") ?? "";
const MODEL = Deno.env.get("PREP_LINE_MODEL") || "gemini-flash-latest";
const SUMMARY_MODEL = Deno.env.get("PREP_SUMMARY_MODEL") || "gemini-pro-latest";
// LINE: wait this long after a message for the customer to finish typing; answer a burst at most BURST_MAX_S after its start.
const DEBOUNCE_S = Math.min(20, Math.max(0, Number(Deno.env.get("PREP_LINE_DEBOUNCE_S") ?? 8) || 0));
const BURST_MAX_S = 25;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

let client: ReturnType<typeof createClient> | null = null;
const sb = () => client ??= createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// prep.prices changes rarely; keep it for 10 minutes per warm instance.
let priceCache: { at: number; prices: Price[] } | null = null;
async function prices(): Promise<Price[]> {
  if (priceCache && Date.now() - priceCache.at < 600_000) return priceCache.prices;
  try {
    const { data, error } = await sb().rpc("prep_prices");
    if (error || !Array.isArray(data) || !data.length) throw new Error(error?.message ?? "no prices");
    priceCache = { at: Date.now(), prices: data as Price[] };
  } catch (e) {
    console.error("prep_prices:", (e as Error).message);
    return priceCache?.prices ?? FALLBACK_PRICES;
  }
  return priceCache.prices;
}

async function hmacB64(body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return btoa(String.fromCharCode(...sig));
}

// Gemini through its OpenAI-compatible endpoint (same as prep-ai-review). One try: a LINE reply token lasts about a
// minute and a customer is waiting, so on any failure the caller answers DEFAULT_TEXT instead.
async function gemini(messages: { role: string; content: string }[], opts: { model?: string; timeout?: number; effort?: string; max?: number } = {}): Promise<string> {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GEMINI_KEY}` },
    body: JSON.stringify({ model: opts.model ?? MODEL, stream: false, max_tokens: opts.max ?? 2000, reasoning_effort: opts.effort ?? "low", messages }),
    signal: AbortSignal.timeout(opts.timeout ?? 25_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${data?.error?.message ?? res.statusText}`);
  const out = cleanReply(data?.choices?.[0]?.message?.content);
  if (!out) throw new Error("Gemini ตอบว่าง");
  return out;
}

// ---------- LINE ----------

async function reply(replyToken: string, text: string) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
  if (!res.ok) console.error("LINE reply", res.status, await res.text());
}

// The account's read mode is manual, so a chat stays "unread" in OA Manager until this is called. Called only after
// the bot answered; a chat handed to an admin stays unread so the admin notices it.
async function markRead(userId: string) {
  const res = await fetch("https://api.line.me/v2/bot/chat/markAsRead", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ chat: { userId } }),
  });
  if (!res.ok) console.error("LINE markAsRead", res.status, await res.text());
}

type LineEvent = {
  type: string; replyToken?: string; source?: { type: string; userId?: string };
  message?: { type: string; text?: string };
};

// Session store (migration prep_line_bot_sessions). If the database is down the bot still answers, just without
// memory, and a hand-off cannot be seen: better a reply than silence.
async function loadSession(user: string): Promise<{ history: Turn[]; handoff: boolean }> {
  const { data, error } = await sb().rpc("prep_line_session", { p_user: user });
  if (error || !data) { console.error("prep_line_session:", error?.message); return { history: [], handoff: false }; }
  return { history: data.history ?? [], handoff: data.handoff === true };
}

async function saveSession(user: string, turns: (Turn & { src?: string })[], handoff: boolean) {
  const { error } = await sb().rpc("prep_line_session_save", { p_user: user, p_turns: turns, p_handoff: handoff });
  if (error) console.error("prep_line_session_save:", error.message);
}

// Shows LINE's "…" typing animation in the 1:1 chat while the bot waits for the burst to end and thinks. It
// disappears by itself when the reply arrives (or after `seconds`).
async function showTyping(userId: string, seconds = 30) {
  const res = await fetch("https://api.line.me/v2/bot/chat/loading/start", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ chatId: userId, loadingSeconds: seconds }),
  });
  if (!res.ok) console.error("LINE loading", res.status, await res.text());
}

// Edge runtime: keep working after the 200 has gone back to LINE (the burst wait happens here).
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
const later = (p: Promise<unknown>) => {
  const safe = p.catch(e => console.error("background:", (e as Error).message));
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(safe);
};

// After the wait: the newest message of the burst takes the queue (prep_line_pending_take) and answers it once,
// with the newest reply token.
async function answerBurst(user: string, id: number) {
  await new Promise(r => setTimeout(r, DEBOUNCE_S * 1000));
  const { data, error } = await sb().rpc("prep_line_pending_take", { p_user: user, p_id: id, p_max_s: BURST_MAX_S });
  if (error) { console.error("prep_line_pending_take:", error.message); return; }
  const rows = (data ?? []) as (Pending & { reply_token: string })[];
  if (!rows.length) return; // a newer message of this burst answers
  const plan = planBurst(rows);
  const userTurns = plan.said.map(t => ({ role: "user" as const, content: t }));

  const session = await loadSession(user);
  if (session.handoff) { await saveSession(user, userTurns, false); return; } // an admin has this chat: log only

  let out: string, src: string;
  if (plan.type === "slip") { out = SLIP_TEXT; src = "slip"; }
  else if (plan.type === "preset") { out = PRESETS.find(p => p.id === plan.id)!.text(await prices()); src = `preset:${plan.id}`; }
  else if (!GEMINI_KEY) { out = DEFAULT_TEXT; src = "fallback"; }
  else {
    try { out = await gemini(aiMessages(systemPrompt(await prices()), session.history, plan.question)); src = "ai"; }
    catch (e) { console.error("AI:", (e as Error).message); out = DEFAULT_TEXT; src = "fallback"; }
  }
  const handoff = src === "preset:admin";
  await reply(rows[rows.length - 1].reply_token, out);
  if (!handoff) await markRead(user);
  await saveSession(user, [...userTurns, { role: "assistant", content: out, src }], handoff);
}

async function handle(ev: LineEvent) {
  const user = ev.source?.userId;
  if (ev.source?.type !== "user" || !user || !ev.replyToken) return; // groups / rooms: stay out
  if (ev.type === "follow") return reply(ev.replyToken, WELCOME_TEXT);
  if (ev.type !== "message" || !ev.message) return;
  const kind = ev.message.type;
  const text = kind === "text" ? (ev.message.text ?? "").trim() : "";
  const media = kind === "image" || kind === "file";
  if (!media && !text) return; // stickers etc.: stay quiet
  const { data: id, error } = await sb().rpc("prep_line_pending_add", { p_user: user, p_kind: media ? "media" : "text", p_text: text, p_token: ev.replyToken });
  if (error || id == null) { console.error("prep_line_pending_add:", error?.message); return; }
  if (!(await loadSession(user)).handoff) await showTyping(user);
  later(answerBurst(user, Number(id)));
}

async function lineWebhook(req: Request): Promise<Response> {
  if (!SECRET || !TOKEN) return new Response("LINE secrets not set", { status: 503 });
  const body = await req.text();
  if (!signatureOk(await hmacB64(body), req.headers.get("x-line-signature"))) return new Response("bad signature", { status: 401 });
  const { events = [] } = JSON.parse(body) as { events?: LineEvent[] };
  // Queue in order (one customer's messages share a burst); the answers happen in the background.
  for (const ev of events) {
    try { await handle(ev); } catch (e) { console.error("event:", (e as Error).message); }
  }
  return new Response("ok");
}

// ---------- in-app chat ----------

// The customer's own data, read with their token (RLS / prep.uid() apply). A failed read just leaves that part out.
async function appContext(auth: string, email: string | undefined): Promise<AppContext> {
  const u = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const get = async (fn: string) => { const { data, error } = await u.rpc(fn); if (error) console.error(fn, error.message); return error ? null : data; };
  const [me, orders, readiness] = await Promise.all([get("prep_me"), get("prep_my_orders"), get("prep_readiness")]);
  return { email, me, orders, readiness };
}

async function appChat(auth: string, body: { action: string; message?: unknown }): Promise<Response> {
  const u = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: who, error: authErr } = await u.auth.getUser();
  if (authErr || !who?.user) return json({ error: "กรุณาเข้าสู่ระบบ" }, 401);
  const uid = who.user.id;
  const { data: s, error } = await sb().rpc("prep_app_chat_session", { p_user: uid });
  if (error) console.error("prep_app_chat_session:", error.message);
  const history: Turn[] = s?.history ?? [];
  if (body.action === "history") {
    return json({ history: history.map(t => ({ role: t.role, content: t.content })), left: Math.max(0, APP_DAILY_LIMIT - (s?.used_today ?? 0)) });
  }
  const text = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  if (!text) return json({ error: "ข้อความว่าง" }, 400);

  let out: string, src: string, handoff = false;
  if ((s?.used_today ?? 0) >= APP_DAILY_LIMIT) {
    out = APP_LIMIT_TEXT; src = "limit"; handoff = true;
  } else if (matchPreset(text)?.id === "admin") {
    out = APP_ADMIN_TEXT; src = "handoff"; handoff = true;
  } else if (!GEMINI_KEY) {
    out = DEFAULT_TEXT; src = "fallback";
  } else {
    try {
      const [p, c] = await Promise.all([prices(), appContext(auth, who.user.email)]);
      out = await gemini(aiMessages(appSystemPrompt(p, c), history, text), { timeout: 40_000 }); src = "ai";
    } catch (e) { console.error("AI:", (e as Error).message); out = DEFAULT_TEXT; src = "fallback"; }
  }
  if (src === "fallback") handoff = true;
  const { error: saveErr } = await sb().rpc("prep_app_chat_save", { p_user: uid, p_turns: [{ role: "user", content: text }, { role: "assistant", content: out, src }] });
  if (saveErr) console.error("prep_app_chat_save:", saveErr.message);
  return json({ reply: out, handoff, left: Math.max(0, APP_DAILY_LIMIT - (s?.used_today ?? 0) - 1) });
}

// ---------- daily summary ----------

const bangkokYesterday = () => new Date(Date.now() + 7 * 3600_000 - 86400_000).toISOString().slice(0, 10);

async function summarize(dayIn: unknown): Promise<Response> {
  const day = typeof dayIn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dayIn) ? dayIn : bangkokYesterday();
  const { data, error } = await sb().rpc("prep_chat_day", { p_day: day });
  if (error) return json({ error: "อ่านแชทไม่ได้: " + error.message }, 500);
  const d = data as DayData;
  let summary: string, model: string | null = null;
  if (!d.conversations.length) summary = "ไม่มีแชทในวันนี้";
  else if (!GEMINI_KEY) return json({ error: "ยังไม่ได้ตั้งค่า GEMINI_KEY" }, 503);
  else {
    try {
      summary = await gemini([{ role: "user", content: summaryPrompt(day, d) }], { model: SUMMARY_MODEL, timeout: 100_000, effort: "medium", max: 8000 });
      model = SUMMARY_MODEL;
    } catch (e) { return json({ error: "AI สรุปไม่สำเร็จ: " + (e as Error).message }, 502); }
  }
  const { error: e2 } = await sb().rpc("prep_chat_summary_save", { p_day: day, p_summary: summary, p_stats: d.stats, p_model: model });
  if (e2) return json({ error: "บันทึกสรุปไม่ได้: " + e2.message }, 500);
  return json({ ok: true, day, summary, stats: d.stats });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("ok");
  if (req.headers.has("x-line-signature")) return lineWebhook(req);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    if (action === "summarize") {
      const cron = req.headers.get("x-cron-secret");
      if (cron) {
        const { data } = await sb().rpc("prep_chat_secret_ok", { p_secret: cron });
        if (data !== true) return json({ error: "forbidden" }, 403);
      } else {
        const auth = req.headers.get("Authorization") ?? "";
        const u = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
        const { data: isAdmin, error } = await u.rpc("prep_admin_check");
        if (error || isAdmin !== true) return json({ error: "ไม่มีสิทธิ์แอดมิน" }, 403);
      }
      return await summarize(body.day);
    }
    if (action === "chat" || action === "history") {
      const auth = req.headers.get("Authorization") ?? "";
      if (!auth.startsWith("Bearer ")) return json({ error: "กรุณาเข้าสู่ระบบ" }, 401);
      return await appChat(auth, body);
    }
    return new Response("bad signature", { status: 401 }); // not LINE (no signature) and no known action
  } catch (e) {
    return json({ error: "เกิดข้อผิดพลาด: " + ((e as Error).message ?? String(e)) }, 500);
  }
});
