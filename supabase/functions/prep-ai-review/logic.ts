// Pure helpers for prep-ai-review (no Deno APIs, so they can be unit-tested with node).
//
// How a question is judged (strict on purpose):
//   1. Blind pass: Gemini Pro and Gemini Flash each answer the question WITHOUT seeing the key, and flag problems
//      (ambiguous, more than one correct, no correct choice, missing passage/figure, outdated, off-syllabus).
//   2. Judge pass: Gemini Pro sees the key, the explanation and both blind answers, checks facts and the explanation,
//      and proposes the smallest fix.
//   3. combine(): "ok" only when every blind answer equals the key, nobody flagged a problem, the judge says ok and no
//      one is unsure. Anything else is "fix" or "hide" with the reason, and disagreements are marked low confidence
//      so a person checks them.

export type Q = {
  id: number; topic: string; subtopic: string | null; track: "obec" | "vec"; grp: string;
  stem: string; choices: string[]; answer: number; explanation: string; law_ref: string | null;
};
export type Conf = "high" | "medium" | "low";
export type Blind = { id: number; answer: number | null; confidence: Conf; flags: string[]; note: string };
export type Fix = { stem: string | null; choices: string[] | null; answer: number | null; explanation: string | null };
export type Judge = { id: number; verdict: "ok" | "fix" | "hide"; confidence: Conf; issue: string; fix: Fix };
export type Verdict = {
  id: number; verdict: "ok" | "fix" | "hide"; answer: number | null; confidence: Conf; issue: string; fix: Fix;
  detail: { blind: Record<string, { answer: number | null; confidence: Conf; flags: string[]; note: string } | null>; judge: Judge | null };
};

export const FLAGS = ["ambiguous", "multiple_correct", "no_correct", "missing_context", "outdated", "off_syllabus", "factual_doubt"] as const;
const FLAG_TH: Record<string, string> = {
  ambiguous: "โจทย์กำกวม", multiple_correct: "ถูกได้มากกว่าหนึ่งข้อ", no_correct: "ไม่มีตัวเลือกที่ถูก",
  missing_context: "โจทย์อ้างถึงบทอ่าน/รูป/ตารางที่ไม่มี", outdated: "ข้อมูลอาจล้าสมัย", off_syllabus: "ไม่ตรงหลักสูตรสนามสอบนี้",
  factual_doubt: "ไม่แน่ใจข้อเท็จจริง",
};
const L = "กขคง";

const EXAM: Record<Q["track"], string> = {
  obec: "ครูผู้ช่วย สังกัด สพฐ. (หลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน)",
  vec: "ครูผู้ช่วย สังกัด สอศ. (อาชีวศึกษา หลักสูตร ปวช. และ ปวส. ของ สอศ.)",
};
const head = (q: Q) => `### id ${q.id} · สนามสอบ: ${EXAM[q.track] ?? EXAM.obec} · ${q.grp === "B3" ? `วิชาเอก${q.topic}` : q.topic}${q.subtopic ? ` · หมวดย่อย ${q.subtopic}` : ""}`;
const body = (q: Q) => `โจทย์: ${q.stem}\n${q.choices.map((c, i) => `${L[i]}) ${c}`).join("\n")}`;

export const BLIND_SYSTEM = `คุณเป็นผู้เชี่ยวชาญที่ทำข้อสอบครูผู้ช่วยภาษาไทย ทำทุกข้ออย่างรอบคอบด้วยตัวเอง (ไม่มีเฉลยให้)
สำหรับแต่ละข้อให้ตอบ:
- answer: index ของตัวเลือกที่ถูกที่สุด (ก=0 ข=1 ค=2 ง=3) หรือ null ถ้าไม่มีข้อใดถูกหรือทำไม่ได้
- confidence: high / medium / low (low เมื่อต้องเดา หรือเป็นตัวเลข ปี มาตรา ชื่อเฉพาะ รายละเอียดหลักสูตรหรือประกาศที่คุณไม่แน่ใจ)
- flags: รายการปัญหาที่พบ เลือกจาก ${FLAGS.join(", ")} (ว่างได้)
- note: เหตุผลสั้นๆ ภาษาไทย 1-2 ประโยค
ตอบเป็น JSON เท่านั้น รูปแบบ {"results":[{"id":<id>,"answer":<0-3|null>,"confidence":"high|medium|low","flags":[...],"note":"..."}]} ให้ครบทุกข้อ ไม่มีข้อความอื่นนอก JSON`;

export const blindPrompt = (qs: Q[]) => qs.map(q => `${head(q)}\n${body(q)}`).join("\n\n");

export const JUDGE_SYSTEM = `คุณเป็นผู้ตรวจข้อสอบครูผู้ช่วยภาษาไทยที่เข้มงวด แต่ละข้อมีเฉลย คำอธิบาย และคำตอบของผู้เชี่ยวชาญสองคนที่ทำโดยไม่เห็นเฉลย
ให้ตรวจว่า (1) ข้อเท็จจริงในโจทย์ ตัวเลือก และคำอธิบายถูกต้อง (2) มีคำตอบที่ถูกเพียงข้อเดียวและตรงกับเฉลย (3) โจทย์ชัดเจน อ่านเข้าใจได้ในตัวเอง (4) คำอธิบายสอดคล้องกับเฉลย (5) ตรงกับหลักสูตรของสนามสอบนั้น
ถ้าผู้เชี่ยวชาญตอบไม่ตรงเฉลย ให้พิจารณาเหตุผลอย่างจริงจังก่อนตัดสิน
- verdict: ok (ผ่านทุกข้อ) / fix (มีจุดผิดที่แก้ได้) / hide (แก้ไม่ได้ เช่น อ้างถึงบทอ่านหรือรูปที่ไม่มี ผิดจนต้องเขียนใหม่)
- confidence: high / medium / low (low เมื่อข้อเท็จจริงเป็นเรื่องที่คุณไม่แน่ใจ ห้ามเดา)
- issue: อธิบายสั้นๆ ภาษาไทยว่าผิดตรงไหนและเพราะอะไร ถ้าไม่แน่ใจให้บอกว่าควรตรวจกับเอกสารใด (ถ้า ok ให้เป็น "")
- fix: ใส่เฉพาะส่วนที่ต้องแก้ ส่วนที่ไม่แก้เป็น null แก้น้อยที่สุด ห้ามแต่งข้อเท็จจริงใหม่ ถ้าแก้ choices ต้องมี 4 ตัวเลือกไม่มีตัวนำหน้า และ fix.answer เป็น index ในชุดตัวเลือกหลังแก้
ตอบเป็น JSON เท่านั้น รูปแบบ {"results":[{"id":<id>,"verdict":"ok|fix|hide","confidence":"high|medium|low","issue":"...","fix":{"stem":null,"choices":null,"answer":null,"explanation":null}}]} ให้ครบทุกข้อ ไม่มีข้อความอื่นนอก JSON`;

export function judgePrompt(qs: Q[], blind: Record<string, Map<number, Blind>>): string {
  return qs.map(q => {
    const seen = Object.entries(blind).map(([who, m]) => {
      const b = m.get(q.id);
      return b ? `- ผู้เชี่ยวชาญ ${who}: ตอบ ${b.answer === null ? "ไม่มีข้อถูก" : L[b.answer]} (มั่นใจ ${b.confidence})${b.flags.length ? ` ปัญหา: ${b.flags.join(", ")}` : ""}${b.note ? ` เหตุผล: ${b.note}` : ""}` : `- ผู้เชี่ยวชาญ ${who}: ไม่ได้ตอบ`;
    }).join("\n");
    return `${head(q)}\n${body(q)}\nเฉลย: ${L[q.answer]}\nคำอธิบาย: ${q.explanation}${q.law_ref ? `\nอ้างอิง: ${q.law_ref}` : ""}\n${seen}`;
  }).join("\n\n");
}

// Models sometimes wrap JSON in prose or code fences: take the outermost {...}.
export function parseJson(text: string): unknown {
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s < 0 || e <= s) throw new Error("no JSON object");
  return JSON.parse(text.slice(s, e + 1));
}

const conf = (v: unknown): Conf => (v === "high" || v === "medium" || v === "low" ? v : "low");
const idx = (v: unknown): number | null => { const n = v === null || v === undefined ? NaN : Number(v); return n >= 0 && n <= 3 && Number.isInteger(n) ? n : null; };
const results = (raw: unknown) => { const r = (raw as { results?: unknown })?.results; return Array.isArray(r) ? r as Record<string, unknown>[] : []; };

export function readBlind(asked: Q[], raw: unknown): Map<number, Blind> {
  const ids = new Set(asked.map(q => q.id)), out = new Map<number, Blind>();
  for (const r of results(raw)) {
    const id = Number(r.id);
    if (!ids.has(id) || out.has(id)) continue;
    const flags = Array.isArray(r.flags) ? (r.flags as unknown[]).map(String).filter(f => (FLAGS as readonly string[]).includes(f)) : [];
    out.set(id, { id, answer: idx(r.answer), confidence: conf(r.confidence), flags, note: typeof r.note === "string" ? r.note.trim().slice(0, 500) : "" });
  }
  return out;
}

export function readJudge(asked: Q[], raw: unknown): Map<number, Judge> {
  const ids = new Set(asked.map(q => q.id)), out = new Map<number, Judge>();
  for (const r of results(raw)) {
    const id = Number(r.id);
    if (!ids.has(id) || out.has(id) || !["ok", "fix", "hide"].includes(String(r.verdict))) continue;
    const f = (r.fix ?? {}) as Record<string, unknown>;
    const choices = Array.isArray(f.choices) && f.choices.length === 4 && f.choices.every(c => typeof c === "string" && c.trim()) && new Set(f.choices).size === 4
      ? (f.choices as string[]).map(c => c.trim()) : null;
    out.set(id, {
      id, verdict: r.verdict as Judge["verdict"], confidence: conf(r.confidence),
      issue: typeof r.issue === "string" ? r.issue.trim().slice(0, 1000) : "",
      fix: {
        stem: typeof f.stem === "string" && f.stem.trim() ? f.stem.trim() : null,
        choices, answer: idx(f.answer),
        explanation: typeof f.explanation === "string" && f.explanation.trim() ? f.explanation.trim() : null,
      },
    });
  }
  return out;
}

const NOFIX: Fix = { stem: null, choices: null, answer: null, explanation: null };

export function combine(q: Q, blind: Record<string, Blind | undefined>, judge: Judge | undefined): Verdict {
  const who = Object.keys(blind);
  const got = who.map(w => blind[w]).filter((b): b is Blind => !!b);
  const flags = [...new Set(got.flatMap(b => b.flags))];
  const answers = got.map(b => b.answer);
  const allKey = got.length === who.length && got.length > 0 && answers.every(a => a === q.answer);
  const agree = answers.length > 1 && answers.every(a => a === answers[0]);
  const unsure = got.some(b => b.confidence === "low") || judge?.confidence === "low";
  const reasons: string[] = [];
  if (got.length < who.length) reasons.push(`AI ${who.filter(w => !blind[w]).join(", ")} ไม่ได้ตอบข้อนี้`);
  for (const w of who) { const b = blind[w]; if (b && b.answer !== q.answer) reasons.push(`${w} ตอบ ${b.answer === null ? "ไม่มีข้อถูก" : L[b.answer]} (เฉลย ${L[q.answer]})`); }
  if (flags.length) reasons.push(flags.map(f => FLAG_TH[f] ?? f).join(", "));
  if (!judge) reasons.push("ไม่มีผลตัดสินจากผู้ตรวจ");
  if (judge?.issue) reasons.push(judge.issue);

  let verdict: Verdict["verdict"];
  if (judge?.verdict === "hide" || flags.includes("missing_context")) verdict = "hide";
  else if (allKey && !flags.length && judge?.verdict === "ok" && !unsure) verdict = "ok";
  else verdict = "fix";

  // A blind majority against the key with no fix proposed: suggest their answer, but never with high confidence.
  const majority = agree && answers[0] !== q.answer ? answers[0] : null;
  const fix = judge?.fix ?? NOFIX;
  const confidence: Conf = verdict === "ok" ? (who.length >= 2 ? "high" : "medium")
    : unsure || !agree || got.length < who.length || !judge ? "low"
    : judge.confidence;
  return {
    id: q.id, verdict, answer: majority ?? (answers.length ? answers[0] : null), confidence,
    issue: verdict === "ok" ? "" : [...new Set(reasons)].join(" · ").slice(0, 1500),
    fix: verdict === "ok" ? NOFIX : fix,
    detail: {
      blind: Object.fromEntries(who.map(w => [w, blind[w] ? { answer: blind[w]!.answer, confidence: blind[w]!.confidence, flags: blind[w]!.flags, note: blind[w]!.note } : null])),
      judge: judge ?? null,
    },
  };
}
