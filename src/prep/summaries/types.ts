// Mind-map summaries ("สรุปแบบแผนผัง"): one map per topic group, a mascot hub with 4–6 branches. Each branch shows one
// thing to remember on the overview (big + unit), and opens to blocks of detail. Recall mode hides every `big` value.
// Content is written here by hand and checked by an admin before users see it (prep.summary_approvals).

export type Tone = "pink" | "mint" | "sky" | "lem" | "lil" | "pea";

export type Block =
  | { k: "flower"; center: string; sub?: string; items: { icon: string; t: string }[] }          // 3–8 petals around a core
  | { k: "list"; items: { icon?: string; t: string; d?: string }[] }                            // rows with an icon
  | { k: "pairs"; items: { a: string; b: string }[] }                                           // look-alike facts side by side
  | { k: "steps"; items: { t: string; d?: string }[] }                                          // numbered order
  | { k: "table"; head: string[]; rows: string[][] }
  | { k: "formula"; f: string; d?: string }
  | { k: "example"; q: string; steps: string[]; a: string }                                     // worked problem
  | { k: "words"; items: { w: string; m: string; ex?: string }[] }                              // vocabulary cards
  | { k: "memo"; t: string }                                                                    // memory trick
  | { k: "oops"; t: string }                                                                    // common mistake
  | { k: "note"; t: string }
  | { k: "past"; src: string; q: string; choices: string[]; a: number; why: string }           // a guide question from a named year; answer shown on tap
  | { k: "seq"; terms: string[]; rows: SeqRow[]; ans?: number; cap?: string };                 // number line with a labelled bracket under each step

// One row of brackets under a sequence. step 1 joins neighbours (from `from`, default 0), step 2 joins every other term
// (odd/even series). level2 sits under the gaps of the row above: a difference of differences.
export type SeqRow = { ops: string[]; step?: 1 | 2; from?: number; level2?: boolean };

export type Branch = {
  id: string;
  icon: string;
  tone: Tone;
  title: string;          // short, shown on the node
  ref?: string;           // มาตรา / source, shown small
  big?: string;           // the one thing to remember (hidden in recall mode)
  unit?: string;
  sub?: string;           // one line under big
  ask?: string;           // recall-mode question; defaults to title
  must?: boolean;         // "ต้องจำ" sticker
  hot?: boolean;          // "คนผิดเยอะ" sticker (from answer statistics when the map was written)
  blocks: Block[];
};

export type MindMap = {
  id: string;             // stable: prep.summary_approvals.id
  group: "A3" | "A1" | "A2" | "B1" | "B2" | "B3";   // B3: วิชาเอก, listed only to users whose major is in `topics`
  topics: string[];       // prep.topics codes for "ฝึกหมวดนี้"
  subtopics?: string[];   // prep.subtopics codes: "ฝึกหมวดนี้" practises just these (a major split into topics)
  icon: string;
  title: string;          // page title
  hub: string;            // text in the hub cloud
  hubSub?: string;
  intro?: string;
  free?: boolean;         // open to free users as a sample (one per group); the rest need a package for that ภาค
  branches: Branch[];     // 4–6
};

export const GROUPS: { key: MindMap["group"]; title: string; sub: string }[] = [
  { key: "A3", title: "ภาค ก · ข้าราชการที่ดี", sub: "กฎหมายและจริยธรรม ที่ต้องจำ" },
  { key: "A1", title: "ภาค ก · คิดวิเคราะห์", sub: "สูตร วิธีลัด และโจทย์ที่ออกบ่อย" },
  { key: "A2", title: "ภาค ก · ภาษาอังกฤษ", sub: "ไวยากรณ์ คำศัพท์ บทสนทนา การอ่าน" },
  { key: "B1", title: "ภาค ข · วิชาชีพครู", sub: "หลักสูตร การสอน จิตวิทยา วัดผล วิจัย จรรยาบรรณ" },
  { key: "B2", title: "ภาค ข · กฎหมายการศึกษา", sub: "พ.ร.บ. 7 ฉบับ และแผนการศึกษา" },
  { key: "B3", title: "วิชาเอกของคุณ", sub: "สรุปแยกเป็นเรื่อง ตามผังข้อสอบวิชาเอก" },
];
