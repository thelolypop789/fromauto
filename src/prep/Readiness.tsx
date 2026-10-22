import { useEffect, useState } from "react";
import { PASS_PCT, SECTIONS, rpc, type Readiness as Data } from "./api";
import type { Preset } from "./CreateSet";

const MIN_ANSWERS = 100;   // under this the estimate is shown as rough

const tone = (p: number) => (p >= PASS_PCT ? "ok" : p >= PASS_PCT - 10 ? "mid" : "low");
const verdict = (p: number) => (p >= 75 ? "พร้อมมาก" : p >= PASS_PCT ? "ผ่านเกณฑ์" : p >= PASS_PCT - 10 ? "ใกล้ถึงเกณฑ์" : "ยังไม่พร้อม");

// Half-circle gauge 0–100 with a tick at the pass mark.
function Gauge({ pct, size = 200 }: { pct: number; size?: number }) {
  const r = 80, cx = 100, cy = 92, len = Math.PI * r;
  const at = (v: number) => { const a = Math.PI * (1 - v / 100); return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
  const [px, py] = at(PASS_PCT);
  const ux = (px - cx) / r, uy = (py - cy) / r;
  return (
    <svg className={`pp-gauge ${tone(pct)}`} viewBox="0 0 200 112" width={size} height={size * 0.56} role="img"
      aria-label={`ความพร้อมสอบ ${pct}% ${verdict(pct)} เกณฑ์ ${PASS_PCT}%`}>
      <path className="pp-gauge-track" d={`M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`} />
      <path className="pp-gauge-fill" d={`M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`}
        style={{ strokeDasharray: `${(len * Math.max(0, Math.min(100, pct))) / 100} ${len}` }} />
      <line className="pp-gauge-tick" x1={px - ux * 12} y1={py - uy * 12} x2={px + ux * 12} y2={py + uy * 12} />
      <text className="pp-gauge-tickl" x={px + ux * 22} y={py + uy * 22 + 3} textAnchor="middle">{PASS_PCT}</text>
      <text className="pp-gauge-n" x={cx} y={cy - 12} textAnchor="middle">{Math.round(pct)}<tspan dx="2">%</tspan></text>
      <text className="pp-gauge-v" x={cx} y={cy + 8} textAnchor="middle">{verdict(pct)}</text>
    </svg>
  );
}

// "Ready for the exam?" — estimated score from topic accuracy weighted by the mock-exam blueprint.
// compact: Home card (gauge, two sections, one focus topic). full: Stats (subjects and three focus topics).
export default function Readiness({ compact = false, onPractice, onMore }: {
  compact?: boolean; onPractice?: (p: Preset) => void; onMore?: () => void;
}) {
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => { rpc<Data>("prep_readiness").then(setD).catch(() => setD(null)); }, []);
  if (!d || d.overall == null) return null;

  const rough = d.answered < MIN_ANSWERS;
  const focus = compact ? d.focus.slice(0, 1) : d.focus;

  return (
    <div className={`pp-card pp-rd ${compact ? "compact" : ""}`}>
      <div className="pp-rd-head">
        <h3>ความพร้อมสอบ</h3>
        {onMore && <button className="pp-link small" onClick={onMore}>ดูรายละเอียด →</button>}
      </div>
      <div className="pp-rd-main">
        <Gauge pct={d.overall} size={compact ? 168 : 220} />
        <div className="pp-rd-secs">
          {d.sections.map(s => (
            <div key={s.section} className="pp-rd-sec">
              <div className="pp-rd-sec-h"><span>{SECTIONS[s.section].short}</span><b className={tone(s.pct)}>{Math.round(s.pct)}%</b></div>
              <div className="pp-rd-track"><div className={tone(s.pct)} style={{ width: `${s.pct}%` }} /><i style={{ left: `${PASS_PCT}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
      <p className="pp-muted small pp-rd-note">
        คาดคะแนนจากความแม่นแต่ละหมวด ถ่วงตามจำนวนข้อที่ออกจริงในผังข้อสอบ ·{" "}
        {rough ? <b className="pp-rd-rough">ข้อมูลยังน้อย ({d.answered} ข้อ) ทำเพิ่มอีก {MIN_ANSWERS - d.answered} ข้อผลจะแม่นขึ้น</b> : `จาก ${d.answered.toLocaleString("th-TH")} ข้อที่ทำ`}
        {!d.has_major && " · ยังไม่ได้เลือกวิชาเอก จึงยังไม่รวมวิชาเอก"}
      </p>

      {!compact && d.sections.map(s => (
        <div key={s.section} className="pp-rd-subj">
          <b className="small">{SECTIONS[s.section].name}</b>
          {s.subjects.map(x => (
            <div key={x.code} className="pp-rd-row">
              <span>{x.name.replace(/^ภาค [กข]: /, "")} <small className="pp-muted">{x.questions} ข้อ</small></span>
              <div className="pp-rd-track sm"><div className={tone(x.pct)} style={{ width: `${x.pct}%` }} /><i style={{ left: `${PASS_PCT}%` }} /></div>
              <b className={tone(x.pct)}>{Math.round(x.pct)}%</b>
            </div>
          ))}
        </div>
      ))}

      {focus.length > 0 && (
        <div className="pp-rd-focus">
          <b className="small">{compact ? "ฝึกหมวดนี้ได้คะแนนเพิ่มมากที่สุด" : "หมวดที่ฝึกแล้วได้คะแนนเพิ่มมากที่สุด"}</b>
          {focus.map(f => (
            <div key={f.sub ?? f.code} className="pp-rd-f">
              <div><span>{f.name}</span><small className="pp-muted">{f.subject.replace(/^ภาค ([กข]): /, "ภาค $1 · ")} · ออกราว {f.w} ข้อ · {f.n ? `ถูก ${f.pct}%` : "ยังไม่เคยทำ"}</small></div>
              {onPractice && <button className="pp-btn pp-btn-ghost sm" onClick={() => onPractice(f.sub ? { topics: [f.code], subtopics: [f.sub] } : { topics: [f.code] })}>ฝึก</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
