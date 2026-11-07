// Pure logic for the AI check of reported questions (no Deno / network here, so it can be unit-tested with node).
// Two independent passes: (1) the model answers the question blind, without seeing the key or the reports;
// (2) the model judges the reports. The code then only trusts a verdict that the blind answer supports.

export type Ctx = {
  question: { id: number; topic: string; topic_name: string; level: string | null; stem: string; choices: string[]; answer: number; explanation: string | null; law_ref: string | null };
  reports: { id: number; category: string | null; label: string; reason: string }[];
};
export type Blind = { answer: number | null; confident: boolean; ambiguous: boolean; working: string };
export type Fix = { stem?: string; choices?: string[]; answer?: number; explanation?: string };
export type Verdict = "fix" | "hide" | "ok" | "human";
export type Review = {
  verdict: Verdict; confidence: number; analysis: string; fix: Fix | null; user_message: string; blind_answer: number | null; notes: string[];
  /** verdict "human" only: the AI's proposed edit that did not pass the guards — shown to the admin as a draft, never applied by itself */
  suggestion: Fix | null;
};

export const MIN_CONFIDENCE = 70;
const LABELS = ["ก", "ข", "ค", "ง"];

export const DEFAULT_MESSAGE: Record<Verdict, string> = {
  fix: "ทีมงานตรวจข้อที่คุณแจ้งแล้ว และแก้ไขให้ถูกต้องแล้ว ขอบคุณที่ช่วยแจ้งนะ",
  hide: "ทีมงานตรวจข้อที่คุณแจ้งแล้ว พบว่าโจทย์ยังไม่ชัดเจน จึงเก็บข้อนี้ออกไปก่อน ขอบคุณที่ช่วยแจ้งนะ",
  ok: "ทีมงานตรวจข้อที่คุณแจ้งแล้ว ข้อนี้ถูกต้องอยู่แล้ว ขอบคุณที่ช่วยตรวจนะ",
  human: "ทีมงานกำลังตรวจข้อที่คุณแจ้งอยู่ จะแจ้งผลให้ทราบ",
};

const choiceText = (ctx: Ctx, i: number | null | undefined) => (i == null ? "" : String(ctx.question.choices[i] ?? ""));
const q = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

function questionBlock(ctx: Ctx, withKey: boolean): string {
  const x = ctx.question;
  const lines = [`วิชา/หมวด: ${x.topic_name}${x.level ? ` (ระดับ ${x.level})` : ""}`, `โจทย์: ${x.stem}`];
  x.choices.forEach((c, i) => lines.push(`${LABELS[i]}. ${c}`));
  if (withKey) {
    lines.push(`เฉลยในระบบ: ${LABELS[x.answer]}. ${x.choices[x.answer]}`);
    if (x.explanation) lines.push(`คำอธิบายในระบบ: ${x.explanation}`);
    if (x.law_ref) lines.push(`อ้างอิงกฎหมาย: ${x.law_ref}`);
  }
  return lines.join("\n");
}

export function blindPrompt(ctx: Ctx): string {
  return [
    "คุณเป็นผู้เชี่ยวชาญตรวจข้อสอบครูผู้ช่วยของไทย ให้ทำข้อสอบข้อนี้ด้วยตัวเอง โดยไม่มีเฉลย",
    "ถ้าต้องคำนวณ ให้คำนวณทีละขั้นอย่างระมัดระวัง ห้ามเดา",
    "ตอบเป็น JSON: answer = ลำดับของตัวเลือกที่ถูก (0=ก, 1=ข, 2=ค, 3=ง), confident = true เฉพาะเมื่อแน่ใจและมีข้อเดียวที่ถูกชัดเจน,",
    "ambiguous = true ถ้ามีมากกว่าหนึ่งข้อที่โต้แย้งได้ หรือโจทย์ขาดข้อมูล, working = เหตุผลสั้นๆ",
    "",
    questionBlock(ctx, false),
  ].join("\n");
}

export const BLIND_SCHEMA = {
  type: "OBJECT",
  properties: {
    answer: { type: "INTEGER", nullable: true },
    confident: { type: "BOOLEAN" },
    ambiguous: { type: "BOOLEAN" },
    working: { type: "STRING" },
  },
  required: ["answer", "confident", "ambiguous", "working"],
};

export function judgePrompt(ctx: Ctx, blind: Blind): string {
  const reports = ctx.reports.map((r, i) => `${i + 1}. [${r.label}] ${r.reason.replace(/^\[[^\]]*\]\s*/, "") || "(ไม่ได้เขียนรายละเอียด)"}`).join("\n");
  const blindLine = blind.answer == null
    ? "ผู้ตรวจอีกคนที่ทำข้อนี้โดยไม่เห็นเฉลย: ตอบไม่ได้"
    : `ผู้ตรวจอีกคนที่ทำข้อนี้โดยไม่เห็นเฉลย ตอบ ${LABELS[blind.answer]}. ${choiceText(ctx, blind.answer)} (${blind.confident ? "มั่นใจ" : "ไม่มั่นใจ"}${blind.ambiguous ? ", เห็นว่าโจทย์กำกวม" : ""}) เหตุผล: ${blind.working}`;
  return [
    "คุณเป็นบรรณาธิการข้อสอบครูผู้ช่วยของไทย มีผู้ใช้รายงานข้อสอบข้อหนึ่ง ให้ตรวจว่ารายงานถูกต้องหรือไม่ แล้วเลือกผลตามกติกา",
    "",
    "== ข้อสอบ ==",
    questionBlock(ctx, true),
    "",
    "== รายงานจากผู้ใช้ ==",
    reports,
    "",
    "== ผลการทำข้อสอบแบบไม่เห็นเฉลย ==",
    blindLine,
    "",
    "กติกาเลือก verdict:",
    "- ok = เฉลยในระบบถูก โจทย์ชัดเจน คำอธิบายถูกต้อง รายงานไม่มีมูล",
    "- fix = รายงานมีมูล และคุณเขียนแก้ได้ครบจนข้อสอบถูกต้องและมีข้อถูกข้อเดียว ใส่ใน fix เฉพาะช่องที่ต้องแก้ (stem, choices, answer, explanation) ช่องที่ไม่แก้ให้เป็น null ถ้าแก้ choices ต้องให้ answer ด้วยเสมอ (answer = ลำดับ 0-3 ใน choices ใหม่) และ choices ต้องไม่มี ก. ข. นำหน้า",
    "- hide = รายงานมีมูล แต่แก้ให้ชัดเจนไม่ได้ (กำกวม มีหลายข้อถูก ขาดข้อมูลหรือเอกสารต้นทาง)",
    "- human = ไม่แน่ใจ หรือต้องเช็กข้อมูลภายนอก (เช่น กฎหมายหรือตัวเลขที่เปลี่ยนไปตามปี) ห้ามเดา",
    "",
    "ข้อห้าม: อย่าเปลี่ยนเฉลยถ้าไม่แน่ใจ 100% และผลของผู้ตรวจที่ไม่เห็นเฉลยไม่สนับสนุน อย่าเขียนข้อเท็จจริงที่ไม่แน่ใจ ถ้าต้องคำนวณให้คำนวณใหม่ทุกครั้ง",
    "",
    "analysis = สรุปสั้นๆ ภาษาไทย 1-3 ประโยค สำหรับแอดมิน (บอกว่าตรวจอะไร พบอะไร และเสนอให้ทำอะไร) เขียนเป็นข้อเสนอ เช่น \"ควรแก้...\" ห้ามเขียนว่าแก้แล้วหรือทีมงานปรับแก้แล้ว เพราะแอดมินยังไม่ได้ยืนยัน",
    "user_message = ข้อความถึงผู้รายงาน ภาษาไทยง่ายๆ เหมือนพี่ครูพูดกับผู้เรียน ไม่เกิน 3 ประโยคสั้นๆ ขึ้นต้นด้วยขอบคุณ",
    "  บอกผลให้ชัดว่าแก้อะไร หรือทำไมข้อนี้ถูกอยู่แล้ว (อธิบายเหตุผลสั้นๆ แบบเป็นมิตร) ไม่ตำหนิ ไม่ใช้ศัพท์ยาก ไม่พูดถึง AI หรือระบบตรวจอัตโนมัติ ใช้คำว่า ทีมงาน",
    "confidence = ความมั่นใจ 0-100 ในผลที่เลือก",
  ].join("\n");
}

export const JUDGE_SCHEMA = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING", enum: ["ok", "fix", "hide", "human"] },
    confidence: { type: "INTEGER" },
    analysis: { type: "STRING" },
    fix: {
      type: "OBJECT", nullable: true,
      properties: {
        stem: { type: "STRING", nullable: true },
        choices: { type: "ARRAY", items: { type: "STRING" }, nullable: true },
        answer: { type: "INTEGER", nullable: true },
        explanation: { type: "STRING", nullable: true },
      },
    },
    user_message: { type: "STRING" },
  },
  required: ["verdict", "confidence", "analysis", "user_message"],
};

const STRIP_PREFIX = /^\s*(?:[ก-ง][\.\)]|\(?[ก-ง]\)|[A-Da-d][\.\)]|\(?[1-4][\.\)])\s*/;

export function parseJson(text: string): Record<string, unknown> {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const v = JSON.parse(t);
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("ผลลัพธ์ไม่ใช่ JSON object");
  return v as Record<string, unknown>;
}

export function normalizeBlind(raw: Record<string, unknown>): Blind {
  const a = typeof raw.answer === "number" && Number.isInteger(raw.answer) && raw.answer >= 0 && raw.answer <= 3 ? raw.answer : null;
  return {
    answer: a, confident: raw.confident === true, ambiguous: raw.ambiguous === true,
    working: typeof raw.working === "string" ? raw.working.slice(0, 600) : "",
  };
}

/** Returns a clean Fix or null when nothing usable / invalid. */
export function cleanFix(raw: unknown): Fix | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const fix: Fix = {};
  if (typeof r.stem === "string" && r.stem.trim()) fix.stem = r.stem.trim().slice(0, 2000);
  if (typeof r.explanation === "string" && r.explanation.trim()) fix.explanation = r.explanation.trim().slice(0, 2000);
  if (Array.isArray(r.choices)) {
    const ch = r.choices.map(c => (typeof c === "string" ? c.replace(STRIP_PREFIX, "").trim() : ""));
    if (ch.length !== 4 || ch.some(c => !c || c.length > 500) || new Set(ch.map(q)).size !== 4) return null;
    fix.choices = ch;
  }
  if (r.answer != null) {
    if (typeof r.answer !== "number" || !Number.isInteger(r.answer) || r.answer < 0 || r.answer > 3) return null;
    fix.answer = r.answer;
  }
  if (fix.choices && fix.answer == null) return null;   // new choices without a new key would silently shift the key
  return Object.keys(fix).length ? fix : null;
}

/** Turns the raw judge output into a review, downgrading to "human" whenever the safety rules are not met. */
export function finalize(ctx: Ctx, blind: Blind, judgeRaw: Record<string, unknown>): Review {
  const notes: string[] = [];
  let verdict: Verdict = (["ok", "fix", "hide", "human"] as const).includes(judgeRaw.verdict as Verdict) ? judgeRaw.verdict as Verdict : "human";
  const confidence = Math.max(0, Math.min(100, Math.round(Number(judgeRaw.confidence) || 0)));
  let analysis = typeof judgeRaw.analysis === "string" ? judgeRaw.analysis.trim().slice(0, 1200) : "";
  let message = typeof judgeRaw.user_message === "string" ? judgeRaw.user_message.trim().slice(0, 500) : "";
  let fix: Fix | null = null;
  // the AI's own edit, kept as a draft for the admin if the review ends up "human"
  const proposed = judgeRaw.verdict === "fix" || judgeRaw.verdict === "human" ? cleanFix(judgeRaw.fix) : null;

  const downgrade = (why: string) => { notes.push(why); verdict = "human"; };

  if (verdict !== "human" && confidence < MIN_CONFIDENCE) downgrade(`ความมั่นใจต่ำ (${confidence}%) ให้คนตรวจ`);

  const oldKey = choiceText(ctx, ctx.question.answer);
  const blindText = choiceText(ctx, blind.answer);
  const blindOk = blind.answer != null && !blind.ambiguous;

  if (verdict === "ok") {
    if (!blindOk || q(blindText) !== q(oldKey)) downgrade("ผู้ตรวจที่ไม่เห็นเฉลยตอบไม่ตรงกับเฉลยเดิม ไม่ควรสรุปว่าข้อนี้ถูก");
  } else if (verdict === "fix") {
    fix = cleanFix(judgeRaw.fix);
    if (!fix) downgrade("วิธีแก้ที่ AI เสนอใช้ไม่ได้ (ตัวเลือกไม่ครบ/ซ้ำ หรือไม่มีเฉลยใหม่)");
    else {
      const newChoices = fix.choices ?? ctx.question.choices;
      const newKey = String(newChoices[fix.answer ?? ctx.question.answer] ?? "");
      if (!blindOk || q(blindText) !== q(newKey)) {
        downgrade(fix.choices || fix.stem
          ? "ข้อเสนอแก้ตัวเลือก/โจทย์ด้วย แต่ผู้ตรวจที่ไม่เห็นเฉลยทำจากข้อเดิม จึงยืนยันไม่ได้ ให้คนตรวจข้อเสนอนี้"
          : "เฉลยใหม่ที่เสนอ ผู้ตรวจที่ไม่เห็นเฉลยไม่ยืนยัน ให้คนตรวจ");
        fix = null;
      }
    }
  }

  let suggestion: Fix | null = null;
  if (verdict === "human") {
    fix = null;
    suggestion = proposed;
    if (!analysis) analysis = "AI ไม่แน่ใจ ควรให้คนตรวจ";
    message = DEFAULT_MESSAGE.human;
  } else if (!message) {
    message = DEFAULT_MESSAGE[verdict];
  }
  if (notes.length) analysis = `${analysis ? analysis + " " : ""}[ระบบ: ${notes.join("; ")}]`.trim();
  return { verdict, confidence, analysis, fix, user_message: message, blind_answer: blind.answer, notes, suggestion };
}

// ---------- admin changed the key by hand: draft an explanation that matches the new key ----------
// The admin's draft (stem / choices / new key) is what the explanation must fit, not the stored question.
export type Draft = { stem: string; choices: string[]; answer: number };
export type Explain = { explanation: string; agrees: boolean; note: string };

/** Validates the draft sent by the browser; returns null when it cannot be used. */
export function cleanDraft(raw: unknown): Draft | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const stem = typeof r.stem === "string" ? r.stem.trim() : "";
  if (!stem || stem.length > 2000) return null;
  if (!Array.isArray(r.choices) || r.choices.length !== 4) return null;
  const choices = r.choices.map(c => (typeof c === "string" ? c.trim() : ""));
  if (choices.some(c => !c || c.length > 500)) return null;
  const a = r.answer;
  if (typeof a !== "number" || !Number.isInteger(a) || a < 0 || a > 3) return null;
  return { stem, choices, answer: a };
}

export function explainPrompt(ctx: Ctx, d: Draft): string {
  const x = ctx.question;
  const lines = [
    "คุณเป็นบรรณาธิการข้อสอบครูผู้ช่วยของไทย แอดมินเปลี่ยนเฉลยของข้อสอบข้อนี้ ให้เขียนคำอธิบายใหม่ให้ตรงกับเฉลยใหม่",
    "",
    `วิชา/หมวด: ${x.topic_name}`,
    `โจทย์: ${d.stem}`,
    ...d.choices.map((c, i) => `${LABELS[i]}. ${c}`),
    `เฉลยใหม่ (แอดมินเลือก): ${LABELS[d.answer]}. ${d.choices[d.answer]}`,
    `เฉลยเดิม: ${LABELS[x.answer]}. ${x.choices[x.answer] ?? ""}`,
  ];
  if (x.explanation) lines.push(`คำอธิบายเดิม (ของเฉลยเดิม อาจผิด): ${x.explanation}`);
  if (x.law_ref) lines.push(`อ้างอิงกฎหมาย: ${x.law_ref}`);
  if (ctx.reports.length) lines.push("รายงานจากผู้ใช้:", ...ctx.reports.map(r => `- ${r.reason.replace(/^\[[^\]]*\]\s*/, "") || r.label}`));
  lines.push(
    "",
    "explanation = คำอธิบายภาษาไทย 1-3 ประโยค แบบเดียวกับคำอธิบายในข้อสอบ: บอกว่าทำไมข้อ " + LABELS[d.answer] + " ถูก และถ้ามีตัวเลือกที่คนน่าจะสับสน บอกสั้นๆ ว่าต่างกันอย่างไร",
    "  ห้ามขึ้นต้นด้วย \"เฉลย\" หรือ \"ข้อ ... ถูก\" ซ้ำกับตัวเลือก ห้ามพูดถึงแอดมิน AI หรือเฉลยเดิม ห้ามแต่งข้อเท็จจริง ตัวเลข หรือมาตรากฎหมายที่ไม่แน่ใจ",
    "agrees = true ถ้าคุณเห็นด้วยว่าเฉลยใหม่ถูก, false ถ้าคิดว่าผิดหรือมีหลายข้อถูก",
    "note = ถ้า agrees เป็น false บอกสั้นๆ ว่าคิดว่าข้อไหนถูกเพราะอะไร (ภาษาไทย 1 ประโยค) ถ้าเห็นด้วยให้เป็นค่าว่าง",
  );
  return lines.join("\n");
}

export const EXPLAIN_SCHEMA = {
  type: "OBJECT",
  properties: { explanation: { type: "STRING" }, agrees: { type: "BOOLEAN" }, note: { type: "STRING" } },
  required: ["explanation", "agrees", "note"],
};

export function normalizeExplain(raw: Record<string, unknown>): Explain {
  const explanation = typeof raw.explanation === "string" ? raw.explanation.trim().slice(0, 2000) : "";
  if (!explanation) throw new Error("AI ไม่ได้เขียนคำอธิบายมา");
  return {
    explanation,
    agrees: raw.agrees !== false,
    note: raw.agrees === false && typeof raw.note === "string" ? raw.note.trim().slice(0, 300) : "",
  };
}
