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

const PACK_NAME: Record<string, string> = { A: "แพ็กภาค ก", B: "แพ็กภาค ข + วิชาเอก", ALL: "แพ็กครบทุกภาค" };
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

// ---------- promo codes the bot may talk about ----------

// Codes announced to customers (LINE broadcast, posts). Their live state comes from prep_bot_promos, so the bot stops
// offering a code once it is used up, expired or switched off. Add a code here when announcing a new one.
export const ANNOUNCED_PROMOS = ["SOB10"];
export type PromoStatus = { code: string; kind: "amount" | "percent"; value: number; packages: string[] | null;
  expires_at: string | null; active: boolean; left: number | null };

const promoOff = (p: PromoStatus) => p.kind === "percent" ? `ลด ${p.value}%` : `ลด ${p.value} บาท`;
const promoUntil = (p: PromoStatus) => p.expires_at
  ? " ใช้ได้ถึง " + new Date(new Date(p.expires_at).getTime() - 1).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }) : "";
const promoFor = (p: PromoStatus) => p.packages?.length ? " เฉพาะ" + p.packages.map(k => PACK_NAME[k] ?? k).join(", ") : " ทุกแพ็ก";

// One line per code for the AI.
export function promoLines(ps: PromoStatus[]): string {
  if (!ps.length) return "- ตอนนี้ไม่มีโค้ดส่วนลด";
  return ps.map(p => p.active
    ? `- โค้ด ${p.code}: ${promoOff(p)}${promoFor(p)}${p.left != null ? ` เหลือ ${p.left} สิทธิ์` : ""}${promoUntil(p)} คนละ 1 ครั้ง กรอกที่ช่องโค้ดในหน้าซื้อ หรือกดลิงก์ ${BUY.replace("?", `?promo=${p.code}&`)}`
    : `- โค้ด ${p.code}: หมดแล้ว (ครบจำนวนหรือหมดเวลา) ห้ามเสนอโค้ดนี้`).join("\n");
}

// The "โปร" preset: the live codes, with the price each package comes to.
export function promoText(ps: PromoStatus[], prices: Price[]): string {
  const live = ps.filter(p => p.active);
  if (!live.length) return `ตอนนี้ยังไม่มีโค้ดส่วนลดครับ 🙏\nติดตามโปรใหม่ได้ในแชทนี้ หรือดูราคาแพ็กพิมพ์ "ราคา"\n🎁 ลองฟรี 3 ชุด: ${LINK}`;
  return live.map(p => {
    const after = (pkg: string, term: string) => {
      const a = amount(prices, pkg, term);
      return Math.max(1, p.kind === "percent" ? Math.round(a * (100 - p.value) / 100) : a - p.value);
    };
    const pk = (k: string) => !p.packages?.length || p.packages.includes(k);
    const lines = [
      pk("ALL") ? `⭐ แพ็กครบทุกภาค เหลือ ${after("ALL", "round")} บาท (จาก ${amount(prices, "ALL", "round")})` : "",
      pk("A") ? `📘 ภาค ก เหลือ ${after("A", "round")} บาท` : "",
      pk("B") ? `📗 ภาค ข + วิชาเอก เหลือ ${after("B", "round")} บาท` : "",
    ].filter(Boolean);
    return `🎉 โค้ด ${p.code} ${promoOff(p)}${p.left != null ? ` · เหลือ ${p.left} สิทธิ์` : ""}${promoUntil(p)}

${lines.join("\n")}
(ราคารายรอบ 3 เดือน ซื้อขาดก็ลดเท่ากัน คนละ 1 ครั้ง)

👉 กดลิงก์นี้ โค้ดใส่ให้อัตโนมัติ
${BUY.replace("?", `?promo=${p.code}&`)}`;
  }).join("\n\n");
}

type Preset = { id: string; keywords: string[]; text: (p: Price[], promos?: PromoStatus[]) => string };
export const PRESETS: Preset[] = [
  { id: "price", keywords: ["ราคา", "แพ็ก", "แพ็กเกจ", "กี่บาท", "ค่าใช้จ่าย"], text: priceText },
  { id: "buy", keywords: ["วิธีซื้อ", "ซื้อ", "โอน", "จ่ายเงิน", "ชำระ", "สมัคร"], text: () => HOW_TO_BUY },
  { id: "slip", keywords: ["สลิป", "โอนแล้ว", "จ่ายแล้ว", "ส่งสลิป"], text: () => SLIP_TEXT },
  // "โค้ด" alone is not a keyword: since the SOB10 broadcast it usually means a discount code, so the AI answers it.
  { id: "key", keywords: ["คีย์", "เปิดใช้", "กรอกคีย์", "key"], text: () => KEY_TEXT },
  { id: "promo", keywords: ["โปร", "โปรโมชัน", "โปรโมชั่น", "ส่วนลด", "โค้ดลด", "โค้ดส่วนลด", "sob10"], text: (p, ps) => promoText(ps ?? [], p) },
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
export function systemPrompt(prices: Price[], promos: PromoStatus[] = []): string {
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
- ข้อสอบเป็นข้อสอบฝึกตามหัวข้อที่ออกสอบ ไม่ใช่ข้อสอบจริง ไม่รับประกันว่าจะออกสอบหรือผลสอบ
- "คีย์" (PREP-XXXX) คือรหัสเปิดสิทธิ์ ต่างจาก "โค้ดส่วนลด" ที่กรอกตอนซื้อ ถ้าลูกค้าพูดว่า "โค้ด" เฉย ๆ ให้ดูบริบทหรือถามกลับสั้น ๆ
- โค้ดส่วนลดตอนนี้ (บอกเฉพาะที่ยังใช้ได้ ห้ามแต่งโค้ดอื่น):
${promoLines(promos)}`;
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

// ---------- in-app chat (action "chat") ----------

export const APP_DAILY_LIMIT = 40; // messages per user per Bangkok day; each AI answer costs money
export const APP_LIMIT_TEXT = `วันนี้คุยครบ ${APP_DAILY_LIMIT} ข้อความแล้วครับ พรุ่งนี้คุยต่อได้ ถ้าเรื่องด่วน กดปุ่ม "คุยกับแอดมินทาง LINE" ได้เลย`;
export const APP_ADMIN_TEXT = `ได้เลยครับ 🙋 กดปุ่ม "คุยกับแอดมินทาง LINE" ด้านล่าง แล้วพิมพ์อีเมลที่ใช้ล็อกอินกับรายละเอียดไว้ ทีมงานจะตอบโดยเร็วที่สุด`;

export type AppContext = {
  email?: string;
  me?: { plan?: string; free_sets_used?: number; free_sets_limit?: number; packages?: { package: string; expires_at: string | null }[] } | null;
  orders?: { package: string; term: string; amount: number; status: string; admin_note?: string | null; created_at: string; reviewed_at?: string | null; access_until?: string | null }[] | null;
  readiness?: { overall: number | null; answered?: number; sections?: { section: string; pct: number }[]; focus?: { name: string; subject: string; pct: number }[] } | null;
};

const PKG: Record<string, string> = { A: "แพ็กภาค ก", B: "แพ็กภาค ข + วิชาเอก", ALL: "แพ็กครบทุกภาค" };
const ORDER_STATUS: Record<string, string> = { pending: "รอตรวจสลิป", approved: "อนุมัติแล้ว", rejected: "ไม่ผ่าน" };
const thDate = (s: string | null | undefined) => s ? new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }) : "";

// What the bot may know about the signed-in customer. Read with the customer's own token, so it is only their data.
export function contextText(c: AppContext): string {
  const out: string[] = [];
  const pk = c.me?.packages ?? [];
  out.push(`- แผน: ${c.me?.plan === "paid" ? "มีแพ็ก" : "ใช้ฟรี"}${pk.length ? " · " + pk.map(p => `${PKG[p.package] ?? p.package} (${p.expires_at ? "ถึง " + thDate(p.expires_at) : "ซื้อขาด"})`).join(", ") : ""}`);
  if (c.me?.plan !== "paid" && c.me?.free_sets_limit != null) out.push(`- ชุดฟรีเหลือ ${Math.max(0, c.me.free_sets_limit - (c.me.free_sets_used ?? 0))} จาก ${c.me.free_sets_limit} ชุด`);
  const orders = (c.orders ?? []).slice(0, 5);
  out.push(orders.length
    ? "- คำสั่งซื้อล่าสุด:\n" + orders.map(o => `  • ${thDate(o.created_at)} ${PKG[o.package] ?? o.package} ${o.term === "lifetime" ? "ซื้อขาด" : "รายรอบ"} ${o.amount} บาท: ${ORDER_STATUS[o.status] ?? o.status}${o.admin_note ? ` (หมายเหตุแอดมิน: ${o.admin_note})` : ""}`).join("\n")
    : "- ยังไม่มีคำสั่งซื้อ");
  const r = c.readiness;
  if (r && r.overall != null) {
    out.push(`- ความพร้อมสอบ ${r.overall}% จาก ${r.answered ?? 0} ข้อที่ทำ${r.sections?.length ? " (" + r.sections.map(s => `ภาค ${s.section === "A" ? "ก" : "ข"} ${s.pct}%`).join(", ") + ")" : ""}`);
    if (r.focus?.length) out.push(`- หมวดที่ควรฝึกก่อน: ${r.focus.slice(0, 3).map(f => `${f.name} (${f.subject}, ${f.pct}%)`).join(", ")}`);
  } else out.push("- ยังทำข้อสอบไม่พอจะประเมินความพร้อม");
  return out.join("\n");
}

// The LINE prompt, adjusted for the in-app chat: the customer is signed in, a human is reached through LINE.
export function appSystemPrompt(prices: Price[], c: AppContext, promos: PromoStatus[] = []): string {
  return systemPrompt(prices, promos)
    .replace('คุณคือแอดมินตอบแชท LINE ของ "ซ้อมสอบ SOBPREP"', 'คุณคือผู้ช่วยแชทในแอป "ซ้อมสอบ SOBPREP"')
    .replace('ให้บอกให้พิมพ์คำว่า "แอดมิน" แล้วทีมงานจะตอบในแชทนี้', 'ให้บอกให้กดปุ่ม "คุยกับแอดมินทาง LINE" ใต้แชทนี้')
    .replace('(มี ?src=line-oa ทุกอัน)', '')
    .replaceAll("src=line-oa", "src=app-chat")
    .replace(/ถ้าแนบไม่ได้จริงให้พิมพ์ "แอดมิน"/, 'ถ้าแนบไม่ได้จริงให้กดปุ่ม "คุยกับแอดมินทาง LINE"')
    + `

ข้อมูลบัญชีของลูกค้าที่กำลังคุยอยู่ (ล็อกอินแล้ว ใช้ตอบเรื่องของลูกค้าคนนี้ได้ เช่น สถานะสลิป วันหมดอายุ หมวดที่ควรฝึก ห้ามเดาเกินจากนี้):
${contextText(c)}
- สถานะ "รอตรวจสลิป" ปกติไม่กี่นาที กลางคืนอาจช้ากว่า ถ้ารอนานผิดปกติหรือ "ไม่ผ่าน" ให้กดปุ่มคุยกับแอดมินทาง LINE`;
}

// ---------- daily summary (action "summarize") ----------

export type DayTurn = { role: string; content: string; src?: string | null };
export type DayData = { stats: Record<string, number>; conversations: { channel: string; turns: DayTurn[] }[] };

// The day's chats as plain text for the model, capped so a busy day stays within one request.
export function transcript(d: DayData, maxChars = 60_000): string {
  let out = "";
  d.conversations.forEach((c, i) => {
    const block = `\n### แชท ${i + 1} (${c.channel === "app" ? "ในแอป" : "LINE"})\n` + c.turns.map(t =>
      `${t.role === "user" ? "ลูกค้า" : `บอท${t.src && t.src !== "ai" ? ` [${t.src}]` : ""}`}: ${t.content.replace(/\s+/g, " ").slice(0, 400)}`).join("\n");
    if (out.length + block.length <= maxChars) out += block;
  });
  return out.trim();
}

export function summaryPrompt(day: string, d: DayData): string {
  const s = d.stats;
  return `สรุปแชทลูกค้าของ "ซ้อมสอบ SOBPREP" วันที่ ${day} ให้แอดมินอ่าน (ภาษาไทย กระชับ เป็นข้อ ๆ ไม่ใช้ตาราง)
สถิติ: ${s.conversations} แชท (LINE ${s.line_conversations}, ในแอป ${s.app_conversations}), ลูกค้าพิมพ์ ${s.messages} ข้อความ, AI ตอบ ${s.ai}, พรีเซต ${s.preset}, ขอคุยกับแอดมิน ${s.handoff}, ระบบขัดข้อง ${s.fallback}

หัวข้อที่ต้องมี:
1. ลูกค้าถามเรื่องอะไรบ้าง (จัดกลุ่ม เรียงจากมากไปน้อย พร้อมจำนวนโดยประมาณ)
2. ต้องติดตาม: ลูกค้าที่ขอคุยกับแอดมิน มีปัญหาสลิป/สิทธิ์/ล็อกอิน หรือยังไม่ได้คำตอบ (บอกว่าแชทที่เท่าไหร่ และเรื่องอะไร)
3. บอทตอบไม่ได้หรือตอบไม่ดี (ยกตัวอย่างคำถาม)
4. ข้อเสนอแนะ: ข้อมูลที่ควรเพิ่มให้บอท หรือสิ่งที่ควรปรับในแอป/ราคา/ขั้นตอน
ถ้าหัวข้อไหนไม่มี เขียนว่า "ไม่มี" ห้ามใส่อีเมลหรือข้อมูลส่วนตัวของลูกค้าในสรุป

แชททั้งหมด:
${transcript(d)}`;
}

// ---------- LINE: one answer per burst of messages ----------

export type Pending = { kind: "text" | "media"; text: string };
export type BurstPlan =
  | { type: "slip"; said: string[] }                          // only pictures/files: most likely a slip
  | { type: "preset"; id: string; said: string[] }            // one message and it is a keyword (or แอดมิน anywhere)
  | { type: "ai"; said: string[]; question: string };         // everything else, asked as one question

// What the customer said in this burst, in order, and how to answer it. แอดมิน anywhere in the burst hands over.
export function planBurst(rows: Pending[]): BurstPlan {
  const said = rows.map(r => r.kind === "media" ? "[ส่งรูป/ไฟล์]" : r.text.trim()).filter(Boolean);
  const texts = rows.filter(r => r.kind === "text" && r.text.trim()).map(r => r.text.trim());
  const media = rows.some(r => r.kind === "media");
  if (!texts.length) return { type: "slip", said };
  if (texts.some(t => matchPreset(t)?.id === "admin")) return { type: "preset", id: "admin", said };
  if (texts.length === 1 && !media) {
    const p = matchPreset(texts[0]);
    if (p) return { type: "preset", id: p.id, said };
  }
  const question = (texts.length === 1 ? texts[0] : "ลูกค้าส่งมาหลายข้อความติดกัน ตอบรวมครั้งเดียว:\n" + texts.map(t => "- " + t).join("\n"))
    + (media ? "\n(ลูกค้าส่งรูปหรือไฟล์มาด้วย ถ้าน่าจะเป็นสลิป ให้แนบในหน้าซื้อเท่านั้น)" : "");
  return { type: "ai", said, question };
}
