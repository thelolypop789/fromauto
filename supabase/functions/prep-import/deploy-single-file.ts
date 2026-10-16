// GENERATED single-file bundle of index.ts + logic.ts, for pasting into the Supabase dashboard editor.
// Regenerate with: python3 scripts/prep/bundle_import_fn.py (do not edit by hand).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Pure helpers for prep-import (no Deno APIs, so they can be unit-tested with node).

type TopicInfo = { code: string; name: string };
type Mode = "auto" | "extract" | "generate";

type DraftQuestion = {
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

const LEVELS = ["remember", "understand", "apply", "analyze"] as const;

function buildPrompt(mode: Mode, topics: TopicInfo[], opts: { count: number; hint: string; pages?: string; avoid?: string[] }): string {
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
function responseSchema(topicCodes: string[]) {
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
function refersToMissingSource(stem: string): boolean {
  if (DOC_META.test(stem)) return true;
  // a passage quoted or pasted into the stem makes the question self-contained; a short stem with no quote is not
  return stem.length < 200 && !QUOTE_CHARS.test(stem) && PASSAGE_REF.test(stem);
}

function stripPrefix(s: string): string {
  return s.replace(STRIP_PREFIX, "").trim();
}

// Validates one model-produced item. Returns the cleaned question, or a reason it was dropped.
function normalize(raw: unknown, topicCodes: Set<string>): { q?: DraftQuestion; drop?: string } {
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
function parseModelJson(text: string): { items: unknown[]; more: boolean } {
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

// Admin-only: turns a study sheet / old exam (text, PDF slice, images, Word with pictures) into draft questions with Gemini.
// Uses the same GEMINI_KEY secret as parse-exam. Drafts are returned to the browser, which sends
// the ones the admin keeps to public.prep_admin_import (status = review).

const GEMINI_KEY = Deno.env.get("GEMINI_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Model chain per quality level; the next model is tried on overload / unknown model name.
// PREP_IMPORT_MODEL (secret) overrides the first model of "fast".
const MODELS: Record<string, string[]> = {
  best: ["gemini-3.5-pro", "gemini-pro-latest", "gemini-3.5-flash", "gemini-flash-latest"],
  balanced: ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.5-pro"],
  fast: [Deno.env.get("PREP_IMPORT_MODEL") || "gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-flash-latest"],
};

const MAX_BODY_BYTES = 9 * 1024 * 1024;
const MAX_TEXT_CHARS = 200_000;
const MAX_COUNT = 60;      // per request; the browser keeps asking until the model reports nothing more
const MAX_AVOID = 500;
const MAX_FILES = 16;
const MEDIA_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "กรุณาเข้าสู่ระบบ" }, 401);

    // Run as the caller so prep_admin_check() sees their auth.uid().
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: isAdmin, error: adminErr } = await sb.rpc("prep_admin_check");
    if (adminErr || isAdmin !== true) return json({ error: "ไม่มีสิทธิ์แอดมิน" }, 403);

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return json({ error: "ไฟล์ใหญ่เกินไป (ส่งทีละไม่เกินประมาณ 6 MB)" }, 413);
    const body = JSON.parse(raw);

    const mode: Mode = body.mode === "extract" ? "extract" : body.mode === "generate" ? "generate" : "auto";
    // Stems already produced for this slice in earlier rounds, so the model continues instead of repeating.
    const avoid = Array.isArray(body.avoid)
      ? body.avoid.filter((x: unknown) => typeof x === "string").slice(-MAX_AVOID).map((x: string) => x.slice(0, 120))
      : [];
    const count = Math.max(1, Math.min(MAX_COUNT, Math.floor(Number(body.count) || 20)));
    const hint = typeof body.hint === "string" ? body.hint.slice(0, 500) : "";
    const pages = typeof body.pages === "string" ? body.pages.slice(0, 80) : undefined;
    const quality = typeof body.quality === "string" && Object.hasOwn(MODELS, body.quality) ? body.quality : "best";

    // kind "pdf" (legacy): one PDF slice. kind "text": plain text.
    // kind "media": up to MAX_FILES files (PDF / images) plus optional text, e.g. a Word file's text and its pictures.
    const parts: unknown[] = [];
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (body.kind === "pdf") {
      if (typeof body.pdf_base64 !== "string" || body.pdf_base64.length < 100) return json({ error: "ไม่พบไฟล์ PDF" }, 400);
      parts.push({ inlineData: { mimeType: "application/pdf", data: body.pdf_base64 } });
    } else if (body.kind === "media") {
      const files = Array.isArray(body.files) ? body.files : [];
      if (!files.length && text.length < 50) return json({ error: "ไม่พบไฟล์หรือเนื้อหา" }, 400);
      if (files.length > MAX_FILES) return json({ error: `ส่งได้ครั้งละไม่เกิน ${MAX_FILES} ไฟล์` }, 400);
      if (text) parts.push({ text: "เนื้อหาเอกสาร (รูปที่อ้างถึงแนบตามลำดับด้านล่าง):\n" + text.slice(0, MAX_TEXT_CHARS) });
      for (const f of files) {
        if (!f || !MEDIA_TYPES.has(f.mimeType) || typeof f.data !== "string" || f.data.length < 100) {
          return json({ error: "ชนิดไฟล์ไม่รองรับ (รองรับ PDF, PNG, JPG, WebP, HEIC)" }, 400);
        }
        if (typeof f.label === "string" && f.label) parts.push({ text: f.label.slice(0, 120) + ":" });
        parts.push({ inlineData: { mimeType: f.mimeType, data: f.data } });
      }
    } else {
      if (text.length < 50) return json({ error: "เนื้อหาสั้นเกินไป" }, 400);
      parts.push({ text: "เนื้อหาเอกสาร:\n" + text.slice(0, MAX_TEXT_CHARS) });
    }

    const { data: topicRows, error: topicErr } = await sb.rpc("prep_topics");
    if (topicErr) return json({ error: "โหลดหมวดไม่ได้: " + topicErr.message }, 500);
    const topics = (topicRows as TopicInfo[]).map(t => ({ code: t.code, name: t.name }));
    const topicCodes = new Set(topics.map(t => t.code));

    parts.push({ text: buildPrompt(mode, topics, { count, hint, pages, avoid }) });

    const payload = JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: quality === "fast" ? 24000 : 65536,
        responseMimeType: "application/json",
        responseSchema: responseSchema([...topicCodes]),
      },
    });

    let lastError = "";
    for (const model of MODELS[quality]) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
        body: payload,
      });
      const data = await res.json().catch(() => ({}));
      if (data.error) {
        lastError = `${model}: ${data.error.message ?? JSON.stringify(data.error)}`;
        // Account-level problems apply to every model: stop at once and tell the browser not to retry.
        const msg = String(data.error.message ?? "");
        if (/spending cap|billing|API key not valid|API_KEY_INVALID|PERMISSION_DENIED|has been suspended/i.test(msg) || data.error.code === 403) {
          const cap = /spending cap/i.test(msg);
          return json({
            error: cap
              ? "โปรเจกต์ Gemini ใช้เงินถึงวงเงินรายเดือนแล้ว — เพิ่มวงเงินที่ https://ai.studio/spend แล้วลองใหม่"
              : "คีย์ Gemini ใช้งานไม่ได้ (คีย์ผิด ถูกระงับ หรือยังไม่เปิด billing) — ตรวจ GEMINI_KEY ใน Supabase",
            fatal: true, detail: msg.slice(0, 300),
          }, 402);
        }
        // Retry the next model on overload or when this model name is unknown to the API.
        const unknownModel = data.error.code === 400 && /models\/|not found|not supported/i.test(String(data.error.message ?? ""));
        if ([404, 429, 500, 503].includes(data.error.code) || unknownModel) continue;
        return json({ error: "Gemini: " + lastError }, 502);
      }
      const cand = data.candidates?.[0];
      const text = (cand?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
      if (!text) {
        lastError = `${model}: ${cand?.finishReason ?? "ไม่มีผลลัพธ์"}`;
        continue;
      }

      let rawItems: unknown[], more: boolean;
      try { ({ items: rawItems, more } = parseModelJson(text)); }
      catch (e) { lastError = `${model}: ${(e as Error).message}`; continue; }

      const items = [], dropped: string[] = [];
      const seen = new Set<string>();
      for (const r of rawItems) {
        const { q, drop } = normalize(r, topicCodes);
        if (!q) { dropped.push(drop!); continue; }
        const key = q.stem.replace(/\s/g, "");
        if (seen.has(key)) { dropped.push("ข้อซ้ำในชุดเดียวกัน"); continue; }
        seen.add(key);
        items.push(q);
      }
      const truncated = cand?.finishReason === "MAX_TOKENS";
      return json({
        items, dropped, model, truncated,
        more: more || truncated,
        usage: data.usageMetadata ?? null,
      });
    }
    return json({ error: "AI ไม่ตอบ: " + lastError }, 502);
  } catch (e) {
    return json({ error: "เกิดข้อผิดพลาด: " + ((e as Error).message ?? String(e)) }, 500);
  }
});
