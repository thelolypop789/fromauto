import { useEffect, useState } from "react";
import { rpc, thaiError } from "./api";
import AiProviderSwitch from "./AiProviderSwitch";

type Row = {
  topic: string; name: string; approved: number; untagged: number; none: number;
  subtopics: { code: string; name: string; kind: "content" | "pedagogy"; share: number; n: number }[];
};
type Gen = {
  enabled: boolean; topics: string[]; review_topics: string[]; made_24h: number; made_total: number; held: number;
  majors: { topic: string; name: string; have: number; held: number; goal: number | null; filled: number | null }[];
};
// A mock exam draws `share` questions from a sub-topic; three times that keeps repeated mocks from repeating questions.
const target = (share: number) => share * 3;

// Questions per major sub-topic against the blueprint, so the team knows which sub-topics to write next.
export default function AdminSubtopics() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [gen, setGen] = useState<Gen | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    rpc<Row[]>("prep_admin_subtopic_coverage").then(setRows).catch(e => setError(thaiError(e)));
    rpc<Gen>("prep_admin_gen_get").then(setGen).catch(() => setGen(null));
  }, []);
  const saveGen = async (enabled: boolean, topics: string[], review: string[]) => {
    if (busy) return;
    setBusy(true);
    try {
      await rpc("prep_admin_gen_set", { p_enabled: enabled, p_topics: topics, p_review_topics: review });
      setGen(await rpc<Gen>("prep_admin_gen_get"));
    } catch (e) { setError(thaiError(e)); }
    setBusy(false);
  };

  if (error) return <div className="pp-error">{error}</div>;
  if (!rows) return <div className="pp-spinner" />;
  const untagged = rows.reduce((n, r) => n + r.untagged, 0);

  return (
    <>
    <AiProviderSwitch />
    {gen && (
      <div className="pp-card">
        <h3>AI เขียนข้อสอบเติมหมวดย่อย</h3>
        <p className="pp-muted small">
          AI เขียนทีละ 10 ข้อต่อหมวดย่อย แล้วให้ AI อีกตัวทำข้อสอบโดยไม่เห็นเฉลย เก็บเฉพาะข้อที่ตอบตรงเฉลยและมั่นใจว่าไม่กำกวม · เขียนจนแต่ละหมวดย่อยถึงเป้า (3 เท่าของจำนวนที่ออกในจำลองสอบ)
          {" · "}สร้างไปแล้ว {gen.made_total.toLocaleString("th-TH")} ข้อ (24 ชม.ล่าสุด {gen.made_24h.toLocaleString("th-TH")}){gen.held ? ` · รอคุณตรวจ ${gen.held} ข้อ` : ""}
        </p>
        <label className="pp-group-head">
          <input type="checkbox" checked={gen.enabled} disabled={busy} onChange={e => saveGen(e.target.checked, gen.topics, gen.review_topics)} />
          <b>เปิดให้ AI เขียนต่อเนื่อง</b><span className="pp-group-n">{gen.enabled ? "กำลังทำงาน" : "ปิดอยู่"}</span>
        </label>
        <div className="pp-asub-list">
          {gen.majors.map(m => {
            const on = gen.topics.includes(m.topic), hold = gen.review_topics.includes(m.topic);
            const pctDone = m.goal ? Math.round((100 * (m.filled ?? 0)) / m.goal) : 0;
            return (
              <div key={m.topic} className="pp-gen-row">
                <label><input type="checkbox" checked={on} disabled={busy}
                  onChange={e => saveGen(gen.enabled, e.target.checked ? [...gen.topics, m.topic] : gen.topics.filter(t => t !== m.topic), gen.review_topics)} /> {m.name}</label>
                <div className="pp-rd-track sm"><div className={pctDone >= 100 ? "ok" : "mid"} style={{ width: `${Math.min(100, pctDone)}%` }} /></div>
                <span className="small pp-muted">{m.have.toLocaleString("th-TH")} ข้อ · {pctDone}%{m.held ? ` · รอตรวจ ${m.held}` : ""}</span>
                {on && <button className={`pp-chip-btn ${hold ? "on" : ""}`} disabled={busy}
                  title="ข้อที่ AI เขียนจะไม่เปิดให้ผู้ใช้เห็นจนกว่าคุณจะอนุมัติที่ ข้อสอบรอตรวจ"
                  onClick={() => saveGen(gen.enabled, gen.topics, hold ? gen.review_topics.filter(t => t !== m.topic) : [...gen.review_topics, m.topic])}>
                  {hold ? "รอตรวจก่อนเปิด" : "เปิดใช้ทันที"}</button>}
              </div>
            );
          })}
        </div>
      </div>
    )}
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
    </>
  );
}
