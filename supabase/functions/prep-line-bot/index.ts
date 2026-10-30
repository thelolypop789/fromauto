// LINE OA chat bot (LINE @701pvghq). LINE posts every event here (webhook, so deploy with --no-verify-jwt);
// the request is trusted only when its x-line-signature matches LINE_CHANNEL_SECRET.
// A text that is one of the preset keywords gets the preset reply (logic.ts, same texts as LINE OA Manager);
// any other text is answered by Gemini from the facts in systemPrompt(); a picture (usually a slip) gets SLIP_TEXT.
// Only 1:1 chats are answered. Secrets: LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, GEMINI_KEY (shared);
// optional PREP_LINE_MODEL (default gemini-flash-latest).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  DEFAULT_TEXT, FALLBACK_PRICES, SLIP_TEXT, WELCOME_TEXT, cleanReply, matchPreset, signatureOk, systemPrompt, type Price,
} from "./logic.ts";

const SECRET = Deno.env.get("LINE_CHANNEL_SECRET") ?? "";
const TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";
const GEMINI_KEY = Deno.env.get("GEMINI_KEY") ?? "";
const MODEL = Deno.env.get("PREP_LINE_MODEL") || "gemini-flash-latest";

// prep.prices changes rarely; keep it for 10 minutes per warm instance.
let priceCache: { at: number; prices: Price[] } | null = null;
async function prices(): Promise<Price[]> {
  if (priceCache && Date.now() - priceCache.at < 600_000) return priceCache.prices;
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await sb.rpc("prep_prices");
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
async function askAI(text: string): Promise<string> {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GEMINI_KEY}` },
    body: JSON.stringify({
      model: MODEL, stream: false, max_tokens: 2000, reasoning_effort: "low",
      messages: [{ role: "system", content: systemPrompt(await prices()) }, { role: "user", content: text.slice(0, 2000) }],
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
  type: string; replyToken?: string; source?: { type: string };
  message?: { type: string; text?: string };
};

async function answer(ev: LineEvent): Promise<string | null> {
  if (ev.source?.type !== "user" || !ev.replyToken) return null;
  if (ev.type === "follow") return WELCOME_TEXT;
  if (ev.type !== "message" || !ev.message) return null;
  if (ev.message.type === "image" || ev.message.type === "file") return SLIP_TEXT;
  if (ev.message.type !== "text" || !ev.message.text) return null; // stickers etc.: stay quiet
  const preset = matchPreset(ev.message.text);
  if (preset) return preset.text(await prices());
  if (!GEMINI_KEY) return DEFAULT_TEXT;
  try {
    return await askAI(ev.message.text);
  } catch (e) {
    console.error("AI:", (e as Error).message);
    return DEFAULT_TEXT;
  }
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  if (!SECRET || !TOKEN) return new Response("LINE secrets not set", { status: 503 });
  const body = await req.text();
  if (!signatureOk(await hmacB64(body), req.headers.get("x-line-signature"))) return new Response("bad signature", { status: 401 });
  const { events = [] } = JSON.parse(body) as { events?: LineEvent[] };
  await Promise.all(events.map(async (ev) => {
    const text = await answer(ev);
    if (text && ev.replyToken) await reply(ev.replyToken, text);
  }));
  return new Response("ok");
});
