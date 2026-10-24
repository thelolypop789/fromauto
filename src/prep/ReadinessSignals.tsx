import type { ReactNode } from "react";
import type { ReadinessSignals as Signals } from "./api";
import { IconBook, IconCalendar, IconCheck, IconChart, IconTarget, IconTrophy } from "./icons";

// "6 สัญญาณความพร้อม": how the user practises, not only how much they get right. Each reading is 0–100 from
// prep_readiness; a reading without enough data says what is still needed instead of showing a number.
const SEC_PER_Q = 54;   // the written exam gives about 54 s per question

type Row = { key: string; icon: ReactNode; name: string; score: number | null; detail: ReactNode; wait: string; tip: string };

const grade = (s: number) => (s >= 80 ? ["ok", "ดีมาก"] : s >= 60 ? ["mid", "พอใช้"] : ["low", "ควรปรับ"]);

export default function ReadinessSignals({ s, onMock }: { s: Signals; onMock?: () => void }) {
  const rows: Row[] = [
    {
      key: "accuracy", icon: <IconTarget size={20} />, name: "ความแม่นและการจำระยะยาว", score: s.accuracy.score,
      detail: <>จำได้จริง <b>{s.accuracy.score ?? 0}%</b> ของ {s.accuracy.n.toLocaleString("th-TH")} ข้อที่เคยเจอ · แก้แล้วยังจำได้ข้ามวัน {s.accuracy.retained} ข้อ{s.accuracy.shaky ? ` · เพิ่งถูกหลังดูเฉลย ${s.accuracy.shaky} ข้อ (ยังไม่นับเต็ม)` : ""}</>,
      wait: `ทำอีก ${Math.max(0, 20 - s.accuracy.n)} ข้อเพื่อเริ่มวัด`,
      tip: "ข้อที่เคยผิด ลองกลับมาทำอีกครั้งในวันถัดไป ถ้ายังถูกอยู่ถึงจะนับว่าจำได้จริง",
    },
    {
      key: "speed", icon: <IconCalendar size={20} />, name: "ความเร็วและความมั่นใจ", score: s.speed.score,
      detail: <>ข้อที่ตอบถูกใช้เวลาเฉลี่ย <b>{s.speed.median_s ?? "–"} วินาที</b> (สนามจริงมีราว {SEC_PER_Q} วินาทีต่อข้อ){s.speed.slow ? ` · ถูกแต่ช้าเกิน 90 วินาที ${s.speed.slow} ข้อ` : ""}</>,
      wait: `เพิ่งเริ่มจับเวลา ตอบถูกอีก ${Math.max(0, 15 - s.speed.n)} ข้อเพื่อเริ่มวัด`,
      tip: "ตอบถูกแต่ยังช้า แปลว่ายังลังเล ลองทำจำลองสอบแบบจับเวลาให้ชินกับจังหวะ",
    },
    {
      key: "errors", icon: <IconBook size={20} />, name: "รูปแบบการทำผิด", score: s.errors.score,
      detail: <>ผิดซ้ำข้อเดิม <b>{s.errors.repeated}</b> จาก {s.errors.n} ข้อที่เคยผิด
        {s.errors.guess + s.errors.careless + s.errors.concept > 0 && <> · 30 วันล่าสุด: เดา {s.errors.guess} · สะเพร่า {s.errors.careless} · ยังไม่เข้าใจ {s.errors.concept}</>}</>,
      wait: `ยังผิดไม่ถึง 10 ข้อ ข้อมูลยังน้อย`,
      tip: "ผิดซ้ำข้อเดิมบ่อย แปลว่ายังไม่เข้าใจหลัก อ่านคำอธิบายให้จบก่อนไปข้อต่อไป",
    },
    {
      key: "stamina", icon: <IconTrophy size={20} />, name: "ความทนทาน", score: s.stamina.score,
      detail: <>ชุดยาวช่วงต้นถูก <b>{s.stamina.first ?? "–"}%</b> · ช่วงท้ายถูก <b>{s.stamina.last ?? "–"}%</b> (จาก {s.stamina.sessions} ชุดใน 60 วัน)</>,
      wait: "ทำชุดตั้งแต่ 20 ข้อขึ้นไป หรือจำลองสอบ อย่างน้อย 2 รอบเพื่อเริ่มวัด",
      tip: "ความแม่นตกช่วงท้าย ลองทำชุดยาวขึ้นทีละนิด สนามจริงต้องนั่งทำต่อเนื่องหลายชั่วโมง",
    },
    {
      key: "fix", icon: <IconCheck size={20} />, name: "การแก้จุดอ่อน", score: s.fix.score,
      detail: <>แก้ข้อที่เคยผิดได้แล้ว <b>{s.fix.fixed}/{s.fix.n}</b> ข้อ · ทบทวนข้อผิด {s.fix.redo} รอบใน 30 วัน{s.fix.dwell_s != null ? ` · อ่านเฉลยข้อที่ผิดเฉลี่ย ${s.fix.dwell_s} วินาที` : ""}</>,
      wait: "ยังผิดไม่ถึง 10 ข้อ ข้อมูลยังน้อย",
      tip: "ยังมีข้อที่ผิดค้างอยู่ กด \"ทบทวนข้อที่ผิด\" ในหน้าแรกเพื่อปิดจุดอ่อน",
    },
    {
      key: "coverage", icon: <IconChart size={20} />, name: "ความครอบคลุมและความสดใหม่", score: s.coverage.score,
      detail: <>ฝึกครบ <b>{s.coverage.score ?? 0}%</b> ของผังข้อสอบใน 14 วันล่าสุด{s.coverage.untouched ? ` · ยังไม่เคยทำ ${s.coverage.untouched} หมวด` : ""}</>,
      wait: "",
      tip: "หมวดที่ไม่ได้ทำนานจะค่อยๆ ลืม ลองสุ่มทุกหมวดสัปดาห์ละครั้ง",
    },
  ];

  return (
    <div className="pp-card pp-sg">
      <div className="pp-sg-head">
        <h3>6 สัญญาณความพร้อม</h3>
        <span className="pp-muted small">วิเคราะห์จากพฤติกรรมการฝึก ไม่ใช่แค่คะแนน</span>
      </div>
      <div className="pp-sg-grid">
        {rows.map(r => {
          const [cls, label] = r.score == null ? ["wait", "กำลังเก็บข้อมูล"] : grade(r.score);
          return (
            <div key={r.key} className={`pp-sg-item ${cls}`}>
              <div className="pp-sg-top">
                <i>{r.icon}</i>
                <b>{r.name}</b>
                <span className="pp-sg-score">{r.score == null ? "–" : r.score}</span>
              </div>
              <div className="pp-sg-bar"><div style={{ width: `${r.score ?? 0}%` }} /></div>
              <span className="pp-sg-label">{label}</span>
              <p>{r.score == null && r.wait ? r.wait : r.detail}</p>
              {r.score != null && r.score < 60 && <p className="pp-sg-tip">{r.tip}</p>}
              {r.key === "speed" && r.score != null && r.score < 60 && onMock && <button className="pp-btn pp-btn-ghost sm" onClick={onMock}>ทำจำลองสอบ</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
