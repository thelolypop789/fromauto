import { createClient } from "@supabase/supabase-js";

// Own storage key: /prep sessions stay separate from the teacher app's Supabase session
// (the teacher login page signs out any non-school account it sees).
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co",
  import.meta.env.VITE_SUPABASE_KEY || "placeholder",
  { auth: { storageKey: "fromauto-prep-auth", persistSession: true, detectSessionInUrl: true } },
);

export type Me = {
  plan: "free" | "paid";
  free_sets_used: number;
  free_sets_limit: number;
  max_set_size: number;
  is_admin: boolean;
  answered_today: number;
  daily_cap: number;
};

export type Topic = { code: string; section: "A" | "B"; grp: string; name: string; sort: number; available: number };

export type SetSummary = {
  id: string;
  title: string;
  topics: string[];
  size: number;
  rounds: number;
  best_pct: number | null;
  remaining: number;
  cleared_at: string | null;
  created_at: string;
  open_round: { answered: number; total: number; mode: "full" | "wrong" } | null;
};

export type Item = {
  idx: number;
  question_id: number;
  topic: string;
  stem: string;
  choices: string[];
  picked: number | null;
  correct: boolean | null;
  answer: number | null;
  explanation: string | null;
  law_ref: string | null;
};

export type Round = { attempt_id: string; set_id: string; title: string; round_no: number; mode: "full" | "wrong"; items: Item[] };

export type AnswerResult = { picked: number; correct: boolean; answer: number; explanation: string; law_ref: string | null };

export type SubmitResult = {
  set_id: string; round_no: number; mode: "full" | "wrong";
  correct: number; total: number; pct: number; wrong_count: number; cleared: boolean;
};

export type TopicStat = { code: string; name: string; grp: string; section: string; n: number; correct: number; available: number; seen: number };

export type Dashboard = {
  answered_total: number; correct_total: number; seen: number; bank: number;
  stubborn: number; still_wrong: number; streak: number; sets: number; sets_cleared: number;
  days: { day: string; answered: number; correct: number }[];
  topics: TopicStat[];
};

const ERRORS: Record<string, string> = {
  not_authenticated: "กรุณาเข้าสู่ระบบใหม่",
  free_quota_exceeded: "ใช้ชุดฟรีครบ 3 ชุดแล้ว — อัปเกรดเพื่อสร้างชุดใหม่ได้ไม่จำกัด",
  invalid_size: "จำนวนข้อไม่ถูกต้อง",
  duplicate_question: "มีข้อสอบที่โจทย์และตัวเลือกเหมือนกันอยู่แล้ว",
  invalid_choices: "ต้องมี 4 ตัวเลือก",
  invalid_stem: "กรุณากรอกโจทย์",
  invalid_topic: "หมวดไม่ถูกต้อง",
  no_topics: "กรุณาเลือกอย่างน้อย 1 หมวด",
  not_enough_questions: "หมวดที่เลือกยังมีข้อสอบไม่พอ ลองเลือกเพิ่มหมวด",
  nothing_wrong: "ชุดนี้ไม่มีข้อที่ผิดแล้ว",
  round_closed: "รอบนี้ส่งไปแล้ว",
  daily_cap: "วันนี้ทำครบ 1,000 ข้อแล้ว พักสายตาก่อนนะ แล้วมาต่อพรุ่งนี้",
  not_found: "ไม่พบข้อมูล",
  forbidden: "ไม่มีสิทธิ์",
  too_many_reports: "แจ้งปัญหาวันนี้ครบจำนวนแล้ว",
  empty_reason: "กรุณาระบุรายละเอียดของปัญหา",
};

export function thaiError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  return ERRORS[msg] ?? msg;
}

export async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

// Display order of the 4 choices for one question in one round. Deterministic, so a resumed
// round shows the same order. Fine to do client-side: the browser never has the key early.
export function choiceOrder(seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let s = h >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const order = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export const GROUPS: Record<string, string> = {
  A1: "ความสามารถในการคิดวิเคราะห์",
  A2: "ภาษาอังกฤษ",
  A3: "ความรู้และลักษณะการเป็นข้าราชการที่ดี",
  B1: "วิชาการศึกษา",
  B2: "กฎหมายและนโยบายการศึกษา",
};

export const SECTIONS: Record<"A" | "B", { short: string; name: string; groups: string[] }> = {
  A: { short: "ภาค ก", name: "ความรู้ความสามารถทั่วไป", groups: ["A1", "A2", "A3"] },
  B: { short: "ภาค ข", name: "ความรู้ความสามารถที่ใช้เฉพาะตำแหน่ง", groups: ["B1", "B2"] },
};

export const LEVELS: Record<string, string> = {
  remember: "จำ", understand: "เข้าใจ", apply: "ประยุกต์ใช้", analyze: "วิเคราะห์",
};

export const PASS_PCT = 60;

export type Insights = {
  sections: { section: "A" | "B"; available: number; n: number; correct: number; seen: number; mastered: number; still_wrong: number }[];
  groups: { grp: string; section: string; available: number; n: number; correct: number }[];
  levels: { level: string; n: number; correct: number }[];
  difficulty: { band: "easy" | "medium" | "hard" | "new"; n: number; correct: number }[];
  mastery: { seen: number; mastered: number; recovered: number; still_wrong: number; stubborn: number };
  weeks: { week: string; answered: number; n: number; correct: number }[];
  days: { day: string; answered: number; correct: number }[];
  weekdays: { dow: number; answered: number; correct: number }[];
  hours: { hour: number; n: number; correct: number }[];
  rounds: { at: string; mode: "full" | "wrong"; round_no: number; title: string; total: number; correct: number }[];
  round_totals: { all: number; full: number; wrong: number };
  stubborn_list: { id: number; topic: string; stem: string; wrong: number; seen: number; last_correct: boolean | null }[];
};

export const REPORT_CATEGORIES: [string, string, string][] = [
  ["wrong_answer", "เฉลยผิด", "คำตอบที่ถูกควรเป็นข้ออื่น"],
  ["choices", "ตัวเลือกมีปัญหา", "ถูกมากกว่า 1 ข้อ / ไม่มีข้อถูก / ซ้ำกัน"],
  ["unclear", "โจทย์ไม่ชัดเจน", "กำกวม ตีความได้หลายแบบ"],
  ["typo", "พิมพ์ผิด", "สะกดผิด ข้อความตกหล่น"],
  ["explanation", "คำอธิบายไม่ถูกต้อง", "คำอธิบายผิดหรือไม่ตรงกับเฉลย"],
  ["outdated", "ข้อมูลล้าสมัย", "กฎหมาย/นโยบายเปลี่ยนแล้ว"],
  ["other", "อื่นๆ", "ระบุรายละเอียด"],
];
