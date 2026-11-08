import { useEffect, useState } from "react";
import { GROUPS, rpc, thaiError } from "./api";
import Skeleton from "./Skeleton";
import { CommunityLinks } from "./Community";

type Vote = "y" | "n";
type RecapTopic = { code: string; name: string; section: "A" | "B"; grp: string };
type Recap = {
  event_id: number; phase: "recap" | "result"; result_on: string | null;
  topics: RecapTopic[]; major: { code: string; name: string } | null;
  mine: { topics: Record<string, Vote>; difficulty: Partial<Record<"A" | "B" | "M", number>>; note: string | null } | null;
  responders: number;
  votes: Record<string, { y: number; n: number }>;
  difficulty: { A: number | null; B: number | null } | null;
  difficulty_major: number | null;
  notes: { id: number; topic: string | null; body: string }[];
} | null;

const DIFF_LABEL = ["", "ง่ายมาก", "ง่าย", "พอดี", "ยาก", "ยากมาก"];
const MIN_SHOW = 3;   // แสดงผลรวมของหมวดเมื่อมีคนตอบหมวดนั้นอย่างน้อย 3 คน

// /prep/recap: หลังสอบข้อเขียน ผู้ใช้ช่วยกันบอกว่าข้อสอบจริงออกหมวดไหน ยากแค่ไหน (คำตอบรายคนไม่เปิดเผย)
// ส่งแล้วเห็นผลรวมของทุกคน + สรุปที่ทีมงานเขียนเอง; ช่อง "เล่าเพิ่ม" ทีมงานอ่านคนเดียว ใช้ปรับคลังข้อสอบรอบหน้า
export default function ExamRecap({ onBack }: { onBack: () => void }) {
  const [r, setR] = useState<Recap | undefined>(undefined);
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const [diff, setDiff] = useState<Partial<Record<"A" | "B" | "M", number>>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const load = () => rpc<Recap>("prep_recap_get").then(x => {
    setR(x);
    if (x?.mine) { setVotes(x.mine.topics ?? {}); setDiff(x.mine.difficulty ?? {}); setNote(x.mine.note ?? ""); }
  }).catch(e => { setError(thaiError(e)); setR(null); });
  useEffect(() => { load(); }, []);

  if (r === undefined) return <><button className="pp-link" onClick={onBack}>‹ กลับ</button><Skeleton kind="list" n={4} /></>;
  if (!r) {
    return (
      <>
        <button className="pp-link" onClick={onBack}>‹ กลับ</button>
        <div className="pp-card">{error ? <div className="pp-error">{error}</div> : <p className="pp-muted">หน้านี้เปิดหลังสอบข้อเขียนเสร็จ (17:00 น. ของวันสอบวันสุดท้าย)</p>}</div>
      </>
    );
  }

  const answered = !!r.mine;
  const toggle = (code: string, v: Vote) => setVotes(cur => { const n = { ...cur }; if (n[code] === v) delete n[code]; else n[code] = v; return n; });
  const save = async () => {
    if (busy) return;
    setBusy(true); setError(""); setSaved(false);
    try {
      await rpc("prep_recap_save", { p_event: r.event_id, p_topics: votes, p_difficulty: diff, p_note: note });
      await load(); setSaved(true);
    } catch (e) { setError(thaiError(e)); }
    setBusy(false);
  };

  const groups = ["A1", "A2", "A3", "B1", "B2"].map(g => ({ g, items: r.topics.filter(t => t.grp === g) })).filter(x => x.items.length);
  const majorRow: RecapTopic[] = r.major ? [{ code: r.major.code, name: r.major.name, section: "B", grp: "B3" }] : [];
  const general = r.notes.filter(n => !n.topic);

  const row = (t: RecapTopic) => {
    const v = r.votes[t.code], total = v ? v.y + v.n : 0, pct = total ? Math.round(100 * v.y / total) : 0;
    return (
      <div key={t.code} className="pp-recap-row">
        <div className="pp-recap-t">
          <span>{t.name}</span>
          {answered && total >= MIN_SHOW && (
            <span className="pp-recap-bar" title={`ออก ${v.y} · ไม่ออก ${v.n}`}>
              <i style={{ width: `${pct}%` }} /><small>{pct}% บอกว่าออก · {total} คน</small>
            </span>
          )}
          {r.notes.filter(n => n.topic === t.code).map(n => <div key={n.id} className="pp-recap-note">ทีมงาน: {n.body}</div>)}
        </div>
        <div className="pp-recap-btns" role="group" aria-label={t.name}>
          <button className={votes[t.code] === "y" ? "on" : ""} aria-pressed={votes[t.code] === "y"} onClick={() => toggle(t.code, "y")}>ออก</button>
          <button className={votes[t.code] === "n" ? "on no" : ""} aria-pressed={votes[t.code] === "n"} onClick={() => toggle(t.code, "n")}>ไม่ออก</button>
        </div>
      </div>
    );
  };

  const diffRow = (k: "A" | "B" | "M", label: string, avg: number | null | undefined) => (
    <div className="pp-recap-diff" key={k}>
      <div><b>{label}</b>{answered && avg ? <span className="pp-muted small"> · เฉลี่ยทุกคน {avg} ({DIFF_LABEL[Math.round(avg)]})</span> : null}</div>
      <div className="pp-seg pp-seg-sub pp-recap-seg">
        {[1, 2, 3, 4, 5].map(n => <button key={n} className={diff[k] === n ? "on" : ""} onClick={() => setDiff(d => ({ ...d, [k]: n }))}>{DIFF_LABEL[n]}</button>)}
      </div>
    </div>
  );

  return (
    <>
      <button className="pp-link" onClick={onBack}>‹ กลับ</button>
      <div className="pp-card">
        <h2>ข้อสอบจริงออกเรื่องไหน?</h2>
        <p className="pp-muted">สอบเสร็จแล้ว เหนื่อยมาก! ช่วยกันบอกหน่อยว่าหมวดไหนออก หมวดไหนไม่ออก ตอบเท่าที่จำได้ ไม่ต้องครบทุกหมวด
          {answered ? "" : " ส่งแล้วจะเห็นผลรวมของทุกคน"}</p>
        <p className="pp-muted small">ตอบไปแล้ว {r.responders.toLocaleString()} คน · ไม่แสดงชื่อใคร</p>
        {general.map(n => <div key={n.id} className="pp-recap-note">ทีมงาน: {n.body}</div>)}
      </div>

      {groups.map(({ g, items }) => (
        <div key={g} className="pp-card">
          <h3>{g.startsWith("A") ? "ภาค ก" : "ภาค ข"} · {GROUPS[g]}</h3>
          {items.map(row)}
        </div>
      ))}
      {majorRow.length > 0 && <div className="pp-card"><h3>วิชาเอก</h3>{majorRow.map(row)}</div>}

      <div className="pp-card">
        <h3>ความยาก</h3>
        {diffRow("A", "ภาค ก", r.difficulty?.A)}
        {diffRow("B", "ภาค ข (วิชาการศึกษา กฎหมาย)", r.difficulty?.B)}
        {r.major && diffRow("M", `วิชาเอก${r.major.name}`, r.difficulty_major)}
      </div>

      <div className="pp-card">
        <h3>เล่าเพิ่ม (ไม่บังคับ)</h3>
        <p className="pp-muted small">เช่น เรื่องที่ออกเยอะ แนวโจทย์ที่ไม่คาดคิด · ทีมงานอ่านคนเดียว ไม่เผยแพร่ ใช้ปรับข้อสอบในแอปให้ตรงขึ้น</p>
        <textarea className="pp-input" rows={4} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} />
        {error && <div className="pp-error">{error}</div>}
        {saved && <div className="pp-success">บันทึกแล้ว ขอบคุณมาก!</div>}
        <button className="pp-btn pp-btn-primary pp-wide" disabled={busy || (Object.keys(votes).length === 0 && Object.keys(diff).length === 0 && !note.trim())} onClick={save}>
          {busy ? "กำลังส่ง..." : answered ? "บันทึกการแก้ไข" : "ส่งและดูผลรวม"}
        </button>
      </div>
      <CommunityLinks title="คุยต่อในกลุ่มเตรียมสอบ by SOBPREP" />
    </>
  );
}
