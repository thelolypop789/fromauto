import { useEffect, useState } from "react";
import { GROUPS, SECTIONS, rpc, thaiError } from "./api";
import Skeleton from "./Skeleton";

// groups: question count per subject group, e.g. { A3: 10 } (the topic code before the first "-")
export type PastTag = { tag: string; section: "A" | "B"; n: number; covered: boolean; groups: Record<string, number> };

const MIN = 5; // prep_create_past_set needs at least this many questions

// Questions that carry an exam_tag ("แนวข้อสอบ สอศ. 2565"), one card per exam and year, split by section (ภาค ก/ข) and subject
// group (คิดวิเคราะห์ / ภาษาอังกฤษ / …). A tap builds a normal set from only those questions, as large as the learner's packages
// allow, so scoring, review and the wrong-answer list work as usual.
export default function PastExams({ onBack, onCreated, onUpgrade }: { onBack: () => void; onCreated: (setId: string) => void; onUpgrade: () => void }) {
  const [tags, setTags] = useState<PastTag[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => { rpc<PastTag[]>("prep_past_tags").then(setTags).catch(e => setError(thaiError(e))); }, []);

  const start = async (t: PastTag, grp?: string) => {
    const key = t.tag + t.section + (grp ?? "");
    setBusy(key); setError("");
    try {
      const id = await rpc<string>("prep_create_past_set", { p_tag: t.tag, p_section: t.section, p_prefix: grp ? grp + "-" : null });
      onCreated(id);
    } catch (e) { setError(thaiError(e)); setBusy(""); }
  };

  // the RPC sorts by year (newest first), then tag, then section, so the sections of one exam are adjacent
  const exams: { tag: string; parts: PastTag[] }[] = [];
  for (const t of tags ?? []) {
    const last = exams[exams.length - 1];
    if (last && last.tag === t.tag) last.parts.push(t); else exams.push({ tag: t.tag, parts: [t] });
  }

  const btn = (t: PastTag, label: string, n: number, grp?: string) => {
    const key = t.tag + t.section + (grp ?? "");
    return (
      <button key={key} disabled={!!busy || n < MIN} onClick={() => start(t, grp)}>
        <b>{label}</b>
        <span>{busy === key ? "กำลังสร้างชุด…" : n < MIN ? `${n} ข้อ · ยังไม่ถึง ${MIN} ข้อ` : `${n} ข้อ`}</span>
      </button>
    );
  };

  return (
    <>
      <button className="pp-link" onClick={onBack}>‹ กลับ</button>
      <div className="pp-card">
        <h2>แนวข้อสอบเก่า</h2>
        <p className="pp-muted small">ข้อที่เรียบเรียงจากประเด็นที่เคยออกในสนามสอบแต่ละปี แยกตามภาคและหมวด เป็นข้อสอบฝึก ไม่ใช่ข้อสอบฉบับจริง เฉลยตามกฎหมายและหลักสูตรปัจจุบัน</p>
      </div>
      {error && <div className="pp-error">{error}</div>}
      {!tags && !error && <Skeleton kind="list" n={4} />}
      {tags && tags.length === 0 && <p className="pp-muted small">ยังไม่มีแนวข้อสอบเก่า ทีมงานกำลังเพิ่ม</p>}
      {exams.map(e => (
        <div key={e.tag} className="pp-card pp-past">
          <h3>{e.tag.replace(/^แนวข้อสอบ\s*/, "")}</h3>
          {e.parts.map(t => {
            const groups = SECTIONS[t.section].groups.filter(g => t.groups[g]);
            return (
              <div key={t.section} className="pp-past-sec">
                <div className="pp-past-sec-h">
                  <b>{SECTIONS[t.section].short}</b>
                  <span>{t.n} ข้อ{t.covered ? "" : " · ใช้สิทธิ์ชุดฟรี (สูงสุด 40 ข้อ)"}</span>
                </div>
                <div className="pp-modes">
                  {groups.length > 1 && btn(t, `ทั้ง${SECTIONS[t.section].short}`, t.n)}
                  {groups.map(g => btn(t, GROUPS[g] ?? g, t.groups[g], g))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
      {tags?.some(t => !t.covered) && <button className="pp-link small" onClick={onUpgrade}>ดูแพ็กเพื่อทำได้ครบทุกข้อ</button>}
    </>
  );
}
