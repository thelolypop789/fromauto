import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Mascot, { type Costume, type Mood } from "./Mascot";
import { PASS_PCT } from "./api";

// "Road to exam day": a winding path with four stops (ยังไม่พร้อม / ใกล้ถึงเกณฑ์ / ผ่านเกณฑ์ / พร้อมมาก) and the flame
// mascot standing where the user's readiness puts them. Stops are spaced evenly along the path, so the score is
// mapped piecewise onto it: 0, 50, PASS_PCT, 75 and 100 land on STOP_AT.
const W = 360, H = 330, TOP = 44;   // TOP: headroom so the mascot never runs into the band
const PATH = "M60 312 C 60 262, 300 272, 292 216 C 284 160, 68 176, 68 124 C 68 76, 292 94, 290 62 C 288 40, 230 44, 180 46";
const MARKS = [0, 50, PASS_PCT, 75, 100];
const STOP_AT = [0.04, 0.3, 0.55, 0.8, 1];

type Level = { title: string; range: string; motto: string; mood: Mood; costume: Costume; motion: string };
const LEVELS: Level[] = [
  { title: "เพิ่งออกเดินทาง", range: "ต่ำกว่า 50%", motto: "ก้าวแรกยากที่สุด และคุณก้าวมาแล้ว", mood: "sad", costume: "none", motion: "sway" },
  { title: "มาครึ่งทางแล้ว", range: "50–59%", motto: "ไม่ต้องรีบ แค่อย่าหยุดเดิน", mood: "think", costume: "none", motion: "tilt" },
  { title: "ผ่านเกณฑ์แล้ว", range: "60–74%", motto: "ผ่านเกณฑ์ไม่ใช่เส้นชัย ไปให้ถึงจุดที่มั่นใจ", mood: "happy", costume: "teacher", motion: "float" },
  { title: "ถึงหน้าสนามสอบ", range: "75% ขึ้นไป", motto: "ครูคนต่อไป คือคุณ", mood: "cheer", costume: "teacher", motion: "jump" },
];

const levelOf = (pct: number) => (pct >= 75 ? 3 : pct >= PASS_PCT ? 2 : pct >= 50 ? 1 : 0);

const progressOf = (pct: number) => {
  const p = Math.max(0, Math.min(100, pct));
  for (let k = 1; k < MARKS.length; k++) {
    if (p <= MARKS[k]) return STOP_AT[k - 1] + ((p - MARKS[k - 1]) / (MARKS[k] - MARKS[k - 1])) * (STOP_AT[k] - STOP_AT[k - 1]);
  }
  return 1;
};

const nextStep = (pct: number) =>
  pct < PASS_PCT ? `อีก ${Math.ceil(PASS_PCT - pct)}% ถึงเกณฑ์ผ่าน` : pct < 75 ? `อีก ${Math.ceil(75 - pct)}% ถึงระดับพร้อมมาก` : "รักษาระดับนี้ไว้จนถึงวันสอบ";

type Pt = { x: number; y: number };

export default function ReadinessPath({ pct }: { pct: number }) {
  const level = levelOf(pct);
  const lv = LEVELS[level];
  const pathRef = useRef<SVGPathElement>(null);
  const [pts, setPts] = useState<{ stops: Pt[]; at: (t: number) => Pt } | null>(null);
  // The mascot starts at the first stop and walks to its place once the path is measured.
  const [walk, setWalk] = useState(STOP_AT[0]);

  useLayoutEffect(() => {
    const el = pathRef.current;
    if (!el || typeof el.getTotalLength !== "function") return;
    const len = el.getTotalLength();
    const at = (t: number) => { const p = el.getPointAtLength(len * t); return { x: p.x, y: p.y }; };
    setPts({ stops: STOP_AT.slice(0, 4).map(at), at });
  }, []);
  useEffect(() => {
    if (!pts) return;
    const id = window.setTimeout(() => setWalk(progressOf(pct)), 250);
    return () => window.clearTimeout(id);
  }, [pts, pct]);

  const me = pts?.at(walk);
  const pos = (p: Pt) => ({ left: `${(p.x / W) * 100}%`, top: `${((p.y + TOP) / (H + TOP)) * 100}%` });

  return (
    <div className="pp-rp" aria-label={`ความพร้อมสอบ ${Math.round(pct)}% ${lv.title} เกณฑ์ผ่าน ${PASS_PCT}%`} role="img">
      <div className="pp-rp-band">
        <div className="pp-rp-band-t">
          <small>เส้นทางสู่วันสอบ</small>
          <b>{lv.title}</b>
          <span>{nextStep(pct)}</span>
        </div>
        <div className="pp-rp-ring" style={{ background: `conic-gradient(var(--rp-ring) ${Math.round(pct * 3.6)}deg, rgba(255,255,255,.18) 0)` }} data-level={level}>
          <div>{Math.round(pct)}<small>%</small></div>
        </div>
      </div>
      <div className="pp-rp-map" style={{ aspectRatio: `${W} / ${H + TOP}` }}>
        <svg viewBox={`0 ${-TOP} ${W} ${H + TOP}`} aria-hidden="true">
          <path d={PATH} className="pp-rp-road" />
          <path ref={pathRef} d={PATH} className="pp-rp-dash" />
          <g transform={`translate(${W / 2 - 31} 0)`}>
            <path d="M31 2 L60 18 L2 18 Z" fill="var(--pp-primary)" />
            <rect x="8" y="18" width="46" height="24" fill="var(--pp-gold-soft)" stroke="var(--pp-primary)" strokeWidth="2" />
            <rect x="27" y="27" width="8" height="15" fill="var(--pp-primary)" />
            <rect x="13" y="23" width="8" height="7" fill="var(--pp-gold-bright)" />
            <rect x="41" y="23" width="8" height="7" fill="var(--pp-gold-bright)" />
          </g>
        </svg>
        <span className="pp-rp-goal">วันสอบ</span>
        {pts?.stops.map((p, k) => (
          <div key={k} className={`pp-rp-stop ${k <= level ? "done" : ""} ${k === level ? "here" : ""} ${p.x < W / 2 ? "r" : "l"}`} style={pos(p)}>
            <i /><span>{LEVELS[k].range}</span>
          </div>
        ))}
        {me && (
          <div className="pp-rp-me" style={pos(me)}>
            <div className={`pp-rp-m-${lv.motion}`}><Mascot mood={lv.mood} costume={lv.costume} size={92} motion="still" /></div>
          </div>
        )}
      </div>
      <p className="pp-rp-motto">“{lv.motto}”</p>
    </div>
  );
}
