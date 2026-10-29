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
  packages?: { package: PackageKey; expires_at: string | null }[];
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
  tag?: string | null;          // e.g. "แนวข้อสอบ สอศ. 2567": the point appeared in that year's exam
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
  free_quota_exceeded: "ใช้ชุดฟรีครบ 3 ชุดแล้ว — หมวดที่เลือกอยู่นอกแพ็กของคุณ ซื้อแพ็กที่ครอบคลุมเพื่อสร้างชุดได้ไม่จำกัด",
  invalid_size: "จำนวนข้อไม่ถูกต้อง (ชุดที่มีหมวดนอกแพ็กของคุณสร้างได้ไม่เกิน 40 ข้อ)",
  invalid_package: "แพ็กไม่ถูกต้อง",
  invalid_duration: "ระยะเวลาไม่ถูกต้อง",
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
  needs_human_review: "ข้อนี้ AI ไม่แน่ใจ ต้องแก้หรือตอบเองในรายการด้านล่าง",
  already_done: "รายการนี้ถูกจัดการไปแล้ว",
  invalid_fix: "วิธีแก้ที่ AI เสนอใช้ไม่ได้",
  empty_message: "ข้อความถึงผู้รายงานว่างอยู่",
  no_open_reports: "ข้อนี้ไม่มีรายงานที่รอตรวจแล้ว",
  forbidden: "ไม่มีสิทธิ์",
  too_many_reports: "แจ้งปัญหาวันนี้ครบจำนวนแล้ว",
  empty_reason: "กรุณาระบุรายละเอียดของปัญหา",
  too_many_feedback: "วันนี้ส่งข้อเสนอแนะครบจำนวนแล้ว ขอบคุณมากครับ",
  empty_feedback: "กรุณาพิมพ์รายละเอียดก่อนส่ง",
  invalid_rating: "กรุณาให้ดาวก่อนส่งรีวิว",
  invalid_slip: "อัปโหลดสลิปไม่สำเร็จ ลองใหม่อีกครั้ง",
  too_many_orders: "มีรายการรอตรวจอยู่แล้ว 3 รายการ กรุณารอทีมงานตรวจก่อน",
  already_reviewed: "รายการนี้ตรวจไปแล้ว",
  already_owned: "คุณมีสิทธิ์ตามแพ็กนี้แบบซื้อขาดอยู่แล้ว",
  nothing_to_upgrade: "ตัวเลือกนี้ไม่ต้องซื้อหรือไม่คุ้มสำหรับบัญชีของคุณ ลองเลือกแบบอื่น (เช่น ซื้อขาด)",
  invalid_price: "ราคาไม่ถูกต้อง",
  empty_recipient: "กรุณาใส่ชื่อผู้รับส่วนลด",
  already_redeemed: "รหัสนี้ถูกใช้ไปแล้ว ยกเลิกไม่ได้ (ถอนสิทธิ์ได้ที่หน้าผู้ใช้)",
  promo_not_found: "ไม่พบโค้ดส่วนลดนี้ ตรวจตัวสะกดอีกครั้ง",
  promo_inactive: "โค้ดนี้ปิดใช้งานแล้ว",
  promo_expired: "โค้ดนี้หมดอายุแล้ว",
  promo_used_up: "โค้ดนี้ถูกใช้ครบจำนวนแล้ว",
  promo_already_used: "บัญชีนี้ใช้โค้ดนี้ไปแล้ว",
  promo_not_for_package: "โค้ดนี้ใช้กับแพ็กที่เลือกไม่ได้",
  promo_exists: "มีโค้ดนี้อยู่แล้ว",
  promo_not_with_group: "แพ็กกลุ่มใช้ร่วมกับโค้ดส่วนลดไม่ได้ (ราคากลุ่มลดให้แล้ว)",
  invalid_group: "แพ็กกลุ่มนี้ปิดอยู่หรือไม่มี เลือกใหม่อีกครั้ง",
  bad_deal: "ชื่อ 2–30 ตัวอักษร และส่วนลด 1–60%",
  bad_nickname: "ชื่อต้องยาว 2–16 ตัวอักษร ใช้ไทย อังกฤษ ตัวเลข ช่องว่าง . _ - ได้ และห้ามใส่ลิงก์",
  bad_board: "ไม่พบตารางอันดับนี้",
  promo_bad_code: "โค้ดใช้ได้เฉพาะ A–Z, 0–9, - และ _ ยาว 3–30 ตัว",
  promo_bad_value: "ส่วนลดไม่ถูกต้อง (เปอร์เซ็นต์ได้ 1–90)",
  nothing_to_review: "ยังไม่มีข้อให้ทวน ทำชุดฝึกก่อน ข้อที่ตอบผิดจะมารอทวนที่นี่",
  network_timeout: "เครือข่ายช้าหรือหลุด ลองใหม่อีกครั้ง",
  mock_locked: "วิชานี้ต้องมีแพ็กที่ครอบคลุม (ทดลองฟรีได้เฉพาะภาษาอังกฤษ 1 ครั้ง)",
  no_major: "กรุณาเลือกวิชาเอกในหน้าบัญชีก่อน",
  time_up: "หมดเวลาแล้ว ระบบส่งข้อสอบให้อัตโนมัติ",
  invalid_subject: "ไม่พบวิชานี้",
  empty_title: "กรุณาตั้งชื่อโพสต์ (ชื่อนี้เห็นเฉพาะแอดมิน)",
  empty_post: "โพสต์ต้องมีข้อความหรือรูปอย่างน้อยหนึ่งอย่าง",
  too_long: "ข้อความยาวเกินไป",
  bad_path: "ชื่อไฟล์รูปไม่ถูกต้อง ลองอัปโหลดใหม่",
  too_many_images: "โพสต์หนึ่งใส่รูปได้ไม่เกิน 10 รูป",
  bad_delay: "เวลารอคอมเมนต์ต้องอยู่ระหว่าง 0–1440 นาที",
  locked: "โพสต์นี้ขึ้นเพจแล้วหรือกำลังโพสต์ แก้หรือลบไม่ได้",
  incomplete: "โพสต์ยังไม่ครบ ต้องตั้งเวลาและมีข้อความหรือรูป",
  in_past: "เวลาที่ตั้งผ่านมาแล้ว กรุณาแก้เวลาก่อนอนุมัติ",
  pack_expired: "แพ็กของชุดนี้หมดอายุแล้ว ต่ออายุเพื่อทำชุดนี้ต่อ (ผลและประวัติเดิมยังดูได้)",
};

export function thaiError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  return ERRORS[msg] ?? msg;
}

// A request that never answers (bad network, stuck connection) must end in an error the screen can show,
// not an endless spinner. 30s is far above any normal call.
// Admin "view as": while set, every call carries the user's id. The database honours it only for admins and only in
// read-only (STABLE) functions, so the analysis page shows that user's data and nothing can be written as them.
let viewAs: string | null = null;
export const setViewAs = (id: string | null) => { viewAs = id; };

export async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const q = supabase.rpc(fn, args);
  if (viewAs) q.setHeader("x-view-as", viewAs);
  const { data, error } = await q.abortSignal(AbortSignal.timeout(30_000));
  if (error) throw new Error(error.name === "AbortError" || /abort/i.test(error.message) ? "network_timeout" : error.message);
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
  B3: "วิชาเอก",
};

export const SECTIONS: Record<"A" | "B", { short: string; name: string; groups: string[] }> = {
  A: { short: "ภาค ก", name: "ความรู้ความสามารถทั่วไป", groups: ["A1", "A2", "A3"] },
  B: { short: "ภาค ข", name: "ความรู้ความสามารถที่ใช้เฉพาะตำแหน่ง", groups: ["B1", "B2", "B3"] },
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

export type Track = "obec" | "vec";
export const TRACK_LABEL: Record<Track, string> = { obec: "สพฐ.", vec: "อาชีวศึกษา (สอศ.)" };
export type Profile = { major: string | null; major_name: string | null; track?: Track; track_chosen?: boolean; returning?: boolean };

export type PackageKey = "A" | "B" | "ALL";
export const PACKAGE_LABEL: Record<PackageKey, string> = { A: "ภาค ก", B: "ภาค ข + วิชาเอก", ALL: "ครบทุกภาค" };

// True when the user's packages cover every section in the list ("A" / "B").
export function covers(me: Me, sections: string[]): boolean {
  const owned = new Set((me.packages ?? []).map(p => p.package));
  if (owned.has("ALL")) return true;
  return sections.length > 0 && sections.every(s => owned.has(s as PackageKey));
}

// Round packages that end within `days` days and are not covered by another longer-lived package.
export function expiringSoon(me: Me, now: number, days = 7): { package: PackageKey; expires_at: string; left: number }[] {
  const pk = me.packages ?? [];
  const soonMs = now + days * 86_400_000;
  const lasts = (k: PackageKey) => { const p = pk.find(x => x.package === k); return !!p && (p.expires_at === null || new Date(p.expires_at).getTime() > soonMs); };
  return pk.flatMap(p => {
    if (!p.expires_at || new Date(p.expires_at).getTime() > soonMs) return [];
    const covered = p.package === "ALL" ? lasts("A") && lasts("B") : lasts("ALL");
    return covered ? [] : [{ package: p.package, expires_at: p.expires_at, left: Math.max(1, Math.ceil((new Date(p.expires_at).getTime() - now) / 86_400_000)) }];
  });
}

export const fmtUntil = (iso: string | null) =>
  iso ? `ถึง ${new Date(new Date(iso).getTime() - 1).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}` : "ตลอดชีพ";

export type Order = {
  id: number; package: PackageKey; term: "round" | "lifetime"; amount: number | null;
  status: "pending" | "approved" | "rejected"; admin_note: string | null; seats?: number; group_name?: string | null;
  created_at: string; reviewed_at: string | null; access_until?: string | null;
};
export type Price = { package: PackageKey; term: "round" | "lifetime"; amount: number };
// Server price for this account: credit is deducted when the buyer already holds part of the package.
export type Quote = {
  package: PackageKey; term: "round" | "lifetime"; base?: number; credit?: number; amount?: number;
  kind?: "new" | "renew" | "upgrade"; expires_at?: string | null; error?: string;
};
export type ReviewCounts = { due: number; wrong: number };
export type DailyItem = {
  idx: number; stem: string; choices: string[]; picked: number | null;
  correct?: boolean; answer?: number; explanation?: string; pct_correct?: number | null;
};
export type Daily = { day: string; items: DailyItem[]; done: boolean; score: number; total: number; streak: number; players: number };
export type ScoreDistData = {
  kind: "daily" | "mock"; total: number; mine: number; players: number; rank: number | null; avg: number | null;
  best: number | null; buckets: number[] | null; history: { label: string; value: number; current: boolean }[];
};
export type Progress = {
  xp: number; answered: number; correct: number; daily_done: number; mocks: number;
  streak: number; best_streak: number; active_days: number; practiced_today: boolean;
};
export type Readiness = {
  has_major: boolean; answered: number; overall: number | null; margin?: number;   // rough ± of overall
  sections: { section: "A" | "B"; pct: number; n: number; subjects: { code: string; name: string; questions: number; pct: number; n: number }[] }[];
  focus: { code: string; sub: string | null; name: string; subject: string; w: number; pct: number; n: number }[];
  subject_focus?: Record<string, { code: string; sub: string | null; name: string }>;
  signals?: ReadinessSignals;
};
// Six behaviour readings, 0–100 each; score is null until there is enough data (see prep_readiness).
export type ReadinessSignals = {
  accuracy: { score: number | null; n: number; retained: number; shaky: number };
  speed: { score: number | null; n: number; median_s: number | null; slow: number };
  errors: { score: number | null; n: number; repeated: number; guess: number; careless: number; concept: number };
  stamina: { score: number | null; sessions: number; first: number | null; last: number | null };
  fix: { score: number | null; n: number; fixed: number; redo: number; dwell_s: number | null };
  coverage: { score: number | null; fresh: number; untouched: number; units: number };
};
export type Scorecard = {
  sections: {
    section: "A" | "B"; questions: number; best_sum: number; done: number; subjects_n: number;
    subjects: { code: string; name: string; questions: number; best: number | null; last: number | null; last_at: string | null; tries: number; history: number[] }[];
  }[];
};
export type Subtopic = {
  code: string; name: string; kind: "content" | "pedagogy"; keywords: string; share: number; available: number; seen: number; right: number;
};
export type GroupQuote = {
  seats: number; name: string; emoji: string; pct_off: number; package: PackageKey; term: "round" | "lifetime";
  base: number; per_seat: number; total: number; save: number;
};
export type GroupKeys = {
  order_id: number; name: string | null; seats: number; package: PackageKey; term: "round" | "lifetime"; created_at: string | null;
  keys: { key: string; used: boolean; mine: boolean | null; revoked: boolean }[];
};
export type PromoQuote = Quote & { code?: string; before?: number; discount?: number };
export type MockSubject = {
  code: string; section: "A" | "B"; name: string; questions: number; minutes: number; available: number;
  reason: "no_major" | "not_enough_questions" | null; access: "pack" | "free_trial" | "locked";
  best: number | null; tries: number; open: { id: string; deadline: string } | null;
};
export type MockOverview = { subjects: MockSubject[]; server_now: string; major_name: string | null };
export type MockItem = {
  idx: number; question_id: number; topic: string; tag?: string | null; stem: string; choices: string[]; picked: number | null;
  answer?: number; correct?: boolean; explanation?: string; law_ref?: string | null;
};
export type MockResultData = {
  score: number; total: number; pct: number; used_seconds: number; answered: number; players: number;
  percentile: number | null; per_topic: { topic: string; n: number; correct: number }[];
};
export type MockPayload = {
  attempt_id: string; subject: string; name: string; minutes: number; started_at: string; deadline: string;
  server_now: string; submitted: boolean; free_trial: boolean; items: MockItem[]; result: MockResultData | null;
};
export const TERM_LABEL = { round: "รายรอบ 3 เดือน", lifetime: "ซื้อขาด" } as const;

// ---- Usage events: only three, one per user per day, no content. The link's ?src= (e.g. /prep?src=fb-post1) is kept so the
// first visit after Google sign-in can still say where the user came from.
const SRC_KEY = "pp-src";
try {
  const q = new URLSearchParams(window.location.search).get("src");
  if (q) localStorage.setItem(SRC_KEY, q.slice(0, 40));
  // A campaign link can carry its discount code (?promo=KRU20): kept until the buy screen applies it.
  const promo = new URLSearchParams(window.location.search).get("promo");
  if (promo && /^[A-Za-z0-9_-]{3,30}$/.test(promo)) localStorage.setItem("pp-promo", promo.toUpperCase());
  // ?track=obec|vec (landing page buttons) preselects the exam on the first-visit screen.
  const trk = new URLSearchParams(window.location.search).get("track");
  if (trk === "obec" || trk === "vec") localStorage.setItem("pp-track", trk);
} catch { /* storage blocked: no source, nothing else lost */ }

export type TrackName = "visit" | "buy_view" | "free_limit" | "level_view" | "readiness_view" | "subtopic_pick" | "promo_apply" | "scoredist_view" | "board_view" | "install_view" | "install_click" | "install_done" | "summary_view"
  // pay funnel: the free-limit button to the buy screen, then each step of paying (where buyers drop out)
  | "paywall_click" | "pkg_select" | "qr_save" | "slip_pick" | "slip_fail";
export function track(name: TrackName) {
  if (viewAs) return;   // an admin looking at someone's page is not a usage event
  try {
    const flag = `pp-ev-${name}`;
    if (sessionStorage.getItem(flag)) return;
    sessionStorage.setItem(flag, "1");
  } catch { /* storage blocked: the database still keeps one per day */ }
  let src = "";
  try { src = localStorage.getItem(SRC_KEY) ?? ""; } catch { /* ignore */ }
  rpc("prep_track", { p_name: name, p_props: name === "visit" && src ? { src } : {} }).catch(() => { /* analytics never blocks the app */ });
}

// Presence: while a signed-in tab is visible, tell the server we are here once a minute. Feeds the admin "ตอนนี้" tab.
export function startPing(): () => void {
  const send = () => { if (document.visibilityState === "visible") rpc("prep_ping").catch(() => { /* never blocks the app */ }); };
  send();
  const id = setInterval(send, 60_000);
  document.addEventListener("visibilitychange", send);
  return () => { clearInterval(id); document.removeEventListener("visibilitychange", send); };
}
