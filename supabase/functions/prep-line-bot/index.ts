// LINE OA chat bot (LINE @701pvghq). LINE posts every event here (webhook, so deploy with --no-verify-jwt);
// the request is trusted only when its x-line-signature matches LINE_CHANNEL_SECRET.
// A text that is one of the preset keywords gets the preset reply (logic.ts, same texts as LINE OA Manager);
// any other text is answered by Gemini from the facts in systemPrompt() plus the session so far; a picture
// (usually a slip) gets SLIP_TEXT (slips are accepted in the app only). Typing แอดมิน hands the chat to a human:
// the bot stays quiet for that customer until 2 hours pass without a message (prep_line_session).
// Only 1:1 chats are answered. Secrets: LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, GEMINI_KEY (shared);
// optional PREP_LINE_MODEL (default gemini-flash-latest).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  DEFAULT_TEXT, FALLBACK_PRICES, SLIP_TEXT, WELCOME_TEXT, aiMessages, cleanReply, matchPreset, signatureOk, systemPrompt,
  type Price, type Turn,
} from "./logic.ts";

const SECRET = (Deno.env.get("LINE_CHANNEL_SECRET") ?? "").trim(); // trim: a pasted secret often ends with a newline
const TOKEN = (Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "").trim();
const GEMINI_KEY = Deno.env.get("GEMINI_KEY") ?? "";
const MODEL = Deno.env.get("PREP_LINE_MODEL") || "gemini-flash-latest";

let client: ReturnType<typeof createClient> | null = null;
const sb = () => client ??= createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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

// Gemini through its OpenAI-compatible endpoint (same as prep-ai-review). The reply token lasts about a minute,
// so one try with a 25 s timeout; on any failure the caller sends DEFAULT_TEXT instead.
async function askAI(history: Turn[], text: string): Promise<string> {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GEMINI_KEY}` },
    body: JSON.stringify({
      model: MODEL, stream: false, max_tokens: 2000, reasoning_effort: "low",
      messages: aiMessages(systemPrompt(await prices()), history, text),
    }),
    signal: AbortSignal.timeout(25_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${data?.error?.message ?? res.statusText}`);
  const out = cleanReply(data?.choices?.[0]?.message?.content);
  if (!out) throw new Error("Gemini ตอบว่าง");
  return out;
}

async function reply(replyToken: string, text: string) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
  if (!res.ok) console.error("LINE reply", res.status, await res.text());
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

async function saveSession(user: string, turns: Turn[], handoff: boolean) {
  const { error } = await sb().rpc("prep_line_session_save", { p_user: user, p_turns: turns, p_handoff: handoff });
  if (error) console.error("prep_line_session_save:", error.message);
}

async function handle(ev: LineEvent) {
  const user = ev.source?.userId;
  if (ev.source?.type !== "user" || !user || !ev.replyToken) return; // groups / rooms: stay out
  if (ev.type === "follow") return reply(ev.replyToken, WELCOME_TEXT);
  if (ev.type !== "message" || !ev.message) return;
  const kind = ev.message.type;
  const text = kind === "text" ? (ev.message.text ?? "").trim() : "";
  if (kind !== "image" && kind !== "file" && !text) return; // stickers etc.: stay quiet

  const session = await loadSession(user);
  if (session.handoff) return; // an admin has this chat

  let out: string, handoff = false, said = text;
  if (kind === "image" || kind === "file") {
    out = SLIP_TEXT; said = "[ส่งรูป/ไฟล์]";
  } else {
    const preset = matchPreset(text);
    if (preset) {
      out = preset.text(await prices()); handoff = preset.id === "admin";
    } else if (!GEMINI_KEY) {
      out = DEFAULT_TEXT;
    } else {
      try { out = await askAI(session.history, text); }
      catch (e) { console.error("AI:", (e as Error).message); out = DEFAULT_TEXT; }
    }
  }
  await reply(ev.replyToken, out);
  await saveSession(user, [{ role: "user", content: said }, { role: "assistant", content: out }], handoff);
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  if (!SECRET || !TOKEN) return new Response("LINE secrets not set", { status: 503 });
  const body = await req.text();
  if (!signatureOk(await hmacB64(body), req.headers.get("x-line-signature"))) return new Response("bad signature", { status: 401 });
  const { events = [] } = JSON.parse(body) as { events?: LineEvent[] };
  // One customer's messages in order (they share a session); different customers in parallel.
  const byUser = new Map<string, LineEvent[]>();
  for (const ev of events) {
    const k = ev.source?.userId ?? "";
    byUser.set(k, [...(byUser.get(k) ?? []), ev]);
  }
  await Promise.all([...byUser.values()].map(async (list) => {
    for (const ev of list) {
      try { await handle(ev); } catch (e) { console.error("event:", (e as Error).message); }
    }
  }));
  return new Response("ok");
});
