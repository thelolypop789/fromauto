import type { ReactNode } from "react";
import type { ReadinessSignals as Signals } from "./api";
import { IconBook, IconCalendar, IconCheck, IconChart, IconTarget, IconTrophy } from "./icons";
import Mascot, { type Costume, type Mood } from "./Mascot";
import ReadinessGauge from "./ReadinessGauge";
import { SIGNAL_VERDICT, signalLevel, signalsIndex } from "./signals";

// Second slide of the readiness card, "6 สัญญาณความพร้อม": how the user practises, not only how much they get right.
// Same layout as the exam-score slide: gauge and mascot on the left, a frosted panel with one bar per signal, and the
// signal to work on first underneath. A reading without enough data says what is still needed instead of a number.
const SEC_PER_Q = 54;   // the written exam gives about 54 s per question
const MASCOT: [Mood, Costume][] = [["think", "none"], ["think", "none"], ["happy", "teacher"], ["cheer", "teacher"]];
const MOTION = ["tilt", "tilt", "float", "jump"];

type Row = { key: string; icon: ReactNode; name: string; score: number | null; detail: ReactNode; wait: string; tip: string };

const grade = (s: number | null) => (s == null ? "wait" : s >= 80 ? "ok" : s >= 60 ? "mid" : "low");
// Row classes carry their own prefix: the card's .ok/.mid/.low rules colour any text inside.
const rowGrade = (s: number | null) => `g-${grade(s)}`;

function rowsOf(s: Signals): Row[] {
  return [
    {
      key: "accuracy", icon: <IconTarget size={16} />, name: "ความแม่นและการจำระยะยาว", score: s.accuracy.score,
      detail: <>จำได้จริง {s.accuracy.score ?? 0}% ของ {s.accuracy.n.toLocaleString("th-TH")} ข้อที่เคยเจอ · แก้แล้วยังจำได้ข้ามวัน {s.accuracy.retained} ข้อ</>,
      wait: `ทำอีก ${Math.max(0, 20 - s.accuracy.n)} ข้อเพื่อเริ่มวัด`,
      tip: "ข้อที่เคยผิด ลองกลับมาทำอีกครั้งในวันถัดไป ถ้ายังถูกอยู่ถึงจะนับว่าจำได้จริง",
    },
    {
      key: "speed", icon: <IconCalendar size={16} />, name: "ความเร็วและความมั่นใจ", score: s.speed.score,
      detail: <>ข้อที่ตอบถูกใช้เวลาเฉลี่ย {s.speed.median_s ?? "–"} วินาที (สนามจริงราว {SEC_PER_Q} วินาทีต่อข้อ)</>,
      wait: `เพิ่งเริ่มจับเวลา ตอบถูกอีก ${Math.max(0, 15 - s.speed.n)} ข้อเพื่อเริ่มวัด`,
      tip: "ตอบถูกแต่ยังช้า แปลว่ายังลังเล ลองทำจำลองสอบแบบจับเวลาให้ชินกับจังหวะ",
    },
    {
      key: "errors", icon: <IconBook size={16} />, name: "รูปแบบการทำผิด", score: s.errors.score,
      detail: <>ผิดซ้ำข้อเดิม {s.errors.repeated} จาก {s.errors.n} ข้อที่เคยผิด{s.errors.guess + s.errors.careless + s.errors.concept > 0 ? ` · เดา ${s.errors.guess} · สะเพร่า ${s.errors.careless} · ยังไม่เข้าใจ ${s.errors.concept}` : ""}</>,
      wait: "ยังผิดไม่ถึง 10 ข้อ ข้อมูลยังน้อย",
      tip: "ผิดซ้ำข้อเดิมบ่อย แปลว่ายังไม่เข้าใจหลัก อ่านคำอธิบายให้จบก่อนไปข้อต่อไป",
    },
    {
      key: "stamina", icon: <IconTrophy size={16} />, name: "ความทนทาน", score: s.stamina.score,
      detail: <>ชุดยาวช่วงต้นถูก {s.stamina.first ?? "–"}% · ช่วงท้ายถูก {s.stamina.last ?? "–"}%</>,
      wait: "ทำชุด 20 ข้อขึ้นไปหรือจำลองสอบอีก 2 รอบเพื่อเริ่มวัด",
      tip: "ความแม่นตกช่วงท้าย ลองทำชุดยาวขึ้นทีละนิด สนามจริงต้องนั่งทำต่อเนื่องหลายชั่วโมง",
    },
    {
      key: "fix", icon: <IconCheck size={16} />, name: "การแก้จุดอ่อน", score: s.fix.score,
      detail: <>แก้ข้อที่เคยผิดได้แล้ว {s.fix.fixed}/{s.fix.n} ข้อ · ทบทวนข้อผิด {s.fix.redo} รอบใน 30 วัน</>,
      wait: "ยังผิดไม่ถึง 10 ข้อ ข้อมูลยังน้อย",
      tip: "ยังมีข้อที่ผิดค้างอยู่ กด \"ทบทวนข้อที่ผิด\" ในหน้าแรกเพื่อปิดจุดอ่อน",
    },
    {
      key: "coverage", icon: <IconChart size={16} />, name: "ความครอบคลุมและความสดใหม่", score: s.coverage.score,
      detail: <>ฝึกครบ {s.coverage.score ?? 0}% ของผังข้อสอบใน 14 วันล่าสุด{s.coverage.untouched ? ` · ยังไม่เคยทำ ${s.coverage.untouched} หมวด` : ""}</>,
      wait: "",
      tip: "หมวดที่ไม่ได้ทำนานจะค่อยๆ ลืม ลองสุ่มทุกหมวดสัปดาห์ละครั้ง",
    },
  ];
}

export default function ReadinessSignals({ s, compact = false, onMock }: { s: Signals; compact?: boolean; onMock?: () => void }) {
  const rows = rowsOf(s);
  const { score, known } = signalsIndex(s);
  const level = score == null ? 0 : signalLevel(score);
  const [mood, costume] = MASCOT[level];
  const weakest = rows.filter(r => r.score != null).sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];

  return (
    <>
      <div className="pp-rx-main">
        <div className="pp-rx-hero">
          <ReadinessGauge pct={score ?? 0} passTag={false} tone={grade(score)} label={score == null ? "กำลังเก็บข้อมูล" : SIGNAL_VERDICT[level]}
            aria={`ดัชนี 6 สัญญาณความพร้อม ${score ?? "ยังไม่มีข้อมูล"} จาก 100`} />
          <div className={`pp-rx-mascot pp-rx-m-${MOTION[level]}`}><Mascot mood={mood} costume={costume} size={compact ? 84 : 100} motion="still" /></div>
        </div>
        <div className="pp-rx-panel pp-rs-panel">
          {rows.map(r => (
            <div key={r.key} className={`pp-rs-row ${rowGrade(r.score)}`}>
              <i>{r.icon}</i>
              <div className="pp-rs-txt">
                <div className="pp-rs-h"><span>{r.name}</span><b>{r.score ?? "–"}</b></div>
                <div className="pp-rs-bar"><div style={{ width: `${r.score ?? 0}%` }} /></div>
                {!compact && <small>{r.score == null && r.wait ? r.wait : r.detail}</small>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="pp-rx-note small">ดัชนีเฉลี่ยจาก {known} ด้านที่มีข้อมูลพอ · วิเคราะห์จากพฤติกรรมการฝึก ไม่ใช่แค่คะแนน</p>
      {weakest && weakest.score != null && weakest.score < 80 && (
        <div className="pp-rd-focus pp-rx-focus">
          <b className="small">ควรปรับก่อน: {weakest.name} ({weakest.score})</b>
          <div className="pp-rd-f">
            <div><span>{weakest.tip}</span></div>
            {weakest.key === "speed" && onMock && <button className="pp-btn pp-btn-ghost sm" onClick={onMock}>จำลองสอบ</button>}
          </div>
        </div>
      )}
    </>
  );
}
