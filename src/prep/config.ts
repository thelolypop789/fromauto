// Shop details shown on the upgrade page. Fill these in before launch.
export const SHOP = {
  bankText: "Thai QR / พร้อมเพย์ จ่ายได้ทุกแอปธนาคาร · ชื่อบัญชี นาย พงศกร ดรโคตร์กอก",
  qrImage: "/prep-pay-qr.png", // fallback Thai QR without an amount (ถุงเงิน กรุงไทย)
  // Fixed-amount QRs (amount locked in the code) by price in baht; shown for the chosen package.
  qrByAmount: Object.fromEntries([30, 39, 49, 50, 59, 69, 78, 80, 89, 99, 110, 119, 129, 130, 158, 169, 170, 179, 206, 240, 286, 345, 450, 625].map(a => [a, `/prep-pay-qr-${a}.png`])) as Record<number, string>, // make more with scripts/prep/make_qr.py
  contactText: "LINE @701pvghq",
  contactUrl: "https://lin.ee/ROuWTfN",
  roundText: "ใช้ได้ 3 เดือน นับจากวันกรอกคีย์", // what a "รายรอบ" purchase covers (keys: แอดมิน → คีย์ → รายรอบ 3 เดือน)
};

// Package names and descriptions. Prices shown here are only a fallback: the real prices live in the database
// (prep.prices, editable in แอดมิน → คำสั่งซื้อ) and the buyer's own price comes from prep_quotes.
export const PACKAGES: { key: "A" | "B" | "ALL"; name: string; desc: string; round: string; lifetime: string; best?: boolean }[] = [
  { key: "A", name: "แพ็กภาค ก", desc: "ความรู้ความสามารถทั่วไป: คิดวิเคราะห์ ภาษาอังกฤษ ข้าราชการที่ดี", round: "49 บาท", lifetime: "99 บาท" },
  { key: "B", name: "แพ็กภาค ข + วิชาเอก", desc: "วิชาการศึกษา กฎหมายการศึกษา และวิชาเอกทุกวิชา", round: "69 บาท", lifetime: "129 บาท" },
  { key: "ALL", name: "แพ็กครบทุกภาค", desc: "ภาค ก + ภาค ข + วิชาเอก คุ้มที่สุด", round: "99 บาท", lifetime: "179 บาท", best: true },
];
