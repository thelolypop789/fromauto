// Shop details shown on the upgrade page. Fill these in before launch.
export const SHOP = {
  bankText: "สแกน QR ด้านล่าง (Thai QR / พร้อมเพย์ จ่ายได้ทุกแอปธนาคาร) · ชื่อบัญชี นาย พงศกร ดรโคตร์กอก",
  qrImage: "/prep-pay-qr.png", // static Thai QR (ถุงเงิน กรุงไทย): the buyer types the amount
  contactText: "", // e.g. "ส่งสลิปทาง LINE: @formauto"
  contactUrl: "", // e.g. "https://line.me/R/ti/p/@formauto"
  roundText: "ใช้ได้ 3 เดือน นับจากวันกรอกคีย์", // what a "รายรอบ" purchase covers (keys: แอดมิน → คีย์ → รายรอบ 3 เดือน)
};

// Packages and prices. Empty price = "สอบถามราคา". Keys are issued in แอดมิน → คีย์ with the same package.
export const PACKAGES: { key: "A" | "B" | "ALL"; name: string; desc: string; round: string; lifetime: string; best?: boolean }[] = [
  { key: "A", name: "แพ็กภาค ก", desc: "ความรู้ความสามารถทั่วไป: คิดวิเคราะห์ ภาษาอังกฤษ ข้าราชการที่ดี", round: "49 บาท", lifetime: "99 บาท" },
  { key: "B", name: "แพ็กภาค ข + วิชาเอก", desc: "วิชาการศึกษา กฎหมายการศึกษา และวิชาเอกทุกวิชา", round: "69 บาท", lifetime: "129 บาท" },
  { key: "ALL", name: "แพ็กครบทุกภาค", desc: "ภาค ก + ภาค ข + วิชาเอก คุ้มที่สุด", round: "99 บาท", lifetime: "179 บาท", best: true },
];
