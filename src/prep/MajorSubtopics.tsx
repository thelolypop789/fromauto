import { useEffect, useState } from "react";
import { PASS_PCT, rpc, type Subtopic } from "./api";
import type { Preset } from "./CreateSet";

const MIN_SEEN = 5;   // fewer answered questions than this: show "ยังไม่พอ" instead of a percentage

// The user's major split into blueprint sub-topics: share of the exam, questions available, accuracy so far.
export default function MajorSubtopics({ major, majorName, onPractice }: { major: string | null; majorName: string | null; onPractice?: (p: Preset) => void }) {
  const [list, setList] = useState<Subtopic[] | null>(null);
  useEffect(() => {
    if (!major) return;
    rpc<Subtopic[]>("prep_subtopics", { p_topic: major }).then(setList).catch(() => setList(null));
  }, [major]);
  if (!major || !list || list.length === 0) return null;

  const tagged = list.reduce((n, s) => n + s.available, 0);
  const rows = list.map(s => ({ ...s, pct: s.seen ? Math.round((100 * s.right) / s.seen) : null }));

  return (
    <div className="pp-card pp-msub">
      <h3>วิชาเอก{majorName ?? ""} รายหมวดย่อย</h3>
      <p className="pp-muted small">แบ่งตามผังข้อสอบวิชาเอก (ตรวจกับหลักสูตรแกนกลาง) · % = ข้อที่ตอบถูกโดยไม่เคยผิด · ตัวเลขหลังชื่อ = ข้อที่ออกโดยประมาณจาก 100</p>
      {tagged === 0 && <p className="pp-note">กำลังจัดข้อสอบเข้าหมวดย่อย อีกสักครู่จะใช้ได้</p>}
      <div className="pp-msub-list">
        {rows.map(s => (
          <div key={s.code} className="pp-msub-row">
            <div className="pp-msub-t">
              <span>{s.name} <small className="pp-muted">· {s.share}</small>{s.kind === "pedagogy" && <em className="pp-msub-ped">การสอน</em>}</span>
              <small className="pp-muted">{s.available ? `${s.available} ข้อในคลัง` : "กำลังเพิ่มข้อสอบ"}{s.seen ? ` · ทำแล้ว ${s.seen} ข้อ` : ""}</small>
            </div>
            <div className="pp-rd-track sm">
              {s.pct != null && s.seen >= MIN_SEEN && <div className={s.pct >= PASS_PCT ? "ok" : s.pct >= PASS_PCT - 10 ? "mid" : "low"} style={{ width: `${s.pct}%` }} />}
              <i style={{ left: `${PASS_PCT}%` }} />
            </div>
            <b className={s.pct == null || s.seen < MIN_SEEN ? "pp-muted" : s.pct >= PASS_PCT ? "ok" : "low"}>{s.pct == null ? "–" : s.seen < MIN_SEEN ? "น้อย" : `${s.pct}%`}</b>
            {onPractice && s.available >= 5
              ? <button className="pp-btn pp-btn-ghost sm" onClick={() => onPractice({ topics: [major], subtopics: [s.code] })}>ฝึก</button>
              : <span />}
          </div>
        ))}
      </div>
    </div>
  );
}
