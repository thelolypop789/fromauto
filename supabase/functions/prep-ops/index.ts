// เอเจนต์หลังบ้าน SOBPREP ฝั่ง Supabase (deploy --no-verify-jwt; ทุก action ต้องมี x-ops-secret = vault ops_secret)
//   * action "slip_check" {order_id}: เรียกจาก trigger ตอนมีออเดอร์ใหม่ (และ prep.ops_tick สำหรับรายการตกหล่น)
//     Gemini อ่านสลิป → slipReasons (logic.ts) → prep_ops_slip_result: ผ่านครบ = อนุมัติเอง (แจ้ง LINE 1 บรรทัด), ไม่ผ่าน = ส่ง LINE หาเจ้าของพร้อมปุ่ม
//   * action "remind": สลิปที่รอเกิน 3 ชม. → ส่ง LINE เตือนซ้ำครั้งเดียว
// ไม่มีทางปฏิเสธออเดอร์เองในไฟล์นี้ — ปฏิเสธได้เฉพาะเจ้าของ (ปุ่ม LINE / หน้าแอดมิน)
// Secrets: GEMINI_KEY, LINE_CHANNEL_ACCESS_TOKEN (ใช้ร่วมกับ prep-line-bot); ตัวเลือก PREP_SLIP_MODEL (default gemini-flash-latest)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SLIP_PROMPT, SLIP_SCHEMA, approvedText, cleanRef, confirmMessage, parseSlip, slipAlertText, slipReasons, type SlipRead } from "./logic.ts";

const GEMINI_KEY = Deno.env.get("GEMINI_KEY") ?? "";
const LINE_TOKEN = (Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "").trim();
const MODEL = Deno.env.get("PREP_SLIP_MODEL") || "gemini-flash-latest";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

function b64(buf: Uint8Array): string {
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

async function readSlip(path: string): Promise<{ read: SlipRead | null; mime: string; error?: string }> {
  const { data: blob, error } = await sb.storage.from("prep-slips").download(path);
  if (error || !blob) return { read: null, mime: "", error: "โหลดสลิปไม่ได้: " + (error?.message ?? "ว่าง") };
  const mime = blob.type || "image/jpeg";
  if (!GEMINI_KEY) return { read: null, mime, error: "ไม่มี GEMINI_KEY" };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: mime, data: b64(new Uint8Array(await blob.arrayBuffer())) } }, { text: SLIP_PROMPT }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SLIP_SCHEMA },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { read: null, mime, error: `Gemini ${res.status}: ${data?.error?.message ?? ""}` };
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    return { read: parseSlip(text), mime };
  } catch (e) {
    return { read: null, mime, error: "Gemini: " + (e as Error).message };
  }
}

async function owners(): Promise<string[]> {
  const { data, error } = await sb.rpc("prep_ops_owners");
  if (error) console.error("prep_ops_owners:", error.message);
  return (data ?? []) as string[];
}

async function push(to: string, messages: unknown[]) {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify({ to, messages: messages.slice(0, 5) }),
  });
  if (!res.ok) console.error("LINE push", res.status, await res.text());
}

// รูปสลิปใน LINE ต้องเป็น https JPEG/PNG — ชนิดอื่น (HEIC/WebP) ส่งเป็นลิงก์แทน (ลิงก์อายุ 24 ชม.)
async function slipMessages(path: string, mime: string): Promise<{ image?: unknown; link?: string }> {
  const { data } = await sb.storage.from("prep-slips").createSignedUrl(path, 86400);
  if (!data?.signedUrl) return {};
  if (mime === "image/jpeg" || mime === "image/png") {
    return { image: { type: "image", originalContentUrl: data.signedUrl, previewImageUrl: data.signedUrl } };
  }
  return { link: data.signedUrl };
}

async function alertOwners(detail: Record<string, unknown>, read: SlipRead | null, token: string, title: string, path: string, mime: string, reminder = false) {
  const to = await owners();
  if (!to.length || !LINE_TOKEN) { console.error("no owner / LINE token: slip alert not sent", title); return; }
  const media = await slipMessages(path, mime);
  let text = slipAlertText(detail as Parameters<typeof slipAlertText>[0], read, reminder);
  if (media.link) text += `\nดูสลิป: ${media.link}`;
  const msgs: unknown[] = [{ type: "text", text }];
  if (media.image) msgs.push(media.image);
  msgs.push(confirmMessage(token, title));
  for (const u of to) await push(u, msgs);
}

async function slipCheck(orderId: number): Promise<Response> {
  const { data: o, error } = await sb.rpc("prep_ops_order", { p_id: orderId });
  if (error || !o) return json({ error: "order: " + (error?.message ?? "not found") }, 404);
  if (o.status !== "pending" || o.slip_checked_at) return json({ skipped: o.status });

  const { read, mime, error: readErr } = await readSlip(o.slip_path);
  const reasons = slipReasons({ id: o.id, amount: o.amount, created_at: o.created_at }, read);
  if (readErr) { console.error("slip", orderId, readErr); reasons.splice(0, reasons.length, `อ่านสลิปไม่ได้ (${readErr.slice(0, 120)})`); }
  const pass = reasons.length === 0;

  const { data: res, error: e2 } = await sb.rpc("prep_ops_slip_result", {
    p_id: orderId, p_check: { read, model: MODEL, mime }, p_ref: cleanRef(read?.ref), p_pass: pass, p_reasons: reasons,
  });
  if (e2) return json({ error: "save: " + e2.message }, 500);
  if (res?.skipped) return json(res);
  if (res?.approved) {
    const text = approvedText({ order_id: o.id, amount: o.amount, package: o.package, term: o.term, seats: o.seats });
    if (LINE_TOKEN) for (const u of await owners()) await push(u, [{ type: "text", text }]);
    return json(res);
  }

  await alertOwners({ order_id: o.id, amount: o.amount, package: o.package, term: o.term, seats: o.seats, email: o.email, reasons: res.reasons ?? reasons },
                    read, res.token, `สลิปออเดอร์ #${o.id} · ${o.amount} บาท`, o.slip_path, mime);
  return json(res);
}

async function remind(): Promise<Response> {
  const { data, error } = await sb.rpc("prep_ops_remind_list");
  if (error) return json({ error: error.message }, 500);
  const due = (data ?? []) as { id: number; title: string; token: string; detail: Record<string, unknown> }[];
  for (const a of due) {
    const { data: o } = await sb.rpc("prep_ops_order", { p_id: Number(a.detail.order_id) });
    const read = (a.detail.check as { read?: SlipRead } | undefined)?.read ?? null;
    const mime = String((a.detail.check as { mime?: string } | undefined)?.mime ?? "");
    await alertOwners({ ...a.detail, email: o?.email }, read, a.token, a.title, o?.slip_path ?? "", mime, true);
  }
  return json({ reminded: due.length });
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const sec = req.headers.get("x-ops-secret") ?? "";
  const { data: ok } = await sb.rpc("prep_ops_secret_ok", { p_secret: sec });
  if (ok !== true) return json({ error: "forbidden" }, 403);
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === "slip_check") return await slipCheck(Number(body.order_id));
    if (body.action === "remind") return await remind();
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
