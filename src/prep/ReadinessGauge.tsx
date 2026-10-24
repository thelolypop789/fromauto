import { PASS_PCT } from "./api";

// Half-circle gauge 0–100 for the readiness card: glowing arc with a knob at the score, optionally a tick and tag at the
// pass mark, the number drawn in HTML on top. Colours come from the card's lv-0..3 class.
export default function ReadinessGauge({ pct, label, tone, aria, passTag = true }: {
  pct: number; label: string; tone: string; aria: string; passTag?: boolean;
}) {
  const r = 80, cx = 100, cy = 92, len = Math.PI * r;
  const v = Math.max(0, Math.min(100, pct));
  const at = (x: number) => { const a = Math.PI * (1 - x / 100); return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
  const [kx, ky] = at(v);
  const [px, py] = at(PASS_PCT);
  const ux = (px - cx) / r, uy = (py - cy) / r;
  return (
    <div className="pp-rx-gauge" role="img" aria-label={aria}>
      <svg viewBox="0 0 200 112" aria-hidden="true">
        <defs>
          <linearGradient id="pp-rx-grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" className="s0" /><stop offset="1" className="s1" /></linearGradient>
        </defs>
        <path className="track" d={`M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`} />
        <path className="fill" d={`M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`} style={{ strokeDasharray: `${(len * v) / 100} ${len}` }} />
        {passTag && <line className="tick" x1={px - ux * 11} y1={py - uy * 11} x2={px + ux * 11} y2={py + uy * 11} />}
        <circle className="knob" cx={kx} cy={ky} r="11" />
        <circle className="knob-in" cx={kx} cy={ky} r="6" />
      </svg>
      {passTag && <span className="pp-rx-pass" style={{ left: `${(px + ux * 14) / 2}%`, top: `${((py + uy * 14) / 112) * 100}%` }}>เกณฑ์ผ่าน {PASS_PCT}</span>}
      <div className="pp-rx-num">
        <b>{Math.round(pct)}{passTag && <small>%</small>}</b>
        <span className={tone}>{label}</span>
      </div>
    </div>
  );
}

