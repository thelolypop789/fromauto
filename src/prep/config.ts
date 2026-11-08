// Shop details shown on the upgrade page. Fill these in before launch.
export const SHOP = {
  bankText: "Thai QR / พร้อมเพย์ จ่ายได้ทุกแอปธนาคาร · ชื่อบัญชี นาย พงศกร ดรโคตร์กอก",
  qrImage: "/prep-pay-qr.png", // fallback Thai QR without an amount (ถุงเงิน กรุงไทย)
  // Fixed-amount QRs (amount locked in the code) by price in baht; shown for the chosen package.
  qrByAmount: Object.fromEntries([30, 39, 49, 50, 59, 69, 78, 80, 89, 99, 110, 119, 129, 130, 158, 159, 169, 170, 179, 206, 209, 219, 240, 270, 286, 345, 350, 450, 590, 625, 765].map(a => [a, `/prep-pay-qr-${a}.png`])) as Record<number, string>, // make more with scripts/prep/make_qr.py
  contactText: "LINE @701pvghq",
  contactUrl: "https://lin.ee/ROuWTfN",
  roundText: "ใช้ได้ 3 เดือน นับจากวันกรอกคีย์", // what a "รายรอบ" purchase covers (keys: แอดมิน → คีย์ → รายรอบ 3 เดือน)
};

// Package names and descriptions. Prices shown here are only a fallback: the real prices live in the database
// (prep.prices, editable in แอดมิน → คำสั่งซื้อ; only active ones are for sale) and the buyer's own price comes from prep_quotes.
// แพ็กภาค ก ปิดการขาย (8 พ.ย. 69) · ซื้อขาดขายถึง 15 พ.ย. 69 · รายปีเริ่ม 16 พ.ย. 69 (migration 20261108140000_prep_yearly_pricing.sql)
export const PACKAGES: { key: "B" | "ALL"; name: string; desc: string; round: string; year: string; lifetime: string; best?: boolean }[] = [
  { key: "B", name: "แพ็กภาค ข + วิชาเอก", desc: "วิชาการศึกษา กฎหมายการศึกษา และวิชาเอกทุกวิชา", round: "99 บาท", year: "169 บาท", lifetime: "129 บาท" },
  { key: "ALL", name: "แพ็กครบทุกภาค", desc: "ภาค ก + ภาค ข + วิชาเอก คุ้มที่สุด", round: "129 บาท", year: "219 บาท", lifetime: "179 บาท", best: true },
];

// กลุ่มเตรียมสอบ by SOBPREP: ใส่ลิงก์เมื่อสร้างกลุ่มแล้ว (ว่าง = ไม่แสดงปุ่มนั้น) แล้ว push ขึ้น main ให้ Vercel build ใหม่
export const COMMUNITY = {
  facebook: "",   // https://www.facebook.com/groups/...
  openchat: "",   // https://line.me/ti/g2/...
};

// แพ็กซื้อขาด (ตลอดชีพ) ขายถึงสิ้นวันที่ 15 พ.ย. 2569 เท่านั้น (วันสอบภาค ข) ผู้ที่ซื้อไว้แล้วใช้ได้ตลอดเหมือนเดิม
// ฐานข้อมูลก็ปิดรับคำสั่งซื้อแบบซื้อขาดหลังเวลานี้ (migration 20261108130000_prep_lifetime_cutoff.sql)
export const LIFETIME_UNTIL = "2026-11-16T00:00:00+07:00";
export const lifetimeOpen = () => Date.now() < new Date(LIFETIME_UNTIL).getTime();
export const LIFETIME_LAST_DAY = "15 พ.ย. 69";
