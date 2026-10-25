import { useEffect, useState } from "react";
import { SECTIONS, rpc, thaiError } from "./api";

type PastTag = { tag: string; section: "A" | "B"; n: number; covered: boolean };

// Questions that carry an exam_tag ("แนวข้อสอบ สอศ. 2565"), grouped by exam, year and section. A tap builds a normal set from
// only those questions, as large as the learner's packages allow, so scoring, review and the wrong-answer list work as usual.
export default function PastExams({ onBack, onCreated, onUpgrade }: { onBack: () => void; onCreated: (setId: string) => void; onUpgrade: () => void }) {
  const [tags, setTags] = useState<PastTag[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => { rpc<PastTag[]>("prep_past_tags").then(setTags).catch(e => setError(thaiError(e))); }, []);

  const start = async (t: PastTag) => {
    const key = t.tag + t.section;
    setBusy(key); setError("");
    try {
      const id = await rpc<string>("prep_create_past_set", { p_tag: t.tag, p_section: t.section });
      onCreated(id);
    } catch (e) { setError(thaiError(e)); setBusy(""); }
  };

  return (
    <>
      <button className="pp-link" onClick={onBack}>‹ กลับ</button>
      <div className="pp-card">
        <h2>แนวข้อสอบเก่า</h2>
        <p className="pp-muted small">ข้อที่เรียบเรียงจากประเด็นที่เคยออกในสนามสอบแต่ละปี เป็นข้อสอบฝึก ไม่ใช่ข้อสอบฉบับจริง เฉลยตามกฎหมายและหลักสูตรปัจจุบัน</p>
      </div>
      {error && <div className="pp-error">{error}</div>}
      {!tags && !error && <div className="pp-spinner" />}
      {tags && tags.length === 0 && <p className="pp-muted small">ยังไม่มีแนวข้อสอบเก่า ทีมงานกำลังเพิ่ม</p>}
      {tags && tags.length > 0 && (
        <div className="pp-modes pp-modes-home">
          {tags.map(t => (
            <button key={t.tag + t.section} disabled={!!busy} onClick={() => start(t)}>
              <b>{t.tag.replace(/^แนวข้อสอบ\s*/, "")} · {SECTIONS[t.section].short}</b>
              <span>{busy === t.tag + t.section ? "กำลังสร้างชุด…" : `${t.n} ข้อ${t.covered ? "" : " · ใช้สิทธิ์ชุดฟรี (สูงสุด 40 ข้อ)"}`}</span>
            </button>
          ))}
        </div>
      )}
      {tags?.some(t => !t.covered) && <button className="pp-link small" onClick={onUpgrade}>ดูแพ็กเพื่อทำได้ครบทุกข้อ</button>}
    </>
  );
}
