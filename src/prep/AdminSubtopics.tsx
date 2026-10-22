import { useEffect, useState } from "react";
import { rpc, thaiError } from "./api";

type Row = {
  topic: string; name: string; approved: number; untagged: number; none: number;
  subtopics: { code: string; name: string; kind: "content" | "pedagogy"; share: number; n: number }[];
};
// A mock exam draws `share` questions from a sub-topic; three times that keeps repeated mocks from repeating questions.
const target = (share: number) => share * 3;

// Questions per major sub-topic against the blueprint, so the team knows which sub-topics to write next.
export default function AdminSubtopics() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { rpc<Row[]>("prep_admin_subtopic_coverage").then(setRows).catch(e => setError(thaiError(e))); }, []);

  if (error) return <div className="pp-error">{error}</div>;
  if (!rows) return <div className="pp-spinner" />;
  const untagged = rows.reduce((n, r) => n + r.untagged, 0);

  return (
    <div className="pp-card">
      <h3>หมวดย่อยวิชาเอก</h3>
      <p className="pp-muted small">
        แบ่งตาม blueprint ที่ตรวจกับหลักสูตรแกนกลางแล้ว (docs/prep-major-blueprint.md) · AI จัดข้อสอบเข้าหมวดย่อยอัตโนมัติทุก 2 นาที รวมข้อที่นำเข้าใหม่
        {untagged > 0 ? ` · ยังรอจัดอีก ${untagged.toLocaleString("th-TH")} ข้อ` : " · จัดครบแล้ว"}
        {" · "}เป้า = 3 เท่าของจำนวนข้อที่ออกในข้อสอบจำลอง เพื่อให้ทำจำลองซ้ำแล้วข้อไม่ซ้ำ
      </p>
      <div className="pp-asub-list">
        {rows.map(r => {
          const low = r.subtopics.filter(s => s.n < target(s.share)).length;
          return (
            <div key={r.topic} className="pp-asub">
              <button className="pp-asub-h" onClick={() => setOpen(open === r.topic ? null : r.topic)} aria-expanded={open === r.topic}>
                <b>{r.name}</b>
                <span className="pp-muted small">{r.approved.toLocaleString("th-TH")} ข้อ{r.untagged ? ` · รอจัด ${r.untagged}` : ""}{r.none ? ` · ไม่เข้าหมวด ${r.none}` : ""}</span>
                {r.approved === 0 ? <span className="pp-chip bad">ยังไม่มีข้อสอบ</span>
                  : low ? <span className="pp-chip warn">ขาด {low}/{r.subtopics.length} หมวด</span>
                    : <span className="pp-chip ok">ครบเป้า</span>}
              </button>
              {open === r.topic && (
                <div className="pp-asub-t">
                  {r.subtopics.map(s => (
                    <div key={s.code} className={s.n < target(s.share) ? "low" : ""}>
                      <span>{s.name}{s.kind === "pedagogy" ? " (การสอน)" : ""}</span>
                      <span className="pp-muted">ออก ~{s.share}</span>
                      <b>{s.n}<small>/{target(s.share)}</small></b>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
