import { useEffect, useState } from "react";
import { PASS_PCT, SECTIONS, rpc, track, type Readiness as Data } from "./api";
import type { Preset } from "./CreateSet";
import Mascot, { type Costume, type Mood } from "./Mascot";
import ReadinessRadar from "./ReadinessRadar";
import ReadinessScene from "./ReadinessScene";

const MIN_ANSWERS = 100;   // under this the estimate is shown as rough
const READY = 75;          // "พร้อมมาก" from here

const tone = (p: number) => (p >= PASS_PCT ? "ok" : p >= PASS_PCT - 10 ? "mid" : "low");
const levelOf = (p: number) => (p >= READY ? 3 : p >= PASS_PCT ? 2 : p >= PASS_PCT - 10 ? 1 : 0);
const VERDICT = ["ยังไม่พร้อม", "ใกล้ถึงเกณฑ์", "ผ่านเกณฑ์", "พร้อมมาก"];
const MASCOT: [Mood, Costume][] = [["sad", "none"], ["think", "none"], ["happy", "teacher"], ["cheer", "teacher"]];
const MOTION = ["sway", "tilt", "float", "jump"];

// Half-circle gauge 0–100: glowing arc with a knob at the score, a tick at the pass mark, the number drawn in HTML on top.
function Gauge({ pct, level }: { pct: number; level: number }) {
  const r = 80, cx = 100, cy = 92, len = Math.PI * r;
  const v = Math.max(0, Math.min(100, pct));
  const at = (x: number) => { const a = Math.PI * (1 - x / 100); return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
  const [kx, ky] = at(v);
  const [px, py] = at(PASS_PCT);
  const ux = (px - cx) / r, uy = (py - cy) / r;
  return (
    <div className="pp-rx-gauge" role="img" aria-label={`ความพร้อมสอบ ${Math.round(pct)}% ${VERDICT[level]} เกณฑ์ผ่าน ${PASS_PCT}%`}>
      <svg viewBox="0 0 200 112" aria-hidden="true">
        <defs>
          <linearGradient id="pp-rx-grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" className="s0" /><stop offset="1" className="s1" /></linearGradient>
        </defs>
        <path className="track" d={`M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`} />
        <path className="fill" d={`M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`} style={{ strokeDasharray: `${(len * v) / 100} ${len}` }} />
        <line className="tick" x1={px - ux * 11} y1={py - uy * 11} x2={px + ux * 11} y2={py + uy * 11} />
        <circle className="knob" cx={kx} cy={ky} r="11" />
        <circle className="knob-in" cx={kx} cy={ky} r="6" />
      </svg>
      <span className="pp-rx-pass" style={{ left: `${(px + ux * 14) / 2}%`, top: `${((py + uy * 14) / 112) * 100}%` }}>เกณฑ์ผ่าน {PASS_PCT}</span>
      <div className="pp-rx-num">
        <b>{Math.round(pct)}<small>%</small></b>
        <span className={tone(pct)}>{VERDICT[level]}</span>
      </div>
    </div>
  );
}

// Road to exam day: stops at 0, 50, PASS_PCT and READY, a finish gate with the school, the mascot at the score.
function Road({ pct, level }: { pct: number; level: number }) {
  const [mood, costume] = MASCOT[level];
  const stops: [number, string][] = [[0, "เริ่ม"], [PASS_PCT - 10, `${PASS_PCT - 10}`], [PASS_PCT, `เกณฑ์ ${PASS_PCT}`], [READY, `${READY}`]];
  return (
    <div className="pp-rx-road" style={{ ["--p" as string]: Math.max(0, Math.min(100, pct)) / 100 }}>
      <small>เส้นทางสู่วันสอบ</small>
      <div className="pp-rx-track">
        <div className="done" />
        {stops.map(([v, l]) => (
          <span key={v} className={`stop ${pct >= v ? "on" : ""} ${v === PASS_PCT || v === 0 ? "" : "minor"}`} style={{ ["--s" as string]: v / 100 }}><i /><em>{l}</em></span>
        ))}
        <div className="me"><Mascot mood={mood} costume={costume} size={34} motion="still" /></div>
        <svg className={`gate lv${level}`} viewBox="0 0 84 62" aria-hidden="true">
          <g className="burst"><path d="M42 30 L46 4 L48 30 Z M42 30 L72 20 L48 32 Z M42 30 L74 44 L46 34 Z M42 30 L16 52 L40 34 Z M42 30 L10 18 L38 30 Z" /></g>
          <path d="M30 26 L42 18 L54 26 Z" fill="#8E1B2E" />
          <rect x="33" y="26" width="18" height="14" fill="#FBF3DC" stroke="#8E1B2E" strokeWidth="1.5" />
          <rect x="39.5" y="31" width="5" height="9" fill="#8E1B2E" />
          <rect x="14" y="10" width="4" height="36" rx="1" fill="#6E1423" />
          <rect x="66" y="10" width="4" height="36" rx="1" fill="#6E1423" />
          <rect x="12" y="4" width="60" height="12" rx="3" fill="#fff" stroke="#8E1B2E" strokeWidth="1.5" />
          <path fill="#2A1418" d="M14 6h4v4h-4zM22 6h4v4h-4zM30 6h4v4h-4zM38 6h4v4h-4zM46 6h4v4h-4zM54 6h4v4h-4zM62 6h4v4h-4zM18 10h4v4h-4zM26 10h4v4h-4zM34 10h4v4h-4zM42 10h4v4h-4zM50 10h4v4h-4zM58 10h4v4h-4zM66 10h4v4h-4z" />
          <line x1="72" y1="-8" x2="72" y2="6" stroke="#6E1423" strokeWidth="1.5" />
          <path className="flag" d="M72 -8 L84 -4 L72 0 Z" fill="#D4AF37" />
          <circle className="spark" cx="8" cy="0" r="2.5" fill="#D4AF37" />
          <circle className="spark d1" cx="78" cy="22" r="2" fill="#E9776B" />
          <circle className="spark d2" cx="4" cy="30" r="2" fill="#8E1B2E" />
        </svg>
        <b className="goal">วันสอบ</b>
      </div>
    </div>
  );
}

// "Ready for the exam?" — estimated score from topic accuracy weighted by the mock-exam blueprint, drawn over a sky
// that brightens with readiness. compact: Home card (one focus topic). full: Stats (three focus topics + the subject radar).
export default function Readiness({ compact = false, onPractice, onMore }: {
  compact?: boolean; onPractice?: (p: Preset) => void; onMore?: () => void;
}) {
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => { rpc<Data>("prep_readiness").then(r => { setD(r); if (r.overall != null) track("readiness_view"); }).catch(() => setD(null)); }, []);
  if (!d || d.overall == null) return null;

  const rough = d.answered < MIN_ANSWERS;
  const focus = compact ? d.focus.slice(0, 1) : d.focus;
  const level = levelOf(d.overall);
  const [mood, costume] = MASCOT[level];

  return (
    <>
      <div className={`pp-card pp-rd pp-rx lv-${level} ${compact ? "compact" : ""}`}>
        <ReadinessScene />
        <div className="pp-rx-body">
          <div className="pp-rd-head">
            <h3>ความพร้อมสอบ</h3>
            {onMore && <button className="pp-link small" onClick={onMore}>ดูรายละเอียด →</button>}
          </div>
          <div className="pp-rx-main">
            <div className="pp-rx-hero">
              <Gauge pct={d.overall} level={level} />
              <div className={`pp-rx-mascot pp-rx-m-${MOTION[level]}`}><Mascot mood={mood} costume={costume} size={compact ? 84 : 100} motion="still" /></div>
            </div>
            <div className="pp-rx-panel">
              {d.sections.map(s => (
                <div key={s.section} className="pp-rd-sec">
                  <div className="pp-rd-sec-h"><span>{SECTIONS[s.section].short}</span><b className={tone(s.pct)}>{Math.round(s.pct)}%</b></div>
                  <div className="pp-rd-track"><div className={tone(s.pct)} style={{ width: `${s.pct}%` }} /><i style={{ left: `${PASS_PCT}%` }} /></div>
                </div>
              ))}
              <Road pct={d.overall} level={level} />
            </div>
          </div>
          <p className="pp-rx-note small">
            คาดคะแนนจากความแม่นแต่ละหมวด ถ่วงตามจำนวนข้อที่ออกจริงในผังข้อสอบ ·{" "}
            {rough ? <b className="pp-rd-rough">ข้อมูลยังน้อย ({d.answered} ข้อ) ทำเพิ่มอีก {MIN_ANSWERS - d.answered} ข้อผลจะแม่นขึ้น</b> : `จาก ${d.answered.toLocaleString("th-TH")} ข้อที่ทำ`}
            {!d.has_major && " · ยังไม่ได้เลือกวิชาเอก จึงยังไม่รวมวิชาเอก"}
          </p>

          {focus.length > 0 && (
            <div className="pp-rd-focus pp-rx-focus">
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
      </div>
      {!compact && <ReadinessRadar d={d} level={level} onPractice={onPractice} />}
    </>
  );
}
