import { useEffect, useState } from "react";
import { rpc, thaiError } from "./api";
import { navigate } from "./router";
import Mascot from "./Mascot";
import { CommunityLinks } from "./Community";

type Result = "pass" | "unsure" | "fail" | "absent";
type Followup = {
  event_id: number; phase: "recap" | "result"; result_on: string | null; result_title: string | null;
  recap_done: boolean; result: Result | null; next_exams: string[] | null; ask: boolean;
} | null;

const CHOICES: [Result, string][] = [["pass", "มีชื่อผ่าน ภาค ก/ข 🎉"], ["fail", "ไม่ผ่าน"], ["absent", "ไม่ได้ไปสอบ"]];
const NEXT: [string, string][] = [
  ["next", "ครูผู้ช่วย สพฐ./สอศ. รอบหน้า"], ["local", "ครูท้องถิ่น (อปท.)"], ["bkk", "ครู กทม."],
  ["ocsc", "ภาค ก ก.พ."], ["other", "สอบอื่น ๆ"], ["done", "ยังไม่สอบอะไรต่อ"],
];
const fmtDay = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "short" });

// การ์ดหลังสอบข้อเขียนบนหน้าแรก (วันสอบ/วันประกาศผลมาจากปฏิทินสอบที่แอดมินตั้ง):
//  1) ตั้งแต่ 17:00 วันสอบวันสุดท้ายจนถึงวันประกาศผล: ชวนบอกว่าข้อสอบออกเรื่องไหน (/prep/recap)
//  2) ตั้งแต่วันประกาศผล: ถามผล แล้วถามว่าจะสอบอะไรต่อ (ใช้เลือกสนามสอบถัดไปของแอป)
export default function ExamFollowup() {
  const [f, setF] = useState<Followup>(null);
  const [step, setStep] = useState<"ask" | "next" | "thanks">("ask");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { rpc<Followup>("prep_exam_followup").then(setF).catch(() => { /* card hidden */ }); }, []);
  if (!f) return null;

  if (f.phase === "recap") {
    return (
      <div className="pp-card">
        <div className="pp-greet">
          <Mascot costume="teacher" mood={f.recap_done ? "cheer" : "happy"} size={64} />
          <div className="pp-greet-bubble">
            {f.recap_done
              ? <>ขอบคุณที่ช่วยกันบอกนะ! ดูได้ว่าคนอื่นบอกว่าออกเรื่องไหน{f.result_on ? <> · ประกาศผู้ผ่านภายใน<b>{fmtDay(f.result_on)}</b></> : null}</>
              : <>สอบเสร็จแล้ว เก่งมาก! ช่วยกันบอกหน่อยว่า<b>ข้อสอบจริงออกเรื่องไหน</b> ใช้เวลาไม่ถึง 2 นาที</>}
          </div>
        </div>
        <button className="pp-btn pp-btn-gold pp-wide" onClick={() => navigate("/prep/recap")}>{f.recap_done ? "ดูผลรวมทุกคน" : "บอกว่าออกเรื่องไหน"}</button>
      </div>
    );
  }

  if (!f.ask && step === "ask") return null;
  const answer = async (r: Result) => {
    setErr(""); setBusy(true);
    try { await rpc("prep_set_exam_outcome", { p_event: f.event_id, p_result: r }); setF({ ...f, result: r }); setStep("next"); }
    catch (e) { setErr(thaiError(e)); }
    setBusy(false);
  };
  const sendNext = async () => {
    setErr(""); setBusy(true);
    try { await rpc("prep_set_next_exams", { p_event: f.event_id, p_list: picked }); setStep("thanks"); }
    catch (e) { setErr(thaiError(e)); }
    setBusy(false);
  };

  if (step === "ask") {
    return (
      <div className="pp-card">
        <div className="pp-greet">
          <Mascot costume="teacher" mood="happy" size={64} />
          <div className="pp-greet-bubble">ประกาศรายชื่อผู้ผ่าน ภาค ก/ข แล้ว ผลเป็นยังไงบ้าง?</div>
        </div>
        <div className="pp-followup-choices">
          {CHOICES.map(([k, label]) => <button key={k} className="pp-btn pp-btn-outline" disabled={busy} onClick={() => answer(k)}>{label}</button>)}
        </div>
        {err && <div className="pp-error">{err}</div>}
      </div>
    );
  }

  const pass = f.result === "pass";
  if (step === "next") {
    return (
      <div className="pp-card">
        <h3>{pass ? "ยินดีด้วย! 🎉 ขอให้ผ่าน ภาค ค ฉลุยนะ" : f.result === "fail" ? "รอบหน้าเอาใหม่ เราอยู่ข้างคุณ" : "ไว้รอบหน้านะ"}</h3>
        <p className="pp-muted">{pass ? "อีกคำถามเดียว: นอกจากนี้ยังเตรียมสอบอะไรอีกไหม" : "อีกคำถามเดียว: กำลังจะสอบอะไรต่อ"} (เลือกได้หลายข้อ เราจะเตรียมข้อสอบให้ตรง)</p>
        <div className="pp-area-provs">
          {NEXT.map(([k, label]) => (
            <button key={k} className={`pp-chip-btn${picked.includes(k) ? " on" : ""}`} aria-pressed={picked.includes(k)}
              onClick={() => setPicked(p => k === "done" ? (p.includes("done") ? [] : ["done"]) : p.includes(k) ? p.filter(x => x !== k) : [...p.filter(x => x !== "done"), k])}>{label}</button>
          ))}
        </div>
        {err && <div className="pp-error">{err}</div>}
        <div className="pp-row">
          <button className="pp-btn pp-btn-primary" disabled={busy || picked.length === 0} onClick={sendNext}>ส่ง</button>
          <button className="pp-btn pp-btn-ghost" disabled={busy} onClick={() => setStep("thanks")}>ข้าม</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pp-card">
      <h3>ขอบคุณมาก!</h3>
      <p className="pp-muted">{pass
        ? "ช่วยเล่าให้ทีมงานฟังหน่อยได้ไหมว่าแอปช่วยตรงไหน และชวนเพื่อนที่ยังเตรียมสอบมาซ้อมด้วยกัน"
        : "ทุกข้อที่ทำไว้และจุดอ่อนที่วิเคราะห์ไว้ยังอยู่ครบ เริ่มทบทวนจากหมวดที่คะแนนต่ำก่อนได้เลย"}</p>
      <div className="pp-row">
        {pass
          ? <><button className="pp-btn pp-btn-gold" onClick={() => navigate("/prep/feedback")}>เขียนรีวิว</button>
              <button className="pp-btn pp-btn-outline" onClick={() => navigate("/prep/me")}>ชวนเพื่อน</button></>
          : <button className="pp-btn pp-btn-outline" onClick={() => navigate("/prep/stats")}>ดูจุดอ่อน</button>}
      </div>
      <CommunityLinks title="กลุ่มเตรียมสอบ by SOBPREP" />
    </div>
  );
}
