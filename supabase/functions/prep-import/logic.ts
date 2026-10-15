// Pure helpers for prep-import (no Deno APIs, so they can be unit-tested with node).

export type TopicInfo = { code: string; name: string };
export type Mode = "extract" | "generate";

export type DraftQuestion = {
  topic: string;
  level: "remember" | "understand" | "apply" | "analyze";
  stem: string;
  choices: string[];
  answer: number;
  explanation: string;
  law_ref: string | null;
  needs_review: boolean;
};

export const LEVELS = ["remember", "understand", "apply", "analyze"] as const;

export function buildPrompt(mode: Mode, topics: TopicInfo[], opts: { count: number; hint: string; pages?: string }): string {
  const topicList = topics.map(t => `- ${t.code}: ${t.name}`).join("\n");
  const task = mode === "extract"
    ? `เอกสารนี้เป็นข้อสอบอยู่แล้ว ให้คัดลอกข้อสอบแบบปรนัยทุกข้อที่พบ (ไม่เกิน ${opts.count} ข้อ) ออกมาตามต้นฉบับให้มากที่สุด\n`
      + `- ถ้าเอกสารมีเฉลย (ท้ายไฟล์ ไฮไลต์ ตัวหนา สีตัวอักษร) ให้ใช้เฉลยนั้น\n`
      + `- ถ้าไม่มีเฉลย ให้ตอบเองเฉพาะข้อที่มั่นใจ และตั้ง needs_review=true; ข้อที่ไม่มั่นใจให้ข้ามไป\n`
      + `- ตัวเลือกไม่ครบ 4 ข้อ ให้ข้ามข้อนั้น`
    : `เอกสารนี้เป็นชีทสรุปเนื้อหา ให้แต่งข้อสอบปรนัยแบบ 4 ตัวเลือกจากเนื้อหาในเอกสาร จำนวนไม่เกิน ${opts.count} ข้อ`
      + ` โดยกระจายหัวข้อให้ทั่วเนื้อหา`;
  return `คุณเป็นผู้เขียนข้อสอบครูผู้ช่วย (ก.ค.ศ.) ภาษาไทย
${task}
${opts.pages ? `ให้ใช้เฉพาะเนื้อหาในช่วงที่ส่งมานี้ (${opts.pages})\n` : ""}${opts.hint ? `คำแนะนำจากผู้ดูแล: ${opts.hint}\n` : ""}
กฎเหล็ก
1. ใช้เฉพาะข้อเท็จจริงที่ปรากฏในเอกสาร ห้ามแต่งเลขมาตรา ปี ตัวเลข ชื่อ ที่ไม่มีในเอกสาร ถ้าเอกสารกำกวมให้ข้ามข้อเท็จจริงนั้น
2. choices ต้องมี 4 ข้อพอดี ไม่มีตัวนำหน้า ก. ข. หรือ 1. 2. answer คือ index (เริ่มจาก 0) ของข้อที่ถูกเพียงข้อเดียว
3. ตัวเลือกจะถูกสลับตำแหน่งตอนแสดงผล ห้ามเขียนว่า "ถูกทุกข้อ" "ไม่มีข้อใดถูก" "ข้อ ก และ ข" หรืออ้างถึงตัวเลือกอื่น
4. ตัวลวงต้องสมเหตุสมผล ชนิดเดียวกับคำตอบ แต่ผิดชัดเจน
5. โจทย์ต้องอ่านเข้าใจได้ในตัวเอง ห้ามอ้างถึงรูปภาพหรือข้อก่อนหน้า
6. explanation 1-3 ประโยค บอกว่าทำไมข้อนั้นถูก (และตัวลวงที่น่าสับสนผิดเพราะอะไร)
7. law_ref ใส่เฉพาะเมื่อเอกสารระบุมาตรา+กฎหมาย+ปี ไม่เช่นนั้นใส่ null
8. needs_review=true ถ้าต้องเดาหรืออนุมานอะไรที่ไม่ได้เขียนไว้ตรงๆ หรือเอกสารอ่านยาก
9. ข้อ "ข้อใดไม่ใช่" ไม่เกิน 25% ห้ามมีข้อซ้ำหรือใกล้เคียงกัน
10. level เลือก remember/understand/apply/analyze

เลือก topic จากรายการนี้เท่านั้น (ใช้ code ที่ใกล้เคียงที่สุด):
${topicList}

ตอบเป็น JSON array เท่านั้น`;
}

// Gemini structured-output schema (OpenAPI subset)
export function responseSchema(topicCodes: string[]) {
  return {
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
      },
      required: ["topic", "level", "stem", "choices", "answer", "explanation", "needs_review"],
    },
  };
}

const STRIP_PREFIX = /^\s*(?:[ก-ง][\.\)]|\(?[ก-ง]\)|[A-Da-d][\.\)]|\(?[1-4][\.\)])\s*/;
const SELF_REFERENCE = /ถูกทุกข้อ|ผิดทุกข้อ|ไม่มีข้อใดถูก|ไม่มีข้อถูก|ข้อ\s*ก\s*และ\s*ข|ทั้ง\s*[1-4]\s*และ\s*[1-4]|ทุกข้อข้างต้น|ข้อใดข้อหนึ่ง/;

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
  const answer = Number(r.answer);
  if (!Number.isInteger(answer) || answer < 0 || answer > 3) return { drop: "เฉลยไม่ถูกต้อง" };
  const topic = String(r.topic ?? "");
  if (!topicCodes.has(topic)) return { drop: `หมวดไม่รู้จัก (${topic})` };
  const level = (LEVELS as readonly string[]).includes(String(r.level)) ? (r.level as DraftQuestion["level"]) : "remember";
  const law = typeof r.law_ref === "string" && r.law_ref.trim() && r.law_ref.trim().toLowerCase() !== "null" ? r.law_ref.trim() : null;
  return {
    q: {
      topic, level, stem, choices, answer,
      explanation: typeof r.explanation === "string" ? r.explanation.trim() : "",
      law_ref: law,
      needs_review: r.needs_review === true || !r.explanation,
    },
  };
}

export function parseModelJson(text: string): unknown[] {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start === -1) throw new Error("ไม่พบ JSON array");
  try {
    if (end === -1) throw new Error("cut off");
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    // Output cut off by the token limit: keep every complete object before the break.
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
    }
    if (!items.length) throw new Error("อ่านผลลัพธ์จาก AI ไม่ได้");
    return items;
  }
}
