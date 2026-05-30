import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

  const { admin_key, action, params } = await req.json();
  if (!admin_key) return json({ error: "ไม่พบ Admin Key" }, 401);

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Validate admin key server-side — cannot be bypassed from client
  const { data: license } = await sb
    .from("licenses")
    .select("role, is_active")
    .eq("key", admin_key)
    .eq("is_active", true)
    .single();

  if (!license || license.role !== "admin") {
    return json({ error: "ไม่มีสิทธิ์ Admin" }, 403);
  }

  switch (action) {
    case "list_licenses": {
      const { data } = await sb.from("licenses").select("*").order("created_at", { ascending: false });
      return json({ data });
    }
    case "get_usage": {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await sb.from("usage_logs").select("license_key, requests").eq("date", today);
      return json({ data });
    }
    case "create_license": {
      const { key, role, note, expires_at } = params;
      const { error } = await sb.from("licenses").insert({
        key, role, note: note || null, expires_at: expires_at || null, is_active: true,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }
    case "toggle_license": {
      const { id, is_active, role } = params;
      if (role === "admin" && is_active) return json({ error: "ไม่สามารถปิด Admin Key ได้ กรุณาลบแทน" }, 400);
      const { error } = await sb.from("licenses").update({ is_active: !is_active }).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }
    case "delete_license": {
      const { id } = params;
      const { error } = await sb.from("licenses").delete().eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }
    case "update_quota": {
      const { id, daily_limit } = params;
      if (!daily_limit || daily_limit < 1 || daily_limit > 9999) return json({ error: "ค่าไม่ถูกต้อง" }, 400);
      const { error } = await sb.from("licenses").update({ daily_limit }).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }
    default:
      return json({ error: "Unknown action" }, 400);
  }
});
