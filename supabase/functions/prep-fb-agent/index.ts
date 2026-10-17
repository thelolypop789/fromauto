// Facebook page agent. Publishes the posts an admin approved in prep.fb_posts and posts their follow-up comment
// (the answer) after the delay. Two ways in:
//   * pg_cron, every 10 minutes while the master switch is on: header x-cron-secret (checked in the database)
//   * an admin in the app (JWT): action "tick" (run now) or "test" (read-only check of the page token)
// The page token is the secret FB_PAGE_TOKEN and the page id is FB_PAGE_ID; neither is ever stored in the database.
// This function never decides what to publish: it only sends what a human approved.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GRAPH, cleanText, explainGraphError, mimeFor, safePath, type GraphError } from "./logic.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAGE_TOKEN = Deno.env.get("FB_PAGE_TOKEN") ?? "";
const PAGE_ID = Deno.env.get("FB_PAGE_ID") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

class FbError extends Error {
  constructor(message: string, public tokenProblem = false) { super(message); }
}

async function graph(path: string, init: { method?: string; form?: FormData }): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(`${GRAPH}/${path}`, {
      method: init.method ?? "POST", body: init.form,
      headers: { Authorization: `Bearer ${PAGE_TOKEN}` },
      signal: AbortSignal.timeout(40000),
    });
  } catch (e) {
    throw new FbError("เชื่อมต่อ Facebook ไม่ได้: " + (e as Error).message);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const ex = explainGraphError(res.status, data.error as GraphError | undefined);
    throw new FbError(ex.message, ex.tokenProblem);
  }
  return data;
}

const sbService = () => createClient(SUPABASE_URL, SERVICE_KEY);

async function loadImage(sb: ReturnType<typeof sbService>, path: unknown): Promise<Blob> {
  const p = safePath(path);
  if (!p) throw new FbError("ที่อยู่รูปไม่ถูกต้อง");
  const { data, error } = await sb.storage.from("fb-media").download(p);
  if (error || !data) throw new FbError("ดึงรูปจากที่เก็บไฟล์ไม่ได้: " + (error?.message ?? p));
  return new Blob([await data.arrayBuffer()], { type: mimeFor(p) });
}

async function publishPost(sb: ReturnType<typeof sbService>, p: { caption: string; image_path: string | null }): Promise<string> {
  const text = cleanText(p.caption);
  const form = new FormData();
  if (p.image_path) {
    form.set("source", await loadImage(sb, p.image_path), p.image_path.split("/").pop() ?? "image.png");
    if (text) form.set("caption", text);
    const r = await graph(`${PAGE_ID}/photos`, { form });
    const id = String(r.post_id ?? r.id ?? "");
    if (!id) throw new FbError("Facebook ไม่ส่งรหัสโพสต์กลับมา");
    return id;
  }
  if (!text) throw new FbError("โพสต์ว่าง");
  form.set("message", text);
  const r = await graph(`${PAGE_ID}/feed`, { form });
  const id = String(r.id ?? "");
  if (!id) throw new FbError("Facebook ไม่ส่งรหัสโพสต์กลับมา");
  return id;
}

async function publishComment(sb: ReturnType<typeof sbService>, c: { fb_post_id: string; text: string; image_path: string | null }): Promise<string> {
  const form = new FormData();
  const text = cleanText(c.text);
  if (text) form.set("message", text);
  if (c.image_path) form.set("source", await loadImage(sb, c.image_path), c.image_path.split("/").pop() ?? "image.png");
  if (!text && !c.image_path) throw new FbError("คอมเมนต์ว่าง");
  const r = await graph(`${encodeURIComponent(c.fb_post_id)}/comments`, { form });
  return String(r.id ?? "");
}

async function tick() {
  if (!PAGE_TOKEN || !PAGE_ID) return { ok: false, error: "ยังไม่ได้ตั้ง FB_PAGE_TOKEN / FB_PAGE_ID ใน Supabase secrets", posted: 0, commented: 0, failed: 0 };
  const sb = sbService();
  const { data, error } = await sb.rpc("prep_fb_claim");
  if (error) throw new Error("claim: " + error.message);
  const out = { ok: true, enabled: data.enabled as boolean, posted: 0, commented: 0, failed: 0, errors: [] as string[] };
  let tokenDead = false;
  for (const p of data.posts as { id: number; caption: string; image_path: string | null }[]) {
    try {
      if (tokenDead) throw new FbError("ข้ามเพราะ token ใช้ไม่ได้ในรอบนี้", true);
      const id = await publishPost(sb, p);
      const { error: e } = await sb.rpc("prep_fb_post_done", { p_id: p.id, p_fb_post_id: id });
      if (e) out.errors.push(`post ${p.id} ขึ้นเพจแล้วแต่บันทึกสถานะไม่สำเร็จ: ${e.message}`);
      out.posted++;
    } catch (e) {
      const m = (e as Error).message;
      if (e instanceof FbError && e.tokenProblem) tokenDead = true;
      await sb.rpc("prep_fb_post_failed", { p_id: p.id, p_error: m });
      out.failed++; out.errors.push(`post ${p.id}: ${m}`);
    }
  }
  for (const c of data.comments as { id: number; fb_post_id: string; text: string; image_path: string | null }[]) {
    try {
      if (tokenDead) throw new FbError("ข้ามเพราะ token ใช้ไม่ได้ในรอบนี้", true);
      const id = await publishComment(sb, c);
      const { error: e } = await sb.rpc("prep_fb_comment_done", { p_id: c.id, p_comment_id: id });
      if (e) out.errors.push(`comment ${c.id} ขึ้นแล้วแต่บันทึกสถานะไม่สำเร็จ: ${e.message}`);
      out.commented++;
    } catch (e) {
      const m = (e as Error).message;
      if (e instanceof FbError && e.tokenProblem) tokenDead = true;
      await sb.rpc("prep_fb_comment_failed", { p_id: c.id, p_error: m });
      out.failed++; out.errors.push(`comment ${c.id}: ${m}`);
    }
  }
  return out;
}

async function testConnection() {
  if (!PAGE_TOKEN || !PAGE_ID) return { ok: false, error: "ยังไม่ได้ตั้ง FB_PAGE_TOKEN / FB_PAGE_ID ใน Supabase secrets" };
  try {
    const r = await graph(`${PAGE_ID}?fields=name,id`, { method: "GET" });
    return { ok: true, page: r.name, id: r.id };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "tick");
    const cron = req.headers.get("x-cron-secret");
    if (cron) {
      const { data } = await sbService().rpc("prep_fb_secret_ok", { p_secret: cron });
      if (data !== true) return json({ error: "forbidden" }, 403);
      if (action !== "tick" && action !== "test") return json({ error: "bad action" }, 400);
    } else {
      const auth = req.headers.get("Authorization") ?? "";
      if (!auth.startsWith("Bearer ")) return json({ error: "กรุณาเข้าสู่ระบบ" }, 401);
      const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
      const { data: isAdmin, error } = await sb.rpc("prep_admin_check");
      if (error || isAdmin !== true) return json({ error: "ไม่มีสิทธิ์แอดมิน" }, 403);
    }
    if (action === "test") return json(await testConnection());
    if (action === "tick") return json(await tick());
    return json({ error: "bad action" }, 400);
  } catch (e) {
    return json({ error: "เกิดข้อผิดพลาด: " + ((e as Error).message ?? String(e)) }, 500);
  }
});
