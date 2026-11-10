// Pure helpers for prep-ops (no Deno / network here, so they can be unit-tested with node: scripts/prep/test_ops_logic.mjs).
// เกณฑ์อนุมัติสลิปอัตโนมัติ (ตกลงกับเจ้าของ 10 พ.ย. 69) — ต้องผ่านครบทุกข้อ ไม่งั้นส่งให้เจ้าของกด:
//   1. ยอดเงินในสลิป = ยอดของออเดอร์ (orders.amount คือราคาที่เซิร์ฟเวอร์คิดแล้ว รวมโค้ดส่วนลด/แพ็กกลุ่ม)
//   2. ชื่อผู้รับตรงกับร้าน
//   3. เวลาโอนไม่เกิน 48 ชม. ก่อนส่งสลิป (และไม่ล้ำไปหลังส่งเกิน 10 นาที)
//   4. มีเลขอ้างอิงธุรกรรม (ความซ้ำตรวจในฐานข้อมูล prep_ops_slip_result)
//   5. อ่านได้ชัด และไม่เห็นร่องรอยตัดต่อ

export type SlipRead = {
  readable: boolean;
  is_transfer_slip: boolean;
  amount: number | null;
  receiver_name: string | null;
  receiver_account: string | null;
  sender_name: string | null;
  bank: string | null;
  paid_at: string | null;      // ISO 8601 ค.ศ. เวลาไทย เช่น 2026-11-10T20:15:00+07:00
  ref: string | null;
  tamper_signs: boolean;
  tamper_note: string | null;
};

export type OrderInfo = { id: number; amount: number; created_at: string };

// ผู้รับเงินของร้าน: QR หลักคือถุงเงินกรุงไทย ชื่อร้าน "ซ้อมข้อสอบครูผู้ช่วย" รหัสร้านค้า KN143990QP0389845IZ
// (สลิปจริง ออเดอร์ #333, 10 พ.ย. 69) + บัญชีพร้อมเพย์ส่วนตัว (src/prep/config.ts bankText) ซึ่งสลิปมักย่อ/ปิดนามสกุล จึงเทียบแค่ชื่อต้น
export const RECEIVER_NAMES = ["ซ้อมข้อสอบครูผู้ช่วย", "พงศกร", "PONGSAKORN", "PONGSAKON", "PONGSARKON"];
export const RECEIVER_ACCOUNTS = ["KN143990QP0389845IZ", "SOMKOSOBKRUPUCHUAI"];

const norm = (s: string) => s.normalize("NFC").toUpperCase().replace(/[\s.-]/g, "");

export function receiverOk(name: string | null, account: string | null = null, names: string[] = RECEIVER_NAMES): boolean {
  const n = name ? norm(name) : "", a = account ? norm(account) : "";
  return (!!n && names.some(x => n.includes(norm(x)))) || (!!a && RECEIVER_ACCOUNTS.some(x => a.includes(norm(x))));
}

// คืนรายการเหตุผลที่ไม่ผ่าน (ภาษาไทย ส่งให้เจ้าของอ่าน) — ว่าง = ผ่านครบ
export function slipReasons(order: OrderInfo, r: SlipRead | null, names: string[] = RECEIVER_NAMES): string[] {
  if (!r) return ["อ่านสลิปไม่ได้ (AI ไม่ตอบ)"];
  const out: string[] = [];
  if (!r.readable) out.push("ภาพไม่ชัด อ่านไม่ได้");
  if (!r.is_transfer_slip) out.push("ไม่ใช่สลิปโอนเงิน");
  if (r.tamper_signs) out.push("อาจถูกตัดต่อ" + (r.tamper_note ? `: ${r.tamper_note}` : ""));
  if (r.amount == null || !Number.isFinite(r.amount)) out.push("ไม่พบยอดเงิน");
  else if (Math.abs(r.amount - order.amount) > 0.004) out.push(`ยอด ${fmt(r.amount)} บาท ไม่ตรงกับออเดอร์ ${order.amount} บาท`);
  if (!receiverOk(r.receiver_name, r.receiver_account, names)) out.push(`ชื่อผู้รับไม่ตรง (${r.receiver_name ?? "ไม่พบ"})`);
  const paid = r.paid_at ? Date.parse(r.paid_at) : NaN;
  const sent = Date.parse(order.created_at);
  if (!Number.isFinite(paid)) out.push("ไม่พบวันเวลาโอน");
  else if (paid < sent - 48 * 3600_000) out.push(`โอนเกิน 48 ชม. ก่อนส่งสลิป (${thaiTime(paid)})`);
  else if (paid > sent + 10 * 60_000) out.push(`เวลาโอนอยู่หลังเวลาส่งสลิป (${thaiTime(paid)})`);
  if (!cleanRef(r.ref)) out.push("ไม่พบเลขอ้างอิง");
  return out;
}

export const cleanRef = (s: string | null | undefined) => {
  const v = (s ?? "").toUpperCase().replace(/\s/g, "");
  return v.length >= 6 ? v : null;   // เลขอ้างอิงสลิปไทยยาว 10–25 ตัว; สั้นกว่านี้น่าจะอ่านผิด
};

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export function thaiTime(ms: number): string {
  const d = new Date(ms + 7 * 3600_000);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} น.`;
}

export const SLIP_PROMPT = `ภาพนี้ควรเป็นสลิปโอนเงินของธนาคารไทย/พร้อมเพย์ อ่านแล้วตอบเป็น JSON ตาม schema เท่านั้น
- amount: ยอดเงินที่โอน เป็นตัวเลข (ไม่รวมค่าธรรมเนียม) ถ้าไม่เห็นให้ null
- receiver_name / receiver_account: ชื่อและเลขบัญชี/พร้อมเพย์/รหัสร้านค้าของ "ผู้รับเงิน" ตามที่พิมพ์ในสลิป (คงตัวที่ถูกปิดเป็น x ไว้)
- sender_name: ชื่อผู้โอน
- paid_at: วันเวลาโอน แปลงเป็น ISO 8601 ปี ค.ศ. เวลาไทย (+07:00) เช่น 2026-11-10T20:15:00+07:00 (พ.ศ. ลบ 543; "10 พ.ย. 69" = 2026-11-10)
- ref: เลขที่รายการ/รหัสอ้างอิง/Transaction ID ตามที่เห็น ถ้ามีหลายเลขให้เลือกเลขอ้างอิงธุรกรรมหลัก
- readable: true ถ้าอ่านยอด เวลา และเลขอ้างอิงได้ชัด
- is_transfer_slip: false ถ้าเป็นภาพอื่น (เช่น QR เปล่า หน้าจอยอดเงินคงเหลือ ภาพถ่ายหน้าจอแอปอื่น)
- tamper_signs: true เมื่อเห็นร่องรอยแก้ไขภาพชัดเจน เช่น ฟอนต์/ขนาดตัวเลขไม่เข้ากับส่วนอื่น ขอบรอบตัวเลขเพี้ยน ตัวเลขซ้อนกัน; ภาพเบลอหรือครอปเฉยๆ ไม่นับ
- tamper_note: อธิบายสั้นๆ ถ้า tamper_signs เป็น true`;

export const SLIP_SCHEMA = {
  type: "object",
  properties: {
    readable: { type: "boolean" }, is_transfer_slip: { type: "boolean" },
    amount: { type: "number", nullable: true }, receiver_name: { type: "string", nullable: true },
    receiver_account: { type: "string", nullable: true }, sender_name: { type: "string", nullable: true },
    bank: { type: "string", nullable: true }, paid_at: { type: "string", nullable: true },
    ref: { type: "string", nullable: true }, tamper_signs: { type: "boolean" }, tamper_note: { type: "string", nullable: true },
  },
  required: ["readable", "is_transfer_slip", "amount", "receiver_name", "paid_at", "ref", "tamper_signs"],
};

export function parseSlip(raw: unknown): SlipRead | null {
  let o: Record<string, unknown>;
  try { o = typeof raw === "string" ? JSON.parse(raw) : (raw as Record<string, unknown>); } catch { return null; }
  if (!o || typeof o !== "object") return null;
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null);
  const num = typeof o.amount === "number" ? o.amount : typeof o.amount === "string" ? Number(o.amount.replace(/[,\s฿บาท]/g, "")) : null;
  return {
    readable: o.readable === true, is_transfer_slip: o.is_transfer_slip !== false,
    amount: num != null && Number.isFinite(num) ? num : null,
    receiver_name: s(o.receiver_name), receiver_account: s(o.receiver_account), sender_name: s(o.sender_name),
    bank: s(o.bank), paid_at: s(o.paid_at), ref: s(o.ref), tamper_signs: o.tamper_signs === true, tamper_note: s(o.tamper_note),
  };
}

const PACK: Record<string, string> = { A: "ภาค ก", B: "ภาค ข+เอก", ALL: "ครบทุกภาค" };
const TERM: Record<string, string> = { round: "รายรอบ", year: "รายปี", lifetime: "ตลอดชีพ" };

// ข้อความ LINE ถึงเจ้าของ (ข้อความธรรมดาก่อนปุ่ม) — สั้น อ่านบนมือถือ
export function slipAlertText(
  d: { order_id: number; amount: number; package: string; term: string; seats?: number; email?: string | null; reasons: string[] },
  r: SlipRead | null, reminder = false,
): string {
  const head = reminder ? "⏰ ยังรออนุมัติเกิน 3 ชม." : "🧾 สลิปน่าสงสัย ต้องให้คุณดู";
  const lines = [
    head,
    `ออเดอร์ #${d.order_id} · ${PACK[d.package] ?? d.package} ${TERM[d.term] ?? d.term}${(d.seats ?? 1) > 1 ? ` ×${d.seats} คน` : ""} · ${d.amount} บาท`,
    d.email ? `ลูกค้า: ${d.email}` : "",
    r ? `สลิป: ${r.amount ?? "?"} บาท → ${r.receiver_name ?? "?"} · ${r.paid_at ? thaiTime(Date.parse(r.paid_at)) : "?"} · ref ${r.ref ?? "?"}` : "",
    "เหตุผล:",
    ...d.reasons.map(x => `• ${x}`),
  ];
  return lines.filter(Boolean).join("\n").slice(0, 4900);
}

// ปุ่มยืนยัน (confirm template: ค้างในแชท กดย้อนหลังได้จนหมดอายุ) — data = ops:<token>:y|n
export function confirmMessage(token: string, title: string, yes = "✅ อนุมัติ", no = "❌ ไม่อนุมัติ") {
  return {
    type: "template",
    altText: `รออนุมัติ: ${title}`.slice(0, 400),
    template: {
      type: "confirm",
      text: `${title}\n(ปุ่มใช้ได้ครั้งเดียว ภายใน 24 ชม.)`.slice(0, 240),
      actions: [
        { type: "postback", label: yes.slice(0, 20), data: `ops:${token}:y`, displayText: `${yes} — ${title}`.slice(0, 300) },
        { type: "postback", label: no.slice(0, 20), data: `ops:${token}:n`, displayText: `${no} — ${title}`.slice(0, 300) },
      ],
    },
  };
}

// ฝั่งบอท (parsePostback / parseCommand / decideReply / commandReply) อยู่ใน prep-line-bot/logic.ts
