// Admin-only: turns a study sheet / old exam (text or PDF slice) into draft questions with Gemini.
// Uses the same GEMINI_KEY secret as parse-exam. Drafts are returned to the browser, which sends
// the ones the admin keeps to public.prep_admin_import (status = review).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildPrompt, normalize, parseModelJson, responseSchema, type Mode, type TopicInfo } from "./logic.ts";

const GEMINI_KEY = Deno.env.get("GEMINI_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Cheapest tier first. Only same-tier "flash" fallbacks on overload / unknown model — never "pro".
const PRIMARY = Deno.env.get("PREP_IMPORT_MODEL") || "gemini-3.5-flash-lite";
const FALLBACKS = ["gemini-3.5-flash", "gemini-flash-latest"];

const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_CHARS = 60_000;
const MAX_COUNT = 40;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "กรุณาเข้าสู่ระบบ" }, 401);

    // Run as the caller so prep_admin_check() sees their auth.uid().
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: isAdmin, error: adminErr } = await sb.rpc("prep_admin_check");
    if (adminErr || isAdmin !== true) return json({ error: "ไม่มีสิทธิ์แอดมิน" }, 403);

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return json({ error: "ไฟล์ใหญ่เกินไป (ส่งทีละไม่เกินประมาณ 5 MB)" }, 413);
    const body = JSON.parse(raw);

    const mode: Mode = body.mode === "extract" ? "extract" : "generate";
    const count = Math.max(1, Math.min(MAX_COUNT, Math.floor(Number(body.count) || 20)));
    const hint = typeof body.hint === "string" ? body.hint.slice(0, 500) : "";
    const pages = typeof body.pages === "string" ? body.pages.slice(0, 40) : undefined;

    const parts: unknown[] = [];
    if (body.kind === "pdf") {
      if (typeof body.pdf_base64 !== "string" || body.pdf_base64.length < 100) return json({ error: "ไม่พบไฟล์ PDF" }, 400);
      parts.push({ inlineData: { mimeType: "application/pdf", data: body.pdf_base64 } });
    } else {
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (text.length < 50) return json({ error: "เนื้อหาสั้นเกินไป" }, 400);
      parts.push({ text: "เนื้อหาเอกสาร:\n" + text.slice(0, MAX_TEXT_CHARS) });
    }

    const { data: topicRows, error: topicErr } = await sb.rpc("prep_topics");
    if (topicErr) return json({ error: "โหลดหมวดไม่ได้: " + topicErr.message }, 500);
    const topics = (topicRows as TopicInfo[]).map(t => ({ code: t.code, name: t.name }));
    const topicCodes = new Set(topics.map(t => t.code));

    parts.push({ text: buildPrompt(mode, topics, { count, hint, pages }) });

    const payload = JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 24000,
        responseMimeType: "application/json",
        responseSchema: responseSchema([...topicCodes]),
      },
    });

    let lastError = "";
    for (const model of [PRIMARY, ...FALLBACKS]) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
        body: payload,
      });
      const data = await res.json().catch(() => ({}));
      if (data.error) {
        lastError = `${model}: ${data.error.message ?? JSON.stringify(data.error)}`;
        if ([404, 429, 500, 503].includes(data.error.code)) continue;
        return json({ error: "Gemini: " + lastError }, 502);
      }
      const cand = data.candidates?.[0];
      const text = (cand?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
      if (!text) {
        lastError = `${model}: ${cand?.finishReason ?? "ไม่มีผลลัพธ์"}`;
        continue;
      }

      let rawItems: unknown[];
      try { rawItems = parseModelJson(text); }
      catch (e) { lastError = `${model}: ${(e as Error).message}`; continue; }

      const items = [], dropped: string[] = [];
      const seen = new Set<string>();
      for (const r of rawItems) {
        const { q, drop } = normalize(r, topicCodes);
        if (!q) { dropped.push(drop!); continue; }
        const key = q.stem.replace(/\s/g, "");
        if (seen.has(key)) { dropped.push("ข้อซ้ำในชุดเดียวกัน"); continue; }
        seen.add(key);
        items.push(q);
      }
      return json({
        items, dropped, model,
        truncated: cand?.finishReason === "MAX_TOKENS",
        usage: data.usageMetadata ?? null,
      });
    }
    return json({ error: "AI ไม่ตอบ: " + lastError }, 502);
  } catch (e) {
    return json({ error: "เกิดข้อผิดพลาด: " + ((e as Error).message ?? String(e)) }, 500);
  }
});
