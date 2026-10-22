// Labels questions of a major with one of its sub-topics (prep.subtopics) using a cheap Gemini model.
// Callers: pg_cron via prep.subtopic_tick() with header x-cron-secret (checked in the database), or an admin JWT.
// Body: { topic?: string, batches?: number } — without topic it takes the major with the most unlabelled questions.
// Reads/writes only through the service_role RPCs prep_ai_subtopic_work / prep_ai_subtopic_save.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_KEY = Deno.env.get("GEMINI_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODELS = [Deno.env.get("PREP_SUBTOPIC_MODEL") || "gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-flash-latest"];
const BATCH = 40;
const TIME_BUDGET_MS = 100_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Sub = { code: string; name: string; kind: string; keywords: string };
type Q = { id: number; stem: string; choices: string[]; answer: number; explanation: string };
type Work = { topic: string; major: string; subtopics: Sub[]; questions: Q[] };
type Item = { id: number; sub: string | null; conf: number };

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "integer" }, sub: { type: "string" }, conf: { type: "number" } },
        required: ["id", "sub", "conf"],
      },
    },
  },
  required: ["items"],
};

function prompt(w: Work): string {
  const subs = w.subtopics.map(s => `${s.code} | ${s.name} | ${s.kind === "pedagogy" ? "ศาสตร์การสอน" : "เนื้อหา"} | ${s.keywords}`).join("\n");
  const qs = w.questions.map(q => {
    const ch = (q.choices ?? []).map((c, i) => `${"กขคง"[i] ?? i + 1}) ${c}`).join("  ");
    return `[${q.id}] ${q.stem}\n${ch}\nเฉลย: ${"กขคง"[q.answer] ?? q.answer}${q.explanation ? ` · ${q.explanation}` : ""}`;
  }).join("\n\n");
  return `คุณจัดหมวดข้อสอบครูผู้ช่วย วิชาเอก${w.major} ให้อยู่ในหมวดย่อยที่ตรงที่สุด 1 หมวด

หมวดย่อย (code | ชื่อ | ประเภท | คำสำคัญ):
${subs}

หลักการ:
- ดูว่าข้อนี้ "วัดความรู้เรื่องอะไร" จากโจทย์ ตัวเลือก และเฉลย ไม่ใช่ดูแค่คำที่ปรากฏ
- ถ้าข้อถามวิธีสอน การจัดกิจกรรม การวัดผล การจัดการชั้นเรียน ของวิชานี้ ให้เลือกหมวดประเภท "ศาสตร์การสอน"
- ถ้าไม่เข้าหมวดใดเลย (เช่น เป็นเนื้อหาวิชาอื่น) ให้ sub = "NONE"
- conf = ความมั่นใจ 0–1
- ตอบทุกข้อ ใช้ code ตามรายการเท่านั้น

ข้อสอบ:
${qs}`;
}

async function classify(w: Work): Promise<{ items: Item[]; model: string }> {
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt(w) }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 8000, responseMimeType: "application/json", responseSchema: SCHEMA },
  });
  let last = "";
  for (const model of MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY }, body,
      });
      const data = await res.json().catch(() => ({}));
      if (data.error) {
        last = `${model}: ${data.error.message ?? data.error.code}`;
        if (data.error.code === 403 || /spending cap|billing|API key not valid/i.test(String(data.error.message))) throw new Error(last);
        continue;
      }
      const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
      const parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
      const codes = new Set(w.subtopics.map(s => s.code));
      const items: Item[] = (parsed.items ?? [])
        .filter((x: Item) => Number.isInteger(x.id))
        .map((x: Item) => ({ id: x.id, sub: codes.has(String(x.sub)) ? String(x.sub) : null, conf: Math.max(0, Math.min(1, Number(x.conf) || 0)) }));
      return { items, model };
    } catch (e) {
      last = `${model}: ${(e as Error).message}`;
      if (/spending cap|billing|API key not valid|403/i.test(last)) throw new Error(last);
    }
  }
  throw new Error("AI ไม่ตอบ: " + last);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const started = Date.now();
  const svc = createClient(SUPABASE_URL, SERVICE_KEY);
  try {
    const cron = req.headers.get("x-cron-secret");
    if (cron) {
      const { data } = await svc.rpc("prep_subtopic_secret_ok", { p_secret: cron });
      if (data !== true) return json({ error: "forbidden" }, 403);
    } else {
      const auth = req.headers.get("Authorization") ?? "";
      const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
      const { data: isAdmin } = await sb.rpc("prep_admin_check");
      if (isAdmin !== true) return json({ error: "ไม่มีสิทธิ์แอดมิน" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    let topic = typeof body.topic === "string" ? body.topic : "";
    if (!topic) {
      const { data } = await svc.rpc("prep_ai_subtopic_pending");
      topic = (data as { topic: string }[] | null)?.[0]?.topic ?? "";
      if (!topic) return json({ ok: true, done: true });
    }
    const batches = Math.max(1, Math.min(Number(body.batches) || 3, 6));
    let saved = 0, none = 0, missing = 0, model = "";
    for (let b = 0; b < batches && Date.now() - started < TIME_BUDGET_MS; b++) {
      const { data: w, error } = await svc.rpc("prep_ai_subtopic_work", { p_topic: topic, p_limit: BATCH });
      if (error) throw new Error(error.message);
      const work = w as Work;
      if (!work.questions?.length) break;
      const r = await classify(work);
      model = r.model;
      const got = new Map(r.items.map(i => [i.id, i]));
      // Every question in the batch gets a row, so a question the model skips cannot loop forever.
      const items = work.questions.map(q => got.get(q.id) ?? (missing++, { id: q.id, sub: null, conf: 0 }));
      none += items.filter(i => !i.sub).length;
      const { data: n, error: saveErr } = await svc.rpc("prep_ai_subtopic_save", { p_items: items, p_model: r.model });
      if (saveErr) throw new Error(saveErr.message);
      saved += Number(n) || 0;
    }
    return json({ ok: true, topic, saved, none, missing, model, ms: Date.now() - started });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
