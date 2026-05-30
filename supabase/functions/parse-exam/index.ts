import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_KEY = Deno.env.get("GEMINI_KEY")!;
const MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { parts } = await req.json();

    let lastError = "";
    for (const model of MODELS) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts }] }),
          }
        );
        const data = await res.json();
        if (data.error) {
          if (data.error.code === 429 || data.error.code === 503) {
            lastError = data.error.message;
            continue;
          }
          throw new Error(data.error.message);
        }
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        const start = content.indexOf("{");
        const end = content.lastIndexOf("}");
        if (start === -1 || end === -1) throw new Error("ไม่พบข้อมูลที่ถูกต้องจาก AI");
        const parsed = JSON.parse(content.substring(start, end + 1));

        return new Response(JSON.stringify(parsed), {
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      } catch (err: any) {
        if (err.message?.includes("quota") || err.message?.includes("429")) {
          lastError = err.message;
          continue;
        }
        throw err;
      }
    }
    throw new Error("โควต้าหมดทุก Model กรุณาลองใหม่พรุ่งนี้: " + lastError);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
