import { useState } from "react";
import { nf, shortDay } from "./chartFormat";

export type Mark = { idx: number; label: string };
type Props = {
  title: string; unit: string; cur: number[]; prev: number[]; curDays: string[]; prevDays: string[];
  marks?: Mark[]; curName: string; prevName: string;
};

// Current period (solid, brand colour) over the previous period (dashed, grey) on ONE axis, aligned by day number.
// Release marks are thin vertical lines numbered 1, 2, ... and explained under the chart. The table below has every number.
export default function CompareChart({ title, unit, cur, prev, curDays, prevDays, marks = [], curName, prevName }: Props) {
  const [hotRaw, setHot] = useState<number | null>(null);
  const n = cur.length;
  const hot = hotRaw !== null && hotRaw < n ? hotRaw : null;   // the range can shrink while a point is hovered
  const W = 320, H = 150, padL = 30, padR = 8, padT = 10, padB = 20;
  const max = Math.max(1, ...cur, ...prev);
  const x = (i: number) => padL + (n <= 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (n - 1));
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const path = (v: number[]) => v.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  const ticks = [0, 0.5, 1].map(f => Math.round(max * f));
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHot(Math.max(0, Math.min(n - 1, Math.round(((px - padL) / (W - padL - padR)) * (n - 1)))));
  };
  const dots = n <= 16;

  return (
    <div className="pp-cc">
      <div className="pp-cc-legend">
        <span><i className="cur" />{curName}</span><span><i className="prev" />{prevName}</span>
      </div>
      <div className="pp-cc-box">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${curName} เทียบกับ ${prevName}`}
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHot(null)}>
          {ticks.map(t => <g key={t}><line className="pp-cc-grid" x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} /><text className="pp-cc-ax" x={padL - 4} y={y(t) + 3} textAnchor="end">{nf(t)}</text></g>)}
          {marks.map((m, k) => (
            <g key={m.idx}><line className="pp-cc-mark" x1={x(m.idx)} x2={x(m.idx)} y1={padT - 4} y2={H - padB} />
              <text className="pp-cc-marknum" x={x(m.idx)} y={padT - 6} textAnchor="middle">{k + 1}</text></g>
          ))}
          <path className="pp-cc-prev" d={path(prev)} />
          <path className="pp-cc-cur" d={path(cur)} />
          {dots && cur.map((v, i) => <circle key={i} className="pp-cc-dot" cx={x(i)} cy={y(v)} r={hot === i ? 4.5 : 2.5} />)}
          {hot !== null && <line className="pp-cc-hair" x1={x(hot)} x2={x(hot)} y1={padT} y2={H - padB} />}
          <text className="pp-cc-ax" x={padL} y={H - 5}>{shortDay(curDays[0])}</text>
          <text className="pp-cc-ax" x={W - padR} y={H - 5} textAnchor="end">{shortDay(curDays[n - 1])}</text>
        </svg>
        {hot !== null && (
          <div className="pp-cc-tip" style={{ left: `${Math.min(70, Math.max(0, (x(hot) / W) * 100 - 14))}%` }}>
            <b>{shortDay(curDays[hot])}: {nf(cur[hot])}</b> {unit}<br />
            <span>{shortDay(prevDays[hot])}: {nf(prev[hot])} {unit}</span>
          </div>
        )}
      </div>
      {marks.length > 0 && <ol className="pp-cc-marks small pp-muted">{marks.map((m, k) => <li key={m.idx} value={k + 1}>{shortDay(curDays[m.idx])} · {m.label}</li>)}</ol>}
      <details className="pp-chart-table">
        <summary className="small pp-muted">ดูเป็นตาราง</summary>
        <div className="pp-guide-table">{cur.map((v, i) => <div key={i}><span>{shortDay(curDays[i])} เทียบ {shortDay(prevDays[i])}</span><b>{nf(v)} / {nf(prev[i])}</b></div>)}</div>
      </details>
    </div>
  );
}
