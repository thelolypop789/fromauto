import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_KEY = Deno.env.get("GEMINI_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
];
const USER_DAILY_LIMIT = 10;
const GLOBAL_DAILY_LIMIT = 200;
const MAX_CONTENT_BYTES = 5 * 1024 * 1024; // 5MB

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Input size guard
  const contentLength = parseInt(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_CONTENT_BYTES) {
    return json({ error: "ไฟล์ใหญ่เกินไป (สูงสุด 5 MB)" }, 413);
  }

  const { parts, license_key } = await req.json();
  const authHeader = req.headers.get("Authorization");

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const today = new Date().toISOString().split("T")[0];

  let isQuotaExempt = false;
  let userLimit = USER_DAILY_LIMIT;
  let usageKey = license_key;

  // 1. Check if authenticated via Supabase Google Auth
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await sb.auth.getUser(token);
    if (user && user.email?.endsWith("@wangluangpitt.ac.th")) {
      isQuotaExempt = true; // School teachers get unlimited quota (not admin)
      usageKey = user.email; // Use email as the tracking key
    }
  }

  // 2. Fallback to License Key logic if not a school email
  if (!isQuotaExempt) {
    if (!license_key) return json({ error: "ไม่พบ License Key หรือไม่ได้ล็อกอินด้วยอีเมลโรงเรียน" }, 401);

    const { data: license } = await sb
      .from("licenses")
      .select("is_active, expires_at, role, daily_limit")
      .eq("key", license_key)
      .eq("is_active", true)
      .single();

    if (!license) return json({ error: "License Key ไม่ถูกต้องหรือถูกปิดใช้งาน" }, 403);
    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return json({ error: "License Key หมดอายุแล้ว" }, 403);
    }
    
    if (license.role === "admin") isQuotaExempt = true;
    userLimit = license.daily_limit ?? USER_DAILY_LIMIT;
  }

  // Global daily budget guard
  const { data: globalRows } = await sb
    .from("usage_logs")
    .select("requests")
    .eq("date", today);
  const totalToday = (globalRows ?? []).reduce((s: number, r: any) => s + r.requests, 0);
  if (totalToday >= GLOBAL_DAILY_LIMIT) {
    return json({ error: "ระบบถึงขีดจำกัดรายวัน กรุณาลองใหม่พรุ่งนี้" }, 429);
  }

  // Per-user daily limit (exempt for admins and school teachers)
  if (!isQuotaExempt) {
    const { data: userRow } = await sb
      .from("usage_logs")
      .select("requests")
      .eq("license_key", usageKey)
      .eq("date", today)
      .single();
    if ((userRow?.requests ?? 0) >= userLimit) {
      return json({ error: `ใช้ครบ ${userLimit} ครั้งแล้ววันนี้ กรุณาลองใหม่พรุ่งนี้` }, 429);
    }
  }

  // Atomically increment usage counter
  if (usageKey) {
    await sb.rpc("increment_usage", { p_license_key: usageKey, p_date: today });
  }

  // Call Gemini with model fallback
  const errors: Record<string, any> = {};
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
        errors[model] = data.error.message || data.error;
        continue;
      }
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const start = content.indexOf("{");
      const end = content.lastIndexOf("}");
      if (start === -1 || end === -1) {
        errors[model] = "ไม่พบ JSON ที่ถูกต้องจาก AI: " + content.slice(0, 100);
        continue;
      }
      return json(JSON.parse(content.substring(start, end + 1)));
    } catch (err: any) {
      errors[model] = err.message || String(err);
      continue;
    }
  }

  return json({ error: "ไม่สามารถแปลงข้อสอบได้: " + JSON.stringify(errors) }, 500);
});
