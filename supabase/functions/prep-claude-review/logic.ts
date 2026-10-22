// Pure helpers for prep-claude-review (no Deno APIs, so they can be unit-tested with node).

export type Q = {
  id: number; topic: string; subtopic: string | null; track: "obec" | "vec"; grp: string;
  stem: string; choices: string[]; answer: number; explanation: string; law_ref: string | null;
};
export type Fix = { stem: string | null; choices: string[] | null; answer: number | null; explanation: string | null };
export type Verdict = { id: number; answer: number; verdict: "ok" | "fix" | "hide"; confidence: "high" | "medium" | "low"; issue: string; fix: Fix };

const nullable = (t: string) => ({ type: [t, "null"] });
export const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["results"],
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "answer", "verdict", "confidence", "issue", "fix"],
        properties: {
          id: { type: "integer" },
          answer: { type: "integer", enum: [0, 1, 2, 3] },
          verdict: { type: "string", enum: ["ok", "fix", "hide"] },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          issue: { type: "string" },
          fix: {
            type: "object",
            additionalProperties: false,
            required: ["stem", "choices", "answer", "explanation"],
            properties: {
              stem: nullable("string"),
              choices: { type: ["array", "null"], items: { type: "string" } },
              answer: nullable("integer"),
              explanation: nullable("string"),
            },
          },
        },
      },
    },
  },
};

export const SYSTEM = `คุณเป็นผู้ตรวจข้อสอบครูผู้ช่วยภาษาไทยที่เข้มงวดและรอบคอบ ตรวจทีละข้อดังนี้
1. ทำข้อสอบเองก่อนโดยไม่ดูเฉลย แล้วใส่ index คำตอบของคุณใน answer (ก=0 ข=1 ค=2 ง=3)
2. เทียบกับเฉลยและคำอธิบายที่ให้มา แล้วตัดสิน verdict
   - ok: ข้อเท็จจริงถูกต้อง มีคำตอบที่ถูกเพียงข้อเดียวและตรงกับเฉลย โจทย์ชัดเจน อ่านเข้าใจได้ในตัวเอง และคำอธิบายถูกต้องสอดคล้องกับเฉลย
   - fix: มีจุดผิดที่แก้ได้ เช่น เฉลยผิด ตัวเลือกถูกได้มากกว่าหนึ่งข้อ คำอธิบายผิดหรือไม่ตรงเฉลย ข้อมูลล้าสมัย คำผิด โจทย์กำกวม ให้ใส่เฉพาะส่วนที่ต้องแก้ใน fix (ส่วนที่ไม่แก้ให้เป็น null) โดยแก้น้อยที่สุด
   - hide: แก้ไม่ได้หรือไม่ควรใช้ เช่น โจทย์อ้างถึงบทอ่าน รูป หรือตารางที่ไม่มีในข้อ เนื้อหาผิดหลักสูตรของสนามสอบนี้ หรือผิดจนต้องเขียนใหม่ทั้งข้อ
3. issue: อธิบายสั้นๆ เป็นภาษาไทยว่าผิดตรงไหนและเพราะอะไร (ถ้า ok ให้เป็น "")
4. confidence: ความมั่นใจของการตัดสิน ถ้าข้อเท็จจริงเป็นเรื่องที่คุณไม่แน่ใจ (ตัวเลข ปี มาตรา ชื่อเฉพาะ รายละเอียดหลักสูตรหรือประกาศ) ให้ใช้ low และบอกใน issue ว่าควรตรวจกับเอกสารใด ห้ามเดา
5. ห้ามแต่งข้อเท็จจริงใหม่ ถ้า fix.choices ต้องมี 4 ตัวเลือกไม่มีตัวนำหน้า และ fix.answer เป็น index ในชุดตัวเลือกหลังแก้
ตอบเป็น JSON ตาม schema ให้ครบทุกข้อ ใช้ id ตามที่ให้มา`;

const EXAM: Record<Q["track"], string> = {
  obec: "ครูผู้ช่วย สังกัด สพฐ. (อ้างอิงหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน)",
  vec: "ครูผู้ช่วย สังกัด สอศ. (อาชีวศึกษา อ้างอิงหลักสูตร ปวช. และ ปวส. ของ สอศ.)",
};

export function userPrompt(qs: Q[]): string {
  return qs.map(q => {
    const where = q.grp === "B3" ? `วิชาเอก${q.topic}` : q.topic;
    return `### id ${q.id} · สนามสอบ: ${EXAM[q.track] ?? EXAM.obec} · ${where}${q.subtopic ? ` · หมวดย่อย ${q.subtopic}` : ""}
โจทย์: ${q.stem}
${q.choices.map((c, i) => `${"กขคง"[i]}) ${c}`).join("\n")}
เฉลย: ${"กขคง"[q.answer]}
คำอธิบาย: ${q.explanation}${q.law_ref ? `\nอ้างอิง: ${q.law_ref}` : ""}`;
  }).join("\n\n");
}

// Keep only well-formed verdicts for questions that were asked; drop malformed fixes rather than store them.
export function normalize(asked: Q[], raw: unknown): Verdict[] {
  const ids = new Set(asked.map(q => q.id));
  const list = (raw as { results?: unknown[] })?.results;
  if (!Array.isArray(list)) return [];
  const out: Verdict[] = [];
  for (const r of list as Record<string, unknown>[]) {
    const id = Number(r.id), answer = Number(r.answer);
    if (!ids.has(id) || !(answer >= 0 && answer <= 3) || !["ok", "fix", "hide"].includes(String(r.verdict))) continue;
    const f = (r.fix ?? {}) as Record<string, unknown>;
    const choices = Array.isArray(f.choices) && f.choices.length === 4 && f.choices.every(c => typeof c === "string" && c.trim()) ? (f.choices as string[]).map(c => c.trim()) : null;
    const fa = f.answer === null || f.answer === undefined ? null : Number(f.answer);
    out.push({
      id, answer,
      verdict: r.verdict as Verdict["verdict"],
      confidence: ["high", "medium", "low"].includes(String(r.confidence)) ? r.confidence as Verdict["confidence"] : "low",
      issue: typeof r.issue === "string" ? r.issue.trim().slice(0, 1000) : "",
      fix: {
        stem: typeof f.stem === "string" && f.stem.trim() ? f.stem.trim() : null,
        choices,
        answer: fa !== null && fa >= 0 && fa <= 3 ? fa : null,
        explanation: typeof f.explanation === "string" && f.explanation.trim() ? f.explanation.trim() : null,
      },
    });
    ids.delete(id);
  }
  return out;
}
