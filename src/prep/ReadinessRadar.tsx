import Mascot, { type Costume, type Mood } from "./Mascot";
import { PASS_PCT, type Readiness as Data } from "./api";
import type { Preset } from "./CreateSet";

// "ความพร้อมรายวิชา": one spoke per mock-exam subject (ภาค ก then ภาค ข), the user's accuracy as a filled shape and the
// pass mark as a dashed ring, plus the mascot pointing at the subject to work on next.
const W = 360, H = 300, CX = 180, CY = 150, R = 92;

const tone = (p: number) => (p >= PASS_PCT ? "ok" : p >= PASS_PCT - 10 ? "mid" : "low");
const short = (name: string) => name.replace(/^ภาค [กข]: /, "");

export default function ReadinessRadar({ d, level, onPractice }: {
  d: Data; level: number; onPractice?: (p: Preset) => void;
}) {
  const subj = d.sections.flatMap(s => s.subjects);
  if (subj.length < 3) return null;
  const n = subj.length;
  const at = (k: number, v: number) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / n;
    return [CX + (R * v / 100) * Math.cos(a), CY + (R * v / 100) * Math.sin(a)] as const;
  };
  const ring = (v: number) => subj.map((_, k) => at(k, v).map(c => c.toFixed(1)).join(",")).join(" ");
  const me = subj.map((x, k) => at(k, Math.max(0, Math.min(100, x.pct))));

  const tried = subj.filter(x => x.n > 0);
  const best = tried.length ? tried.reduce((a, b) => (b.pct > a.pct ? b : a)) : null;
  // Next to work on: the subject furthest below the pass mark, weighted by how many questions it has.
  const worst = subj.reduce((a, b) => ((PASS_PCT - b.pct) * b.questions > (PASS_PCT - a.pct) * a.questions ? b : a));
  const gap = Math.ceil(PASS_PCT - worst.pct);
  const allPass = subj.every(x => x.pct >= PASS_PCT);
  const mood: Mood = allPass ? "cheer" : level >= 2 ? "happy" : "think";
  const costume: Costume = level >= 2 ? "teacher" : "none";
  // The practice button opens the set builder on the best-paying topic of that subject (from the focus list).
  const f = allPass ? undefined : d.subject_focus?.[worst.name] ?? d.focus.find(x => x.subject === worst.name);
  const go: Preset | null = f ? (f.sub ? { topics: [f.code], subtopics: [f.sub] } : { topics: [f.code] }) : null;

  return (
    <div className="pp-card pp-rr">
      <div className="pp-rr-head">
        <h3>ความพร้อมรายวิชา</h3>
        <div className="pp-rr-legend">
          <span><i className="me" />คะแนนของคุณ</span>
          <span><i className="pass" />เกณฑ์ผ่าน {PASS_PCT}%</span>
        </div>
      </div>
      <div className="pp-rr-main">
        <div className="pp-rr-chart" role="img"
          aria-label={`ความพร้อมรายวิชา: ${subj.map(x => `${short(x.name)} ${Math.round(x.pct)}%`).join(", ")} · เกณฑ์ผ่าน ${PASS_PCT}%`}>
          <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
            {[100, 80, 60, 40, 20].map(v => <polygon key={v} points={ring(v)} className={`pp-rr-grid g${v}`} />)}
            {subj.map((_, k) => { const [x, y] = at(k, 100); return <line key={k} x1={CX} y1={CY} x2={x} y2={y} className="pp-rr-axis" />; })}
            <polygon points={ring(PASS_PCT)} className="pp-rr-pass" />
            <polygon points={me.map(p => p.map(c => c.toFixed(1)).join(",")).join(" ")} className="pp-rr-me" />
            {me.map(([x, y], k) => (
              <circle key={k} cx={x} cy={y} r={4.5} className={`pp-rr-dot ${tone(subj[k].pct)}`}><title>{`${short(subj[k].name)} ${Math.round(subj[k].pct)}%`}</title></circle>
            ))}
          </svg>
          {subj.map((x, k) => {
            const [lx, ly] = at(k, 120);
            const c = Math.cos(-Math.PI / 2 + (k * 2 * Math.PI) / n), s = Math.sin(-Math.PI / 2 + (k * 2 * Math.PI) / n);
            const side = Math.abs(c) < .15 ? "c" : c > 0 ? "r" : "l";
            const vert = s < -.9 ? "t" : s > .9 ? "b" : "m";
            return (
              <div key={x.code} className={`pp-rr-lab ${side} ${vert}`} style={{ left: `${(lx / W) * 100}%`, top: `${(ly / H) * 100}%` }}>
                <span>{short(x.name)}</span>
                <b className={tone(x.pct)}>{x.n ? `${Math.round(x.pct)}%` : "ยังไม่ได้ทำ"}</b>
              </div>
            );
          })}
        </div>

        <div className="pp-rr-side">
          <div className="pp-rr-coach">
            <Mascot mood={mood} costume={costume} size={84} motion="idle" />
            <p className="pp-rr-say">
              {allPass
                ? <>ผ่านเกณฑ์ครบทุกวิชาแล้ว! <b>รักษาไว้จนถึงวันสอบนะ</b></>
                : <>ลองเติม <b>{short(worst.name)}</b> ก่อนนะ {worst.n ? `อีก ${gap}% ก็ถึงเกณฑ์แล้ว` : "ยังไม่เคยทำเลย"}</>}
            </p>
          </div>
          {best && (
            <div className="pp-rr-tag ok"><small>จุดแข็ง</small><b>{short(best.name)} {Math.round(best.pct)}%</b></div>
          )}
          {!allPass && (
            <div className="pp-rr-tag low"><small>ควรเติมก่อน</small><b>{short(worst.name)} {worst.n ? `${Math.round(worst.pct)}% · อีก ${gap}% ถึงเกณฑ์` : "· ยังไม่เคยทำ"}</b></div>
          )}
          <p className="pp-muted small pp-rr-hint">ยิ่งรูปทรงกว้างและออกนอกเส้นประสีทองครบทุกด้าน ยิ่งพร้อมสอบ</p>
        </div>
      </div>
      {onPractice && go && (
        <button className="pp-btn pp-btn-primary pp-rr-go" onClick={() => onPractice(go)}>ฝึก{short(worst.name)}</button>
      )}
    </div>
  );
}
