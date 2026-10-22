// Pure helpers for prep-gen-questions (no Deno APIs, so they can be unit-tested with node).

export type Work = {
  subtopic: string; topic: string; major: string; name: string; kind: "content" | "pedagogy"; keywords: string;
  need: number; stems: string[]; sibling_names: string[];
  grp?: string; track?: "obec" | "vec";   // missing = a สพฐ. major
};

// Wording that differs between the สพฐ. and สอศ. (อาชีวศึกษา) exams, and between majors and other ภาค ข topics.
export function examContext(w: Work) {
  const vec = w.track === "vec";
  const subject = !w.grp || w.grp === "B3" ? `วิชาเอก${w.major}` : `หมวด${w.major}`;
  return {
    who: vec ? `ข้อสอบครูผู้ช่วย สังกัด สอศ. (อาชีวศึกษา) ก.ค.ศ. ภาค ข ${subject}` : `ข้อสอบครูผู้ช่วย (ก.ค.ศ. ภาค ข ${subject})`,
    subject,
    curriculum: vec ? "หลักสูตร ปวช. และ ปวส. ของ สอศ." : "หลักสูตรแกนกลาง",
    room: vec ? "ห้องเรียนและโรงฝึกงานของสถานศึกษาอาชีวศึกษา" : "ห้องเรียน",
  };
}
export type Draft = { level: string; stem: string; choices: string[]; answer: number; explanation: string };
export type Verdict = { id: number; answer: number; sound: boolean; issue?: string };

export const LEVELS = ["remember", "understand", "apply", "analyze"];

export function generatePrompt(w: Work, count: number): string {
  const pedagogy = w.kind === "pedagogy";
  const c = examContext(w);
  return `คุณเป็นผู้เขียน${c.who} ภาษาไทย ที่มีประสบการณ์
หมวดย่อย: ${w.name} (${pedagogy ? "ศาสตร์การสอนและการประยุกต์" : "เนื้อหาวิชาการ"})
ขอบเขต/คำสำคัญ: ${w.keywords}
หมวดย่อยอื่นของวิชานี้ (ห้ามออกข้อที่เป็นของหมวดอื่น): ${w.sibling_names.join(", ")}

แต่งข้อสอบปรนัย 4 ตัวเลือก ${count} ข้อ ให้ครอบคลุมหลายประเด็นในหมวดย่อยนี้ ไม่ถามประเด็นเดียวกันซ้ำ
${pedagogy
    ? `- เน้นสถานการณ์ใน${c.room}: ครูควรทำอะไร/เลือกวิธีใด/ประเมินอย่างไร พร้อมเหตุผลทางหลักการสอนที่เป็นมาตรฐานสากลหรือตาม${c.curriculum}`
    : `- เน้นความรู้ที่ตำราและ${c.curriculum}ตรงกัน ผสมระดับ: จำ เข้าใจ ประยุกต์/คำนวณ วิเคราะห์ อย่างละประมาณเท่ากัน`}

กฎเหล็ก
1. ใช้เฉพาะข้อเท็จจริงที่แน่ใจและเป็นมาตรฐานที่ตำราทั่วไปเห็นตรงกัน ห้ามแต่งตัวเลข ปี ชื่อบุคคล ชื่อเพลง ชื่อกฎหมาย หรือสูตรที่ไม่แน่ใจ ถ้าไม่แน่ใจให้เปลี่ยนประเด็น
2. choices ต้องมี 4 ข้อพอดี ไม่มีตัวนำหน้า ก. ข. หรือ 1. 2. answer คือ index (เริ่มจาก 0) ของข้อที่ถูกเพียงข้อเดียว
3. ตัวเลือกจะถูกสลับตำแหน่ง ห้ามเขียนว่า "ถูกทุกข้อ" "ไม่มีข้อใดถูก" "ข้อ ก และ ข" หรืออ้างถึงตัวเลือกอื่น
4. ตัวลวงต้องสมเหตุสมผล ชนิดเดียวกับคำตอบ แต่ผิดชัดเจนตามหลักวิชา ห้ามมีสองข้อที่ถูกได้
5. โจทย์ต้องอ่านเข้าใจได้ในตัวเอง ห้ามอ้างถึงรูปภาพ ตาราง หรือข้อก่อนหน้า ถ้าต้องใช้ข้อมูลให้เขียนไว้ในโจทย์
6. explanation 1-3 ประโยค บอกว่าทำไมข้อนั้นถูกและตัวลวงที่น่าสับสนผิดเพราะอะไร เขียนเป็นข้อเท็จจริงโดยตรง
7. ข้อ "ข้อใดไม่ใช่" ไม่เกิน 20% ห้ามถามให้จำเลขมาตรา เลขข้อ หรือเลขหน้า
8. level เลือก remember/understand/apply/analyze
9. ตัวเลือกทั้ง 4 ข้อต้องยาวและละเอียดใกล้เคียงกัน ห้ามทำให้ข้อที่ถูกยาวหรือมีรายละเอียดมากกว่าตัวลวงอย่างเห็นได้ชัด (ผู้สอบมักเดาจากข้อที่ยาวที่สุด) ตัวลวงต้องมีรายละเอียดและน้ำเสียงเหมือนข้อถูก
${w.stems.length ? `\nข้อที่มีอยู่แล้วในหมวดนี้ ห้ามซ้ำหรือถามประเด็นเดียวกัน:\n${w.stems.map(s => "- " + s).join("\n")}\n` : ""}
ตอบเป็น JSON object { "questions": [ { "level", "stem", "choices", "answer", "explanation" } ] } เท่านั้น`;
}

export function verifyPrompt(w: Work, drafts: Draft[]): string {
  const qs = drafts.map((d, i) => `[${i}] ${d.stem}\n${d.choices.map((c, k) => `${"กขคง"[k]}) ${c}`).join("\n")}`).join("\n\n");
  const c = examContext(w);
  return `คุณเป็นผู้ตรวจ${c.who} หมวดย่อย "${w.name}" ที่เข้มงวด
ให้ทำข้อต่อไปนี้ด้วยตัวเองก่อน (ยังไม่มีเฉลยให้ดู) แล้วประเมินแต่ละข้อ:
- answer = index (เริ่ม 0: ก=0 ข=1 ค=2 ง=3) ของข้อที่คุณคิดว่าถูกที่สุด
- sound = true เมื่อ (1) ข้อเท็จจริงถูกต้องตามตำราและ${c.curriculum} (2) มีตัวเลือกที่ถูกเพียงข้อเดียวอย่างชัดเจน (3) โจทย์ไม่กำกวมและอ่านเข้าใจได้ในตัวเอง (4) เป็นเรื่องของหมวดนี้ ถ้าสงสัยข้อใดข้อหนึ่งให้ sound = false
- issue = เหตุผลสั้นๆ เมื่อ sound = false

${qs}

ตอบเป็น JSON object { "results": [ { "id": <เลขในวงเล็บ>, "answer": <index>, "sound": <true/false>, "issue": "<ข้อความ>" } ] } ให้ครบทุกข้อ`;
}

export const GENERATE_SCHEMA = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          level: { type: "STRING", enum: LEVELS },
          stem: { type: "STRING" },
          choices: { type: "ARRAY", items: { type: "STRING" } },
          answer: { type: "INTEGER" },
          explanation: { type: "STRING" },
        },
        required: ["level", "stem", "choices", "answer", "explanation"],
      },
    },
  },
  required: ["questions"],
};

export const VERIFY_SCHEMA = {
  type: "OBJECT",
  properties: {
    results: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { id: { type: "INTEGER" }, answer: { type: "INTEGER" }, sound: { type: "BOOLEAN" }, issue: { type: "STRING" } },
        required: ["id", "answer", "sound"],
      },
    },
  },
  required: ["results"],
};

const STRIP_PREFIX = /^\s*(?:[ก-ง][\.\)]|\(?[ก-ง]\)|[A-Da-d][\.\)]|\(?[1-4][\.\)])\s*/;
const SELF_REFERENCE = /ถูกทุกข้อ|ผิดทุกข้อ|ไม่มีข้อใดถูก|ไม่มีข้อถูก|ข้อ\s*ก\s*และ\s*ข|ทั้ง\s*[1-4]\s*และ\s*[1-4]|ทุกข้อข้างต้น|ข้อใดข้อหนึ่ง|ทั้งข้อ\s*[ก-ง]/;
const SECTION_RECALL = /(?:อนุ)?มาตรา\s*(?:ใด|อะไร|ที่เท่าไร|ไหน)|คำพิพากษาฎีกาที่|^\s*ตามมาตรา/;
const MISSING_SOURCE = /ชีท|เอกสารประกอบการบรรยาย|ตามเอกสาร|ในเอกสาร(?:นี้|ฉบับ|ชุด)|จากรูป|ตามรูป|รูปภาพ(?:ข้างต้น|ด้านบน)|ตารางข้างต้น|ข้อก่อนหน้า|ข้อที่แล้ว/;

export function stripPrefix(s: string): string { return s.replace(STRIP_PREFIX, "").trim(); }

// Cleans one model-produced draft; returns null (with a reason) when it must be dropped.
export function cleanDraft(raw: unknown): { d?: Draft; drop?: string } {
  const r = raw as Record<string, unknown>;
  if (!r || typeof r !== "object") return { drop: "ไม่ใช่ object" };
  const stem = typeof r.stem === "string" ? r.stem.trim() : "";
  if (stem.length < 12) return { drop: "โจทย์สั้นเกินไป" };
  if (!Array.isArray(r.choices) || r.choices.length !== 4) return { drop: "ตัวเลือกไม่ครบ 4" };
  const choices = r.choices.map(c => stripPrefix(String(c ?? "")));
  if (choices.some(c => !c)) return { drop: "มีตัวเลือกว่าง" };
  if (new Set(choices.map(c => c.replace(/\s/g, "").toLowerCase())).size !== 4) return { drop: "ตัวเลือกซ้ำกัน" };
  if (choices.some(c => SELF_REFERENCE.test(c))) return { drop: "ตัวเลือกอ้างถึงตัวเลือกอื่น" };
  if (SECTION_RECALL.test(stem)) return { drop: "ถามเลขมาตรา/ฎีกา" };
  if (MISSING_SOURCE.test(stem)) return { drop: "โจทย์อ้างถึงสิ่งที่ไม่ได้อยู่ในโจทย์" };
  const answer = Number(r.answer);
  if (!Number.isInteger(answer) || answer < 0 || answer > 3) return { drop: "เฉลยไม่ถูกต้อง" };
  const explanation = typeof r.explanation === "string" ? r.explanation.trim() : "";
  if (explanation.length < 8) return { drop: "ไม่มีคำอธิบาย" };
  const level = LEVELS.includes(String(r.level)) ? String(r.level) : "remember";
  return { d: { level, stem, choices, answer, explanation } };
}

// Fisher-Yates with an injectable random so tests are deterministic. The key moves with its choice.
export function shuffleChoices(d: Draft, rnd: () => number = Math.random): Draft {
  const idx = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return { ...d, choices: idx.map(i => d.choices[i]), answer: idx.indexOf(d.answer) };
}

// A draft is kept only when the independent checker picked the same answer and called it sound.
export function accept(drafts: Draft[], verdicts: Verdict[]): { kept: Draft[]; rejected: { stem: string; why: string }[] } {
  const byId = new Map(verdicts.map(v => [v.id, v]));
  const kept: Draft[] = [], rejected: { stem: string; why: string }[] = [];
  drafts.forEach((d, i) => {
    const v = byId.get(i);
    if (!v) rejected.push({ stem: d.stem, why: "ผู้ตรวจไม่ตอบข้อนี้" });
    else if (v.answer !== d.answer) rejected.push({ stem: d.stem, why: `ผู้ตรวจตอบต่างจากเฉลย (${v.answer} ≠ ${d.answer})` });
    else if (!v.sound) rejected.push({ stem: d.stem, why: v.issue || "ผู้ตรวจไม่มั่นใจว่าถูกต้อง/ไม่กำกวม" });
    else kept.push(d);
  });
  return { kept, rejected };
}

export function parseJson(text: string): Record<string, unknown> {
  const t = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try { return JSON.parse(t); } catch { /* fall through to the first {...} block */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error("ไม่ใช่ JSON");
}
