import { useEffect, useState } from "react";
import { rpc, thaiError, type Me } from "./api";
import { navigate } from "./router";
import Mascot from "./Mascot";

type Followup = { event_id: number; title: string; date: string; result: Result | null; ask: boolean } | null;
type Result = "pass" | "unsure" | "fail";

const CHOICES: [Result, string][] = [["pass", "ผ่าน / มั่นใจว่าผ่าน"], ["unsure", "รอลุ้นผล"], ["fail", "ไม่ผ่าน สู้ใหม่รอบหน้า"]];

// After an exam on the calendar (up to 45 days): asks how it went, once ("รอลุ้นผล" is asked again after 14 days).
// The answer picks the next step: next-round buyers are offered ซื้อขาด (the server charges only the difference for
// รายรอบ holders); those who passed are asked for a review and to invite friends. Only accounts made before the exam see it.
export default function ExamFollowup({ me }: { me: Me }) {
  const [f, setF] = useState<Followup>(null);
  const [done, setDone] = useState<Result | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { rpc<Followup>("prep_exam_followup").then(setF).catch(() => { /* card hidden */ }); }, []);
  if (!f || (!f.ask && !done)) return null;

  const lifetime = (me.packages ?? []).some(p => p.package === "ALL" && !p.expires_at);
  const answer = async (r: Result) => {
    setErr("");
    try { await rpc("prep_set_exam_outcome", { p_event: f.event_id, p_result: r }); setDone(r); }
    catch (e) { setErr(thaiError(e)); }
  };

  if (done) {
    return (
      <div className="pp-card">
        {done === "pass" ? <>
          <h3>ยินดีด้วย! 🎉</h3>
          <p>ขอบคุณที่ซ้อมกับเรา ช่วยเล่าให้ทีมงานฟังหน่อยได้ไหมว่าแอปช่วยตรงไหน และชวนเพื่อนที่ยังเตรียมสอบมาซ้อมด้วยกัน</p>
          <div className="pp-row">
            <button className="pp-btn pp-btn-gold" onClick={() => navigate("/prep/feedback")}>เขียนรีวิว</button>
            <button className="pp-btn pp-btn-outline" onClick={() => navigate("/prep/me")}>ชวนเพื่อน</button>
          </div>
        </> : <>
          <h3>{done === "fail" ? "รอบหน้าเอาใหม่ เราช่วยได้" : "ขอให้ได้ข่าวดีนะ"}</h3>
          <p>{done === "fail"
            ? "ทุกข้อที่ทำไว้และจุดอ่อนที่วิเคราะห์ไว้ยังอยู่ครบ เริ่มทบทวนจากหมวดที่คะแนนต่ำก่อนได้เลย"
            : "ระหว่างรอผล ทบทวนข้อที่เคยผิดไว้ก่อนก็ได้ ถ้าต้องสอบรอบหน้าจะได้ไม่ต้องเริ่มใหม่"}</p>
          <div className="pp-row">
            {!lifetime && <button className="pp-btn pp-btn-gold" onClick={() => navigate("/prep/buy?pkg=ALL&term=lifetime")}>แพ็กซื้อขาด ใช้ได้ทุกรอบ</button>}
            <button className="pp-btn pp-btn-outline" onClick={() => navigate("/prep/stats")}>ดูจุดอ่อน</button>
          </div>
          {!lifetime && me.plan === "paid" && <p className="pp-muted small">มีแพ็กรายรอบอยู่แล้ว จ่ายแค่ส่วนต่าง</p>}
        </>}
      </div>
    );
  }

  return (
    <div className="pp-card">
      <div className="pp-greet">
        <Mascot costume="teacher" mood="happy" size={64} />
        <div className="pp-greet-bubble">ผ่านวัน<b>{f.title}</b>มาแล้ว เป็นยังไงบ้าง?</div>
      </div>
      <div className="pp-row">
        {CHOICES.map(([k, label]) => <button key={k} className="pp-btn pp-btn-outline" onClick={() => answer(k)}>{label}</button>)}
      </div>
      {err && <div className="pp-error">{err}</div>}
    </div>
  );
}
