// Pure helpers for prep-import (no Deno APIs, so they can be unit-tested with node).

export type TopicInfo = { code: string; name: string };
export type Mode = "auto" | "extract" | "generate";

export type DraftQuestion = {
  topic: string;
  level: "remember" | "understand" | "apply" | "analyze";
  stem: string;
  choices: string[];
  answer: number;
  explanation: string;
  law_ref: string | null;
  needs_review: boolean;
  kind: "extracted" | "generated";
};

export const LEVELS = ["remember", "understand", "apply", "analyze"] as const;

export function buildPrompt(mode: Mode, topics: TopicInfo[], opts: { count: number; hint: string; pages?: string; avoid?: string[] }): string {
  const topicList = topics.map(t => `- ${t.code}: ${t.name}`).join("\n");
  const extractRules = `- ถ้าเอกสารมีเฉลย (ท้ายไฟล์ ไฮไลต์ ตัวหนา สีตัวอักษร) ให้ใช้เฉลยนั้น\n`
    + `- ถ้าไม่มีเฉลย ให้ตอบเองเฉพาะข้อที่มั่นใจ และตั้ง needs_review=true; ข้อที่ไม่มั่นใจให้ข้ามไป\n`
    + `- ตัวเลือกไม่ครบ 4 ข้อ ให้ข้ามข้อนั้น; ข้อที่คัดจากต้นฉบับให้ตั้ง kind="extracted"`;
  const generateRules = `- แต่งข้อสอบปรนัย 4 ตัวเลือกให้ครอบคลุมทุกข้อเท็จจริง แนวคิด หลักการ และการนำไปใช้ที่ออกสอบได้ในเนื้อหา `
    + `ไม่จำกัดจำนวนรวม ยิ่งเนื้อหาเยอะยิ่งต้องได้หลายข้อ (ข้อเท็จจริงหนึ่งอาจถามได้หลายมุม เช่น ความหมาย ผู้มีอำนาจ ระยะเวลา ลำดับขั้น การนำไปใช้ในสถานการณ์)\n`
    + `- ข้อที่แต่งใหม่ให้ตั้ง kind="generated"`;
  const task = mode === "extract"
    ? `เอกสารนี้เป็นข้อสอบ ให้คัดลอกข้อสอบแบบปรนัยทุกข้อที่พบออกมาตามต้นฉบับให้มากที่สุด\n${extractRules}`
    : mode === "generate"
      ? `เอกสารนี้เป็นเอกสารสรุปเนื้อหา\n${generateRules}`
      : `เอกสารนี้อาจมีทั้งเนื้อหาและข้อสอบปะปนกัน ให้ทำทั้งสองอย่าง:\n`
        + `ก) ข้อสอบที่มีอยู่ในเอกสาร ให้คัดลอกออกมาทุกข้อ\n${extractRules}\n`
        + `ข) ส่วนที่เป็นเนื้อหา ให้แต่งข้อสอบเพิ่ม\n${generateRules}\n`
        + `ห้ามแต่งข้อใหม่ที่ซ้ำประเด็นกับข้อสอบที่คัดมา`;
  const avoid = opts.avoid?.length
    ? `\nข้อต่อไปนี้ทำไปแล้วในรอบก่อน ห้ามซ้ำ และห้ามถามประเด็นเดียวกันซ้ำในมุมเดิม (ให้ทำส่วนที่ยังไม่ได้ทำต่อ):\n${opts.avoid.map(a => "- " + a).join("\n")}\n`
    : "";
  const batch = `\nรอบนี้ส่งไม่เกิน ${opts.count} ข้อ แล้วตั้ง more=true ถ้ายังมีข้อสอบในเอกสารที่ยังไม่ได้คัด หรือยังมีเนื้อหาที่ออกข้อสอบได้อีกโดยไม่ซ้ำ; ตั้ง more=false เมื่อครอบคลุมครบแล้ว`;
  return `คุณเป็นผู้เขียนข้อสอบครูผู้ช่วย (ก.ค.ศ.) ภาษาไทย
${task}${batch}${avoid}
${opts.pages ? `ให้ใช้เฉพาะเนื้อหาในช่วงที่ส่งมานี้ (${opts.pages})\n` : ""}${opts.hint ? `คำแนะนำจากผู้ดูแล: ${opts.hint}\n` : ""}
กฎเหล็ก
1. ใช้เฉพาะข้อเท็จจริงที่ปรากฏในเอกสาร ห้ามแต่งเลขมาตรา ปี ตัวเลข ชื่อ ที่ไม่มีในเอกสาร ถ้าเอกสารกำกวมให้ข้ามข้อเท็จจริงนั้น
2. choices ต้องมี 4 ข้อพอดี ไม่มีตัวนำหน้า ก. ข. หรือ 1. 2. answer คือ index (เริ่มจาก 0) ของข้อที่ถูกเพียงข้อเดียว
3. ตัวเลือกจะถูกสลับตำแหน่งตอนแสดงผล ห้ามเขียนว่า "ถูกทุกข้อ" "ไม่มีข้อใดถูก" "ข้อ ก และ ข" หรืออ้างถึงตัวเลือกอื่น
4. ตัวลวงต้องสมเหตุสมผล ชนิดเดียวกับคำตอบ แต่ผิดชัดเจน
5. โจทย์ต้องอ่านเข้าใจได้ในตัวเอง ห้ามอ้างถึงรูปภาพหรือข้อก่อนหน้า ถ้าต้นฉบับมีตาราง กราฟ หรือรูปที่จำเป็นต่อการตอบ ให้ถอดข้อมูลเป็นข้อความในโจทย์ (เช่น ตารางเป็นบรรทัด) ถ้าถอดไม่ได้ให้ข้ามข้อนั้น
   เอกสารอาจเป็นภาพถ่าย/สแกน ให้อ่านตัวอักษรอย่างระมัดระวัง ถ้าอ่านไม่ชัดให้ตั้ง needs_review=true หรือข้าม
6. explanation 1-3 ประโยค เขียนแบบตำราเรียนที่เป็นทางการ บอกว่าทำไมข้อนั้นถูก (และตัวลวงที่น่าสับสนผิดเพราะอะไร)
   ห้ามอ้างถึงแหล่งที่มา เช่น "ชีทระบุว่า" "ตามเอกสาร" "ตามเนื้อหา" "ผู้บรรยาย" ให้เขียนเป็นข้อเท็จจริงโดยตรง และห้ามใส่หมายเหตุภายใน เช่น อ่านไม่ชัด หรือควรตรวจสอบ (ให้ใช้ needs_review แทน)
7. law_ref ใส่เฉพาะเมื่อเอกสารระบุมาตรา+กฎหมาย+ปี ไม่เช่นนั้นใส่ null
8. needs_review=true ถ้าต้องเดาหรืออนุมานอะไรที่ไม่ได้เขียนไว้ตรงๆ หรือเอกสารอ่านยาก
9. ข้อ "ข้อใดไม่ใช่" ไม่เกิน 25% ห้ามมีข้อซ้ำหรือใกล้เคียงกัน
11. แนวข้อสอบครูผู้ช่วยจริงถามสาระและการนำไปใช้ ไม่ถามให้จำเลขมาตรา เลขอนุมาตรา หรือเลขคำพิพากษาฎีกา
    ห้ามสร้างข้อที่คำตอบหรือตัวเลือกเป็นเลขมาตรา และห้ามขึ้นต้นโจทย์ด้วย "ตามมาตรา..." หรือ "ตามคำพิพากษาฎีกาที่..." ให้ถามถึงสาระของกฎหมายแทน (เช่น สิทธิ หน้าที่ ระยะเวลา ผู้มีอำนาจ)
    ในโหมดคัดข้อ ข้อเดิมที่ถามเลขมาตราหรือเลขฎีกาให้ข้ามไป
12. ห้ามเขียนในโจทย์ว่า "ตามชีท" "ตามเอกสารประกอบการบรรยาย" ให้อ้างชื่อกฎหมายหรือหลักสูตรโดยตรงแทน
13. ห้ามสร้างข้อที่ถามเกี่ยวกับตัวไฟล์ เช่น หน้าที่เท่าไร มีกี่ข้อ หัวข้อใดมาก่อน และห้ามถามถึง "ข้อความ/บทความ/เรื่องที่อ่าน" ที่ไม่ได้อยู่ในโจทย์ ผู้เรียนไม่เห็นไฟล์ต้นฉบับ
    ข้ออ่านจับใจความต้องใส่ข้อความที่ต้องอ่านไว้ในโจทย์ให้ครบ (ขึ้นต้นด้วยข้อความ แล้วตามด้วยคำถาม) ถ้าข้อความยาวเกินไปหรือถอดไม่ครบให้ข้ามข้อนั้น
10. level เลือก remember/understand/apply/analyze

เลือก topic จากรายการนี้เท่านั้น (ใช้ code ที่ใกล้เคียงที่สุด):
${topicList}

ตอบเป็น JSON object { "questions": [...], "more": true/false } เท่านั้น`;
}

// Gemini structured-output schema (OpenAPI subset)
export function responseSchema(topicCodes: string[]) {
  return {
    type: "OBJECT",
    properties: {
      questions: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            topic: { type: "STRING", enum: topicCodes },
            level: { type: "STRING", enum: [...LEVELS] },
            stem: { type: "STRING" },
            choices: { type: "ARRAY", items: { type: "STRING" } },
            answer: { type: "INTEGER" },
            explanation: { type: "STRING" },
            law_ref: { type: "STRING", nullable: true },
            needs_review: { type: "BOOLEAN" },
            kind: { type: "STRING", enum: ["extracted", "generated"] },
          },
          required: ["topic", "level", "stem", "choices", "answer", "explanation", "needs_review", "kind"],
        },
      },
      more: { type: "BOOLEAN" },
    },
    required: ["questions", "more"],
  };
}

const STRIP_PREFIX = /^\s*(?:[ก-ง][\.\)]|\(?[ก-ง]\)|[A-Da-d][\.\)]|\(?[1-4][\.\)])\s*/;
// Real exams ask what the law says, not which section number says it.
const SECTION_RECALL = /(?:อนุ)?มาตรา\s*(?:ใด|อะไร|ที่เท่าไร|ไหน)|คำพิพากษาฎีกาที่|^\s*ตามมาตรา/;
const SECTION_CHOICE = /^\s*(?:มาตรา\s*[0-9๐-๙]+|\([0-9๐-๙]+\))/;
const SOURCE_REF = /^(?:ตาม|จาก|ใน)?\s*(?:ชีท|เอกสาร(?:ประกอบการบรรยาย)?|เนื้อหา)(?:สรุป)?\s*(?:ระบุ|กำหนด|กล่าว|อธิบาย|ยกตัวอย่าง|สรุป)?(?:ไว้)?(?:ว่า)?\s*/;
const SELF_REFERENCE = /ถูกทุกข้อ|ผิดทุกข้อ|ไม่มีข้อใดถูก|ไม่มีข้อถูก|ข้อ\s*ก\s*และ\s*ข|ทั้ง\s*[1-4]\s*และ\s*[1-4]|ทุกข้อข้างต้น|ข้อใดข้อหนึ่ง/;

// Questions that only make sense next to the source file: they ask about the document itself (pages, order, counts)
// or about "the passage / the article" without the text being part of the stem. Students never see the file, so
// such a question cannot be answered. Keep this list in sync with prep_admin_import (migration 20261016230000).
const DOC_META = /ตามเอกสาร(?!สิทธิ|ราชการ)|ในเอกสาร(?:ที่|นี้|ฉบับ|ชุด|ดังกล่าว|ข้างต้น)|ในเอกสาร$|จากเอกสาร(?!ราชการ|ใด)|เอกสารทบทวน|ชุดเอกสาร|เอกสารฉบับนี้|เอกสารชุดนี้|ในหน้า\s*\d+|จากหน้า\s*\d+|หน้า\s*\d+\s*(?:ของ|ถึง)|ตามชีท|ในชีท|ในเนื้อความ/;
const PASSAGE_REF = /(?:ข้อความ|บทความ)(?:เรื่อง|เกี่ยวกับ|ที่กำหนด|ที่ระบุ|ข้างต้น|ดังกล่าว|แนะนำ|ของผู้เขียน)|(?:ตาม|จาก)(?:ข้อความ|บทความ)(?:\s|ใน|$)/;
const QUOTE_CHARS = /["'“”‘’]/;
export function refersToMissingSource(stem: string): boolean {
  if (DOC_META.test(stem)) return true;
  // a passage quoted or pasted into the stem makes the question self-contained; a short stem with no quote is not
  return stem.length < 200 && !QUOTE_CHARS.test(stem) && PASSAGE_REF.test(stem);
}

export function stripPrefix(s: string): string {
  return s.replace(STRIP_PREFIX, "").trim();
}

// Validates one model-produced item. Returns the cleaned question, or a reason it was dropped.
export function normalize(raw: unknown, topicCodes: Set<string>): { q?: DraftQuestion; drop?: string } {
  const r = raw as Record<string, unknown>;
  if (!r || typeof r !== "object") return { drop: "ไม่ใช่ object" };
  const stem = typeof r.stem === "string" ? r.stem.trim() : "";
  if (stem.length < 10) return { drop: "โจทย์สั้นเกินไป" };
  if (!Array.isArray(r.choices) || r.choices.length !== 4) return { drop: "ตัวเลือกไม่ครบ 4" };
  const choices = r.choices.map(c => stripPrefix(String(c ?? "")));
  if (choices.some(c => !c)) return { drop: "มีตัวเลือกว่าง" };
  if (new Set(choices.map(c => c.replace(/\s/g, "").toLowerCase())).size !== 4) return { drop: "ตัวเลือกซ้ำกัน" };
  if (choices.some(c => SELF_REFERENCE.test(c))) return { drop: "ตัวเลือกอ้างถึงตัวเลือกอื่น" };
  if (SECTION_RECALL.test(stem) && !/การวัด|มาตราวัด|มาตราส่วน/.test(stem)) return { drop: "ถามเลขมาตรา/ฎีกา" };
  if (choices.filter(c => SECTION_CHOICE.test(c)).length >= 3) return { drop: "ตัวเลือกเป็นเลขมาตรา" };
  if (/ชีท|เอกสารประกอบการบรรยาย/.test(stem)) return { drop: "โจทย์อ้างถึงชีท/เอกสาร" };
  if (refersToMissingSource(stem)) return { drop: "โจทย์อ้างถึงเอกสาร/บทความที่ไม่ได้อยู่ในโจทย์" };
  const answer = Number(r.answer);
  if (!Number.isInteger(answer) || answer < 0 || answer > 3) return { drop: "เฉลยไม่ถูกต้อง" };
  const topic = String(r.topic ?? "");
  if (!topicCodes.has(topic)) return { drop: `หมวดไม่รู้จัก (${topic})` };
  const level = (LEVELS as readonly string[]).includes(String(r.level)) ? (r.level as DraftQuestion["level"]) : "remember";
  const law = typeof r.law_ref === "string" && r.law_ref.trim() && r.law_ref.trim().toLowerCase() !== "null" ? r.law_ref.trim() : null;
  return {
    q: {
      topic, level, stem, choices, answer,
      explanation: typeof r.explanation === "string" ? r.explanation.trim().replace(SOURCE_REF, "") : "",
      law_ref: law,
      needs_review: r.needs_review === true || !r.explanation || /ชีท|เอกสาร(?:ระบุ|กำหนด)/.test(String(r.explanation)),
      kind: r.kind === "extracted" ? "extracted" : "generated",
    },
  };
}

// Accepts {"questions": [...], "more": bool} or a bare array. When the output was cut off by the
// token limit, keeps every complete question object and reports more=true so the caller asks again.
export function parseModelJson(text: string): { items: unknown[]; more: boolean } {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const v = JSON.parse(t);
    if (Array.isArray(v)) return { items: v, more: false };
    if (v && Array.isArray(v.questions)) return { items: v.questions, more: v.more === true };
  } catch { /* fall through to salvage */ }
  const start = t.indexOf("[");
  if (start === -1) throw new Error("ไม่พบรายการข้อสอบในผลลัพธ์");
  const body = t.slice(start + 1);
  const items: unknown[] = [];
  let depth = 0, from = -1, inStr = false, esc = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "{") { if (depth++ === 0) from = i; }
    else if (ch === "}" && --depth === 0 && from >= 0) {
      try { items.push(JSON.parse(body.slice(from, i + 1))); } catch { /* skip broken object */ }
      from = -1;
    }
    else if (ch === "]" && depth === 0) break;
  }
  if (!items.length) throw new Error("อ่านผลลัพธ์จาก AI ไม่ได้");
  return { items, more: true };
}
