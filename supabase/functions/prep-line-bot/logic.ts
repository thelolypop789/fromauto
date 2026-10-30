// Pure helpers for the LINE chat bot (no Deno / network here, so they can be unit-tested with node).
// Order of answers: preset reply when the message is one of its keywords → AI answer (Gemini) → DEFAULT_TEXT.

export type Price = { package: string; term: string; amount: number };

// Fallback when prep_prices cannot be read; the real prices live in prep.prices (same as src/prep/config.ts).
export const FALLBACK_PRICES: Price[] = [
  { package: "A", term: "round", amount: 49 }, { package: "A", term: "lifetime", amount: 99 },
  { package: "B", term: "round", amount: 69 }, { package: "B", term: "lifetime", amount: 129 },
  { package: "ALL", term: "round", amount: 99 }, { package: "ALL", term: "lifetime", amount: 179 },
];

const LINK = "https://sobprep.com/prep?src=line-oa";
const BUY = "https://sobprep.com/prep/buy?src=line-oa";

const amount = (prices: Price[], pkg: string, term: string) =>
  prices.find(p => p.package === pkg && p.term === term)?.amount ?? FALLBACK_PRICES.find(p => p.package === pkg && p.term === term)!.amount;

export const WELCOME_TEXT = `สวัสดีครับ 👋 ยินดีต้อนรับสู่ ซ้อมสอบ SOBPREP
แอปซ้อมข้อสอบครูผู้ช่วย ภาค ก · ภาค ข · วิชาเอก

✨ มีอะไรให้ใช้
✅ คลังข้อสอบพร้อมเฉลยละเอียดทุกข้อ
✅ สรุปแบบแผนผัง + แฟลชการ์ด
✅ สอบจำลองจับเวลา · ข้อสอบประจำวัน
✅ วิเคราะห์จุดอ่อน + คะแนนความพร้อมสอบ

🎁 ลองฟรี 3 ชุด ไม่ต้องสมัคร ล็อกอินด้วย Google ได้เลย
👉 ${LINK}

พิมพ์คำว่า
• "ราคา" ดูแพ็กทั้งหมด
• "วิธีซื้อ" ดูขั้นตอนซื้อ
• "คีย์" วิธีเปิดใช้คีย์
• "ล็อกอิน" ถ้าเข้าระบบไม่ได้
• "แอดมิน" คุยกับทีมงาน`;

// Prices come from prep.prices so this reply follows a price change without a deploy.
export const priceText = (p: Price[]) => `💰 แพ็กซ้อมสอบ SOBPREP

⭐ แพ็กครบทุกภาค (คุ้มที่สุด)
ภาค ก + ภาค ข + วิชาเอก
• รายรอบ 3 เดือน ${amount(p, "ALL", "round")} บาท
• ซื้อขาด ใช้ได้ทุกรอบสอบ ${amount(p, "ALL", "lifetime")} บาท

📘 แพ็กภาค ก
• รายรอบ ${amount(p, "A", "round")} บาท · ซื้อขาด ${amount(p, "A", "lifetime")} บาท

📗 แพ็กภาค ข + วิชาเอก
• รายรอบ ${amount(p, "B", "round")} บาท · ซื้อขาด ${amount(p, "B", "lifetime")} บาท

ทุกแพ็กได้: สร้างชุดข้อสอบไม่จำกัด · เฉลยละเอียด · สรุปแผนผัง + แฟลชการ์ด · สอบจำลอง
มีแพ็กอยู่แล้ว อัปเกรดจ่ายแค่ส่วนต่าง

🛒 ซื้อได้ที่ ${BUY}`;

const HOW_TO_BUY = `🛒 วิธีซื้อแพ็ก (ทำในแอปได้เลย)

1️⃣ เข้า ${BUY}
2️⃣ ล็อกอินด้วย Google
3️⃣ เลือกแพ็กและแบบ (รายรอบ / ซื้อขาด)
4️⃣ สแกน QR ที่ขึ้นมา ยอดเงินตรงตามแพ็กแล้ว ไม่ต้องพิมพ์เอง
5️⃣ แนบรูปสลิปในหน้าเดียวกัน แล้วกด "ส่งสลิป"

✅ ทีมงานตรวจและเปิดสิทธิ์ให้บัญชีนั้นอัตโนมัติ ไม่ต้องกรอกคีย์
⏱️ ปกติไม่กี่นาที (ช่วงกลางคืนอาจช้ากว่านี้)
ดูสถานะได้ด้านล่างหน้าซื้อ

📌 แนบสลิปในหน้าซื้อเท่านั้น ระบบจะผูกสลิปกับบัญชีของคุณ ทางแชตนี้เปิดสิทธิ์ให้ไม่ได้`;

// Slips are accepted in the app only (the order is tied to the account there); a slip sent in chat gets this.
export const SLIP_TEXT = `ขอบคุณครับ 🙏
รบกวนแนบสลิปในหน้าซื้อเท่านั้นนะครับ ระบบจะผูกกับบัญชีและเปิดสิทธิ์ให้อัตโนมัติ ทางแชตนี้เปิดสิทธิ์ให้ไม่ได้
👉 ${BUY}
(ล็อกอิน > เลือกแพ็กเดียวกับที่โอน > แนบสลิป > กด "ส่งสลิป" ไม่ต้องโอนซ้ำ)

ดูสถานะได้ด้านล่างหน้าซื้อ ถ้าแนบในแอปไม่ได้ พิมพ์ "แอดมิน" ครับ`;

const KEY_TEXT = `🔑 วิธีเปิดใช้คีย์ (PREP-XXXX-XXXX-XXXX)

1️⃣ เข้า ${LINK} แล้วล็อกอิน
2️⃣ แตะแท็บ "ฉัน" (มุมขวาล่าง)
3️⃣ ที่การ์ด "มีคีย์แล้ว? เปิดใช้งาน" กรอกคีย์แล้วกดเปิดใช้

คีย์ใช้ได้ 1 บัญชีเท่านั้น ใช้แล้วสิทธิ์ขึ้นทันที
ถ้ากรอกแล้วขึ้นว่าใช้ไม่ได้ พิมพ์ "แอดมิน" แล้วส่งรูปหน้าจอมาได้เลยครับ`;

const LOGIN_TEXT = `🔐 ถ้าล็อกอินไม่ได้ ลองตามนี้ครับ

📱 เปิดลิงก์จาก LINE / Facebook แล้วกด Google ไม่ได้
Google ไม่อนุญาตให้ล็อกอินในเบราว์เซอร์ของแอปเหล่านี้
👉 แตะ ⋯ มุมขวาบน แล้วเลือก "เปิดในเบราว์เซอร์" (Safari หรือ Chrome)
หรือคัดลอกลิงก์ไปวางใน Safari / Chrome
${LINK}

💡 ล็อกอินแล้ว "เพิ่มลงหน้าจอโฮม" ไว้ จะเปิดเหมือนแอปได้เลย

ยังไม่ได้ พิมพ์ "แอดมิน" แล้วบอกรุ่นมือถือมาได้เลยครับ`;

const SUMMARY_TEXT = `📚 สรุปแบบแผนผัง + แฟลชการ์ด
• ภาค ก 26 เรื่อง · ภาค ข 19 เรื่อง
• วิชาเอกอุตสาหกรรมศิลป์ 10 เรื่อง (วิชาเอกอื่นกำลังทยอยเพิ่ม)
อ่านภาพเดียวจบเรื่อง แล้วท่องด้วยแฟลชการ์ด กดฝึกข้อสอบเรื่องนั้นต่อได้ทันที

🎁 อ่านฟรีวิชาละ 1 เรื่อง
👉 https://sobprep.com/prep/summary?src=line-oa`;

const MOCK_TEXT = `⏱️ สอบจำลองเสมือนจริง
จำนวนข้อและเวลาเท่าสนามจริง แบ่งตามวิชา
ส่งแล้วได้คะแนนรายหมวด เทียบกับผู้สอบคนอื่น และข้อที่ผิดจะไปอยู่ในรายการทบทวน

🎁 ภาษาอังกฤษ ภาค ก ลองฟรี 1 ครั้ง
👉 https://sobprep.com/prep/mock?src=line-oa`;

export const ADMIN_TEXT = `รับทราบครับ 🙋 ทีมงานจะตอบกลับโดยเร็วที่สุด
ระหว่างรอ รบกวนพิมพ์รายละเอียดไว้ได้เลย เช่น
• อีเมลที่ใช้ล็อกอิน
• ปัญหาที่เจอ หรือรูปหน้าจอ

แจ้งข้อสอบผิด / เฉลยผิด: กด "รายงานข้อนี้" ใต้เฉลยในแอปได้เลย ทีมงานจะตรวจและแจ้งผลในแอป`;

export const DEFAULT_TEXT = `ขอบคุณที่ทักมาครับ 😊
พิมพ์คำว่า
• "ราคา" ดูแพ็กทั้งหมด
• "วิธีซื้อ" ขั้นตอนซื้อและโอน
• "คีย์" วิธีเปิดใช้คีย์
• "ล็อกอิน" ถ้าเข้าระบบไม่ได้
• "สรุป" สรุปเนื้อหา + แฟลชการ์ด
• "แอดมิน" คุยกับทีมงาน

🎁 ลองฟรี 3 ชุด: ${LINK}`;

type Preset = { id: string; keywords: string[]; text: (p: Price[]) => string };
export const PRESETS: Preset[] = [
  { id: "price", keywords: ["ราคา", "แพ็ก", "แพ็กเกจ", "กี่บาท", "ค่าใช้จ่าย"], text: priceText },
  { id: "buy", keywords: ["วิธีซื้อ", "ซื้อ", "โอน", "จ่ายเงิน", "ชำระ", "สมัคร"], text: () => HOW_TO_BUY },
  { id: "slip", keywords: ["สลิป", "โอนแล้ว", "จ่ายแล้ว", "ส่งสลิป"], text: () => SLIP_TEXT },
  { id: "key", keywords: ["คีย์", "โค้ด", "เปิดใช้", "กรอกคีย์", "key"], text: () => KEY_TEXT },
  { id: "login", keywords: ["ล็อกอิน", "เข้าไม่ได้", "login", "เข้าระบบ", "google"], text: () => LOGIN_TEXT },
  { id: "summary", keywords: ["สรุป", "แฟลชการ์ด", "แผนผัง", "ชีท"], text: () => SUMMARY_TEXT },
  { id: "mock", keywords: ["สอบจำลอง", "mock", "จับเวลา"], text: () => MOCK_TEXT },
  { id: "admin", keywords: ["แอดมิน", "ติดต่อ", "สอบถาม", "ปัญหา"], text: () => ADMIN_TEXT },
];

// Same rule as LINE OA Manager keywords: the whole message must be the keyword. Spaces, case, a trailing
// ครับ/ค่ะ/คะ/จ้า and punctuation are ignored, so "ราคา ครับ?" still matches but "ซื้อแล้วใช้ได้นานไหม" goes to the AI.
export function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "").replace(/[?!.。…~]+$/u, "").replace(/(ครับ|คับ|ค่ะ|คะ|จ้า|จ้ะ|นะ)+$/u, "").replace(/[?!.。…~]+$/u, "");
}

export function matchPreset(message: string): Preset | null {
  const m = normalize(message);
  if (!m) return null;
  return PRESETS.find(p => p.keywords.some(k => normalize(k) === m)) ?? null;
}

// The AI sees the same facts as the presets, so a free-form question gets an answer that agrees with them.
export function systemPrompt(prices: Price[]): string {
  return `คุณคือแอดมินตอบแชท LINE ของ "ซ้อมสอบ SOBPREP" แอปซ้อมข้อสอบครูผู้ช่วย
กติกา:
- ตอบภาษาไทย สุภาพ เป็นกันเอง ใช้ "ครับ" สั้น กระชับ อ่านง่ายบนมือถือ ไม่ใช้ markdown (ห้ามใช้ ** หรือ #) ใช้อีโมจิได้เล็กน้อย
- ตอบจากข้อมูลด้านล่างเท่านั้น ห้ามเดาหรือแต่งราคา ส่วนลด วันสอบ หรือเงื่อนไขที่ไม่มีในข้อมูล
- ถ้าไม่มีข้อมูล เรื่องบัญชี/สิทธิ์ที่ต้องตรวจสอบ หรือลูกค้าอยากคุยกับคน ให้บอกให้พิมพ์คำว่า "แอดมิน" แล้วทีมงานจะตอบในแชทนี้
- ดูประวัติการคุยก่อนหน้าเพื่อเข้าใจคำถามต่อเนื่อง ไม่ต้องทักทายซ้ำ
- ห้ามบอกว่าข้อสอบเป็นข้อสอบจริง หรือรับประกันผลสอบ
- ใส่ลิงก์ตามที่ให้ไว้เท่านั้น (มี ?src=line-oa ทุกอัน) ห้ามแต่งลิงก์ใหม่
- ถ้าลูกค้าถามเนื้อหาวิชา อธิบายสั้น ๆ ได้ แล้วชวนไปฝึกในแอป

ข้อมูลบริการ:
- SOBPREP เตรียมสอบครูผู้ช่วย สพฐ. และอาชีวศึกษา (สอศ.) ครบภาค ก ภาค ข และวิชาเอก เฉลยพร้อมเหตุผลทุกข้อ
- เข้าใช้: ${LINK} บนมือถือหรือคอม ล็อกอินด้วย Google ไม่ต้องสมัคร "เพิ่มลงหน้าจอโฮม" เปิดเหมือนแอปได้ ข้อมูลผูกกับบัญชี Google ใช้ได้ทุกเครื่อง
- ล็อกอินไม่ได้เมื่อเปิดจาก LINE/Facebook: Google ไม่ให้ล็อกอินในเบราว์เซอร์ของแอปเหล่านี้ ให้แตะ ⋯ มุมขวาบน > เปิดในเบราว์เซอร์ (Safari/Chrome)
- คลังข้อสอบกว่า 11,000 ข้อ: ภาค ก กว่า 2,700 ข้อ (คิดวิเคราะห์ ภาษาอังกฤษ ข้าราชการที่ดี), ภาค ข กว่า 1,400 ข้อ (วิชาชีพครู หลักสูตร การวัดและประเมินผล กฎหมายการศึกษา; สอศ. มีหลักสูตรอาชีวะ ทวิภาคี ประกันคุณภาพ พ.ร.บ.การอาชีวศึกษา), วิชาเอกกว่า 7,000 ข้อ
- วิชาเอก สพฐ. 17 วิชา: ภาษาไทย อุตสาหกรรมศิลป์ คณิตศาสตร์ ภาษาอังกฤษ เคมี ชีววิทยา ฟิสิกส์ วิทยาศาสตร์ทั่วไป สังคมศึกษา ปฐมวัย ประถมศึกษา การศึกษาพิเศษ คอมพิวเตอร์ ดนตรี ศิลปศึกษา พลศึกษา นาฏศิลป์
- สอศ. 5 สาขา: ช่างไฟฟ้ากำลัง ช่างยนต์ ช่างกลโรงงานและเทคนิคการผลิต การบัญชี คอมพิวเตอร์ธุรกิจและเทคโนโลยีสารสนเทศ วิชาอื่นกำลังทยอยเพิ่ม ลูกค้าบอกได้ว่าอยากได้วิชาไหน
- ฟีเจอร์: สอบจำลองจับเวลาเท่าสนามจริง (https://sobprep.com/prep/mock?src=line-oa), คะแนนรายหมวดเทียบเกณฑ์ 60%, คะแนนความพร้อมสอบ + หมวดที่ควรฝึก, ทวนข้อผิดอัตโนมัติ, สรุปแผนผัง + แฟลชการ์ด ภาค ก 26 เรื่อง ภาค ข 19 เรื่อง วิชาเอกอุตสาหกรรมศิลป์ 10 เรื่อง (https://sobprep.com/prep/summary?src=line-oa), ข้อสอบประจำวัน 10 ข้อฟรี, เลือกหมวดเอง, แนวข้อสอบตามปี (สพฐ. 2566, สอศ. 2565/2567), ปฏิทินสอบนับถอยหลัง, เลเวลและอันดับ
- ลองฟรี: สร้างชุดข้อสอบได้ 3 ชุด ชุดละไม่เกิน 40 ข้อ + ข้อสอบประจำวัน 10 ข้อทุกวัน + สอบจำลองภาษาอังกฤษ ภาค ก 1 ครั้ง + สรุปวิชาละ 1 เรื่อง
- มีแพ็ก: สร้างชุดไม่จำกัด ชุดละสูงสุด 200 ข้อ ทวนข้อผิดทุกข้อ สอบจำลองครบตามภาคที่ซื้อ สรุปทุกเรื่อง แนวข้อสอบทุกชุด
- ราคา: แพ็กครบทุกภาค รายรอบ 3 เดือน ${amount(prices, "ALL", "round")} / ซื้อขาด ${amount(prices, "ALL", "lifetime")} บาท; แพ็กภาค ก ${amount(prices, "A", "round")} / ${amount(prices, "A", "lifetime")} บาท; แพ็กภาค ข + วิชาเอก ${amount(prices, "B", "round")} / ${amount(prices, "B", "lifetime")} บาท
- รายรอบใช้ได้ 3 เดือน ซื้อขาดใช้ได้ทุกรอบสอบ มีแพ็กอยู่แล้วอัปเกรดจ่ายแค่ส่วนต่าง ซื้อเป็นกลุ่ม 2 คน ลด 20%, 5 คน ลด 30%
- วิธีซื้อ: เข้า ${BUY} ล็อกอิน Google เลือกแพ็กและแบบ สแกน QR (ยอดตรงแล้ว) แนบสลิปในหน้าเดียวกันแล้วกด "ส่งสลิป" ทีมงานเปิดสิทธิ์ให้บัญชีนั้นอัตโนมัติ ไม่ต้องกรอกคีย์ ปกติไม่กี่นาที (กลางคืนอาจช้ากว่า) ดูสถานะด้านล่างหน้าซื้อ
- สลิปรับเฉพาะในหน้าซื้อเท่านั้น ห้ามรับสลิปหรือรับปากว่าจะเปิดสิทธิ์ทางแชท ถ้าลูกค้าโอนแล้วให้ไปแนบสลิปในหน้าซื้อ (เลือกแพ็กเดียวกับที่โอน ไม่ต้องโอนซ้ำ) ถ้าแนบไม่ได้จริงให้พิมพ์ "แอดมิน"
- คีย์ (PREP-XXXX-XXXX-XXXX): ล็อกอิน > แท็บ "ฉัน" มุมขวาล่าง > การ์ด "มีคีย์แล้ว? เปิดใช้งาน" คีย์ใช้ได้ 1 บัญชี สิทธิ์ขึ้นทันที
- แจ้งข้อสอบ/เฉลยผิด: กด "รายงานข้อนี้" ใต้เฉลยในแอป
- ข้อสอบเป็นข้อสอบฝึกตามหัวข้อที่ออกสอบ ไม่ใช่ข้อสอบจริง ไม่รับประกันว่าจะออกสอบหรือผลสอบ`;
}

export type Turn = { role: "user" | "assistant"; content: string };

// History comes back from the database as JSON: keep only well-formed turns so a bad row cannot break the AI call.
export function aiMessages(system: string, history: unknown, text: string): { role: string; content: string }[] {
  const past = (Array.isArray(history) ? history : []).filter((t): t is Turn =>
    !!t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.length > 0);
  return [{ role: "system", content: system }, ...past.map(t => ({ role: t.role, content: t.content.slice(0, 3000) })),
    { role: "user", content: text.slice(0, 2000) }];
}

// LINE signs the raw body with HMAC-SHA256(channel secret), base64. Constant-time compare.
export function signatureOk(expectedB64: string, got: string | null): boolean {
  if (!got || got.length !== expectedB64.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expectedB64.charCodeAt(i);
  return diff === 0;
}

// LINE text is plain: strip markdown the model may still add, cap under LINE's 5,000-char limit, never empty.
export function cleanReply(s: unknown): string {
  const t = String(s ?? "")
    .replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#{1,6}\s+/gm, "")
    .replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return t.slice(0, 4900);
}
