// Media helper for the summary clips (scripts/prep/video): Gemini text-to-speech, so GEMINI_KEY never leaves Supabase.
// Callers: an admin (JWT) or the clip builder with x-media-secret (vault secret media_secret, checked in the database).
//   {action:"models"}                         → TTS-capable model names
//   {action:"tts", text, voice?, style? (system instruction), model?} → {pcm: base64 s16le mono, rate}
// Optional secret PREP_TTS_MODEL (default gemini-2.5-flash-preview-tts).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("GEMINI_KEY") ?? "";
const MODEL = Deno.env.get("PREP_TTS_MODEL") || "gemini-2.5-flash-preview-tts";
const API = "https://generativelanguage.googleapis.com/v1beta";
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });

async function allowed(req: Request): Promise<boolean> {
  const sec = req.headers.get("x-media-secret");
  const admin = createClient(URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (sec) { const { data } = await admin.rpc("prep_media_secret_ok", { p_secret: sec }); return data === true; }
  const auth = req.headers.get("Authorization") ?? "";
  const u = createClient(URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data } = await u.rpc("prep_admin_check"); return data === true;
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!(await allowed(req))) return json({ error: "forbidden" }, 403);
  if (!KEY) return json({ error: "GEMINI_KEY not set" }, 503);
  const body = await req.json().catch(() => ({}));
  if (body.action === "models") {
    const r = await fetch(`${API}/models?pageSize=200&key=${KEY}`); const d = await r.json();
    return json({ models: (d.models ?? []).map((m: { name: string }) => m.name).filter((n: string) => /tts|audio|speech/i.test(n)) });
  }
  if (body.action === "tts") {
    const text = String(body.text ?? "").slice(0, 4000);
    if (!text) return json({ error: "empty text" }, 400);
    // style goes in systemInstruction (a style prefixed to the text gets read aloud by the newer TTS models)
    const prompt = text;
    const r = await fetch(`${API}/models/${body.model || MODEL}:generateContent?key=${KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        ...(body.style ? { systemInstruction: { parts: [{ text: String(body.style) }] } } : {}),
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: body.voice || "Puck" } } } },
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: d?.error?.message ?? r.statusText }, r.status);
    const part = d?.candidates?.[0]?.content?.parts?.find((p: { inlineData?: unknown }) => p.inlineData);
    if (!part) {
      const c = d?.candidates?.[0];
      return json({ error: "no audio in reply", finish: c?.finishReason ?? d?.promptFeedback?.blockReason ?? null,
                    text: c?.content?.parts?.map((p: { text?: string }) => p.text).join("").slice(0, 200) ?? null }, 502);
    }
    const mime: string = part.inlineData.mimeType ?? "";
    return json({ pcm: part.inlineData.data, rate: Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000), mime });
  }
  return json({ error: "bad action" }, 400);
});
