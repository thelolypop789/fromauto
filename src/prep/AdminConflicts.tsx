import { useState } from "react";
import { rpc, thaiError } from "./api";
import { findConflicts, type Conflict, type LiteQ } from "./conflicts";

const LABELS = ["ก", "ข", "ค", "ง"];

// Same question, different answer key: a student who meets both is marked wrong either way. Runs on demand in the
// browser (the database only sends the list), then the admin hides the wrong one or marks the pair as fine.
export default function AdminConflicts() {
  const [list, setList] = useState<Conflict[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const scan = async () => {
    setBusy(true); setErr("");
    try {
      const [bank, ok] = await Promise.all([rpc<LiteQ[]>("prep_admin_bank_lite"), rpc<[number, number][]>("prep_admin_conflict_ok_list")]);
      setList(findConflicts(bank, new Set(ok.map(([a, b]) => `${a}-${b}`))));
    } catch (e) { setErr(thaiError(e)); }
    setBusy(false);
  };
  const drop = (c: Conflict) => setList(prev => prev?.filter(x => x !== c) ?? null);
  const hide = async (c: Conflict, q: LiteQ) => {
    if (!confirm(`ซ่อนข้อ #${q[0]} (เฉลย: ${q[4][q[5]]})?\nกลับมาเปิดได้ที่แท็บ คลังข้อสอบ`)) return;
    try { await rpc("prep_admin_update_question", { p_id: q[0], p_status: "hidden" }); drop(c); } catch (e) { alert(thaiError(e)); }
  };
  const fine = async (c: Conflict) => {
    try { await rpc("prep_admin_conflict_ok", { p_a: c.a[0], p_b: c.b[0] }); drop(c); } catch (e) { alert(thaiError(e)); }
  };
  const side = (c: Conflict, q: LiteQ) => (
    <div className="pp-conflict-side">
      <div className="pp-muted small">#{q[0]} · {q[2]}</div>
      <div>{q[3]}</div>
      <ol className="pp-conflict-choices">{q[4].map((ch, i) => <li key={i} className={i === q[5] ? "right" : ""}>{LABELS[i]}. {ch}</li>)}</ol>
      <button className="pp-btn pp-btn-ghost" onClick={() => hide(c, q)}>ซ่อนข้อนี้</button>
    </div>
  );
  return (
    <div className="pp-card">
      <h3>ข้อที่เฉลยขัดกัน</h3>
      <p className="pp-muted small">ข้อที่ถามเหมือนกัน (ถ้อยคำคล้ายกันมาก ตัวเลขตรงกัน) แต่เฉลยคนละตัวเลือก ผู้เรียนที่เจอทั้งสองข้อจะถูกบอกว่าผิดไม่ว่าตอบอะไร
        ตรวจแล้วซ่อนข้อที่เฉลยผิด หรือกด “ไม่ใช่ปัญหา” ถ้าเป็นคนละคำถามจริง (เช่น ตามเข็ม/ทวนเข็มนาฬิกา)</p>
      <button className="pp-btn pp-btn-primary" disabled={busy} onClick={scan}>{busy ? "กำลังตรวจ..." : list ? "ตรวจใหม่" : "ตรวจทั้งคลัง"}</button>
      {err && <div className="pp-error">{err}</div>}
      {list && list.length === 0 && <p className="pp-success">ไม่พบข้อที่เฉลยขัดกัน</p>}
      {list?.map(c => (
        <div key={`${c.a[0]}-${c.b[0]}`} className="pp-conflict">
          <div className="pp-muted small">หมวด {c.a[1]} · คล้ายกัน {Math.round(c.sim * 100)}%</div>
          <div className="pp-conflict-pair">{side(c, c.a)}{side(c, c.b)}</div>
          <button className="pp-link small" onClick={() => fine(c)}>ไม่ใช่ปัญหา (คนละคำถาม)</button>
        </div>
      ))}
    </div>
  );
}
