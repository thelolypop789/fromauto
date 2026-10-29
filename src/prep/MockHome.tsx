import { useEffect, useState } from "react";
import { rpc, thaiError, type MockOverview, type MockPayload, type MockSubject } from "./api";
import { IconBack } from "./icons";
import MockScorecard from "./MockScorecard";
import { ask } from "./dialog";

type Props = { onBack: () => void; onUpgrade: () => void; onOpen: (p: MockPayload) => void; onAccount: () => void };

const SECTION_TITLE = { A: "ภาค ก ความรู้ความสามารถทั่วไป", B: "ภาค ข ความรู้และประสบการณ์วิชาชีพ" } as const;

// Mock exams by subject: same question counts and minutes as the real exam, answers only after submitting.
export default function MockHome({ onBack, onUpgrade, onOpen, onAccount }: Props) {
  const [ov, setOv] = useState<MockOverview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    rpc<MockOverview>("prep_mock_overview").then(o => { setOv(o); setOffset(Date.parse(o.server_now) - Date.now()); setNow(Date.now()); })
      .catch(e => setError(thaiError(e)));
  }, []);

  const start = async (s: MockSubject) => {
    if (busy) return;
    if (!s.open && !(await ask({ title: `เริ่มสอบ "${s.name}"`, body: `${s.questions} ข้อ · ${s.minutes} นาที\n\nเวลาเริ่มนับทันทีและเดินต่อแม้ปิดแอป ไม่เฉลยจนกว่าจะกดส่งหรือหมดเวลา`, ok: "เริ่มสอบ" }))) return;
    setBusy(s.code); setError("");
    try {
      onOpen(s.open
        ? await rpc<MockPayload>("prep_mock_get", { p_attempt: s.open.id })
        : await rpc<MockPayload>("prep_mock_start", { p_subject: s.code }));
    } catch (e) { setError(thaiError(e)); setBusy(""); }
  };

  if (!ov) return <div className="pp-card">{error ? <div className="pp-error">{error}</div> : <div className="pp-spinner" />}<button className="pp-btn pp-btn-ghost" onClick={onBack}><IconBack />กลับ</button></div>;

  return (
    <>
      <div className="pp-card">
        <h2>จำลองสอบจริง</h2>
        <p className="pp-muted">จำนวนข้อและเวลาเท่าสนามจริง แบ่งตามวิชา จับเวลาที่เซิร์ฟเวอร์ ไม่เฉลยระหว่างทำ ส่งแล้วดูคะแนนรายหมวด เปรียบเทียบกับผู้สอบคนอื่น และข้อที่ผิดจะไปอยู่ในรายการทวน</p>
        {ov.major_name && <p className="pp-muted small">วิชาเอกของคุณ: <b>{ov.major_name}</b></p>}
        {error && <div className="pp-error">{error}</div>}
      </div>
      <MockScorecard />
      {(["A", "B"] as const).map(sec => (
        <div key={sec} className="pp-card">
          <h3>{SECTION_TITLE[sec]}</h3>
          <div className="pp-mock-list">
            {ov.subjects.filter(s => s.section === sec).map(s => {
              const left = s.open ? Math.max(0, Math.floor((Date.parse(s.open.deadline) - (now + offset)) / 60000)) : 0;
              const cannot = !!s.reason;
              return (
                <div key={s.code} className="pp-mock-item">
                  <div>
                    <b>{s.name.replace(/^ภาค [กข]: /, "")}</b>
                    <div className="pp-muted small">{s.questions} ข้อ · {s.minutes} นาที{s.tries ? ` · ทำแล้ว ${s.tries} ครั้ง · ดีสุด ${s.best}/${s.questions}` : ""}</div>
                    {s.access === "free_trial" && <span className="pp-chip ok">ทดลองฟรี 1 ครั้ง</span>}
                    {s.reason === "no_major" && <span className="pp-chip">ตั้งวิชาเอกในหน้าบัญชีก่อน</span>}
                    {s.reason === "not_enough_questions" && <span className="pp-chip">กำลังเพิ่มข้อสอบ (มี {s.available}/{s.questions} ข้อ)</span>}
                    {!s.reason && s.available < 3 * s.questions && <span className="pp-chip">ข้อสอบยังไม่มาก ชุดอาจซ้ำกับครั้งก่อน</span>}
                    {s.open && <span className="pp-chip warn">ทำค้างอยู่ · เหลือ {left} นาที</span>}
                  </div>
                  {s.reason === "no_major" ? <button className="pp-btn pp-btn-ghost" onClick={onAccount}>ตั้งวิชาเอก</button>
                    : s.access === "locked" && !s.open ? <button className="pp-btn pp-btn-gold" onClick={onUpgrade}>ต้องมีแพ็ก</button>
                    : <button className="pp-btn pp-btn-primary" disabled={(cannot && !s.open) || busy === s.code} onClick={() => start(s)}>
                        {s.open ? "ทำต่อ" : "เริ่มสอบ"}
                      </button>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <button className="pp-btn pp-btn-ghost" onClick={onBack}><IconBack />กลับ</button>
    </>
  );
}
