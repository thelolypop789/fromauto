import { useState } from "react";
import { PASS_PCT, type MockPayload } from "./api";
import { IconBack, IconCheck, IconX } from "./icons";
import Mascot from "./Mascot";
import Confetti from "./Confetti";
import { scoreMood } from "./mascotUtil";

const LABELS = ["ก", "ข", "ค", "ง"];
const fmtTime = (s: number) => `${Math.floor(s / 60)} นาที ${s % 60} วินาที`;

type Props = { payload: MockPayload; onBack: () => void; onReview: () => void };

export default function MockResult({ payload, onBack, onReview }: Props) {
  const r = payload.result!;
  const [filter, setFilter] = useState<"wrong" | "all" | "blank">("wrong");
  const list = payload.items.filter(i => filter === "all" || (filter === "blank" ? i.picked == null : i.picked !== i.answer));
  const blank = r.total - r.answered;
  const passed = r.pct >= PASS_PCT;
  const mm = scoreMood(r.pct);

  return (
    <>
      <div className="pp-card pp-mock-score">
        {mm.party && <Confetti />}
        <div className="pp-muted">{payload.name}</div>
        <div className="pp-result-mascot"><Mascot mood={mm.mood} motion={mm.party ? "cheer" : "pop"} size={112} /></div>
        <div className="pp-result-say">{mm.say}</div>
        <div className={`pp-score ${passed ? "ok" : "low"}`}>{r.score}<small>/{r.total}</small></div>
        <div><b>{Math.round(r.pct)}%</b> <span className="pp-muted">· เกณฑ์อ้างอิง {PASS_PCT}% {passed ? "ผ่าน" : "ยังไม่ถึง"}</span></div>
        <div className="pp-muted small">ใช้เวลา {fmtTime(r.used_seconds)} จาก {payload.minutes} นาที · ตอบ {r.answered} ข้อ{blank ? ` · ไม่ได้ตอบ ${blank} ข้อ (นับผิด)` : ""}</div>
        {r.percentile != null
          ? <p>คะแนนสูงกว่าผู้สอบวิชานี้ <b>{r.percentile}%</b> (จากผู้สอบ {r.players.toLocaleString()} คน)</p>
          : <p className="pp-muted small">ยังมีผู้สอบวิชานี้ไม่พอสำหรับเทียบอันดับ</p>}
        <div className="pp-row">
          <button className="pp-btn pp-btn-primary" onClick={onReview}>ไปทวนข้อที่ผิด</button>
          <button className="pp-btn pp-btn-ghost" onClick={onBack}><IconBack />กลับ</button>
        </div>
      </div>

      <div className="pp-card">
        <h3>คะแนนรายหมวด</h3>
        {[...r.per_topic].sort((a, b) => a.correct / a.n - b.correct / b.n).map(t => {
          const p = Math.round(100 * t.correct / t.n);
          return (
            <div key={t.topic} className="pp-topic-bar">
              <div className="pp-topic-bar-h"><span>{t.topic}</span><b className={p >= PASS_PCT ? "ok" : "low"}>{t.correct}/{t.n} · {p}%</b></div>
              <div className="pp-bar"><div style={{ width: `${p}%` }} /></div>
            </div>
          );
        })}
        <p className="pp-muted small">เรียงจากหมวดที่ถูกน้อยสุดขึ้นก่อน ควรเร่งหมวดบนสุด</p>
      </div>

      <div className="pp-card">
        <h3>เฉลยทีละข้อ</h3>
        <div className="pp-seg">
          {([["wrong", `ผิด/ไม่ได้ตอบ (${payload.items.filter(i => i.picked !== i.answer).length})`], ["blank", `ไม่ได้ตอบ (${blank})`], ["all", `ทั้งหมด (${r.total})`]] as const).map(([k, l]) => (
            <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        {list.length === 0 && <p className="pp-muted">ไม่มีข้อในกลุ่มนี้</p>}
        {list.map(i => (
          <div key={i.idx} className={`pp-mock-review ${i.picked === i.answer ? "ok" : "bad"}`}>
            <div className="pp-q-topic">{i.topic}</div>
            <div className="pp-q-stem"><span className="pp-q-no">{i.idx + 1}.</span> {i.stem}</div>
            <div className="pp-choices">
              {i.choices.map((text, c) => {
                const state = c === i.answer ? "right" : c === i.picked ? "wrong" : "dim";
                return (
                  <div key={c} className={`pp-choice ${state}`}>
                    <span className="pp-choice-l">{LABELS[c]}</span><span className="pp-choice-t">{text}</span>
                    <span className="pp-choice-ico">{state === "right" ? <IconCheck size={20} /> : state === "wrong" ? <IconX size={20} /> : null}</span>
                  </div>
                );
              })}
            </div>
            {i.picked == null && <p className="pp-muted small">ไม่ได้ตอบข้อนี้</p>}
            {i.explanation && <p className="pp-explain">{i.explanation}</p>}
          </div>
        ))}
      </div>
    </>
  );
}
