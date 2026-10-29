import { useState } from "react";
import { nf, shortDay } from "./chartFormat";

export type ChartMark = { d: string; kind: string; label: string };
const EVENT_KIND: Record<string, string> = { exam: "วันสอบ", apply: "รับสมัคร", result: "ประกาศผล", other: "ปฏิทิน" };

// One series, one hue, thin bars with a rounded top. Hover/tap a bar for its value; the table below has every number.
// marks: calendar events draw a dashed gold line on their day; Facebook posts ("post") a small gold dot under the axis.
export function ColumnChart({ title, unit, days, values, format = shortDay, headNote, marks = [] }: { title: string; unit: string; days: string[]; values: number[]; format?: (s: string) => string; headNote?: string; marks?: ChartMark[] }) {
  const [hot, setHot] = useState<number | null>(null);
  const total = values.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...values);
  const W = 320, H = 110, padL = 0, padB = 16, top = 8;
  const slot = (W - padL) / values.length;
  const bw = Math.min(24, Math.max(3, slot - 3));
  const h = (v: number) => (v / max) * (H - padB - top);
  const peak = values.indexOf(Math.max(...values));
  const at = (d: string) => days.indexOf(d);
  const events = marks.filter(m => m.kind !== "post" && at(m.d) >= 0);
  const posts = marks.filter(m => m.kind === "post" && at(m.d) >= 0);
  const marksOn = (i: number) => marks.filter(m => m.d === days[i]);
  return (
    <div className="pp-chart">
      <div className="pp-chart-head"><b>{title}</b><span className="pp-muted small">{headNote ?? `รวม ${nf(total)} ${unit}`}</span></div>
      <div className="pp-chart-box" onMouseLeave={() => setHot(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} รายวัน รวม ${nf(total)} ${unit}`}>
          {[0, 0.5, 1].map(f => <line key={f} className="pp-grid" x1={0} x2={W} y1={H - padB - f * (H - padB - top)} y2={H - padB - f * (H - padB - top)} />)}
          {values.map((v, i) => {
            const x = padL + i * slot + (slot - bw) / 2, bh = Math.max(v > 0 ? 2 : 0, h(v)), y = H - padB - bh, r = Math.min(4, bw / 2, bh);
            return (
              <g key={i} onMouseEnter={() => setHot(i)} onClick={() => setHot(i)}>
                <rect x={padL + i * slot} y={0} width={slot} height={H - padB} fill="transparent" />
                {v > 0 && <path className={`pp-bar-mark ${hot === i ? "hot" : ""}`}
                  d={`M${x},${y + bh} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${y + bh} Z`} />}
              </g>
            );
          })}
          {events.map((m, k) => { const x = padL + at(m.d) * slot + slot / 2; return (
            <g key={`e${k}`} aria-hidden="true"><line className="pp-cc-mark" x1={x} x2={x} y1={top} y2={H - padB} /><text className="pp-cc-marknum" x={x + 2} y={top + 8}>{k + 1}</text></g>
          ); })}
          {[...new Set(posts.map(m => m.d))].map(d => <circle key={`p${d}`} className="pp-post-dot" cx={padL + at(d) * slot + slot / 2} cy={H - padB + 3} r={2} aria-hidden="true" />)}
          <text className="pp-axis" x={0} y={H - 3}>{format(days[0])}</text>
          <text className="pp-axis" x={W} y={H - 3} textAnchor="end">{format(days[days.length - 1])}</text>
          {hot === null && values[peak] > 0 && <text className="pp-axis-strong" x={Math.min(W - 4, Math.max(4, padL + peak * slot + slot / 2))} y={Math.max(9, H - padB - h(values[peak]) - 3)} textAnchor="middle">{nf(values[peak])}</text>}
        </svg>
        {hot !== null && <div className="pp-tip" style={{ left: `${Math.min(80, Math.max(0, ((hot + 0.5) / values.length) * 100 - 10))}%` }}>{format(days[hot])}: <b>{nf(values[hot])}</b> {unit}{marksOn(hot).length > 0 && <span className="pp-tip-marks">{marksOn(hot).map(m => m.kind === "post" ? "โพสต์" : EVENT_KIND[m.kind] ?? "ปฏิทิน").filter((v, i, a) => a.indexOf(v) === i).join(" · ")}</span>}</div>}
      </div>
      {(events.length > 0 || posts.length > 0) && (
        <ol className="pp-cc-marks small pp-muted">
          {events.map((m, k) => <li key={k}><b>{k + 1}</b> {format(m.d)} · {EVENT_KIND[m.kind] ?? "ปฏิทิน"}: {m.label}</li>)}
          {posts.length > 0 && <li className="pp-post-note">จุดสีทองใต้แกน = วันที่โพสต์ Facebook ({nf(posts.length)} โพสต์)</li>}
        </ol>
      )}
      <details className="pp-chart-table">
        <summary className="small pp-muted">ดูเป็นตาราง</summary>
        <div className="pp-guide-table">{days.map((d, i) => <div key={d}><span>{format(d)}</span><b>{nf(values[i])}</b></div>)}</div>
      </details>
    </div>
  );
}

// Horizontal bars for a short ranked list. `value` sets the length, `note` is the text on the right.
export function BarList({ rows }: { rows: { label: string; value: number; note: string }[] }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <div className="pp-hbars">
      {rows.map((r, i) => (
        <div key={i} className="pp-hbar">
          <div className="pp-hbar-t"><span>{r.label}</span><b>{r.note}</b></div>
          <div className="pp-hbar-track"><div style={{ width: `${Math.max(r.value > 0 ? 2 : 0, (100 * r.value) / max)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}


// One value per row (bar) with the group average as a thin tick on the same track: easy to see who is above or below.
export function CompareList({ rows, avgLabel }: { rows: { label: string; value: number; avg: number | null; note: string }[]; avgLabel: string }) {
  return (
    <div className="pp-hbars">
      {rows.map((r, i) => (
        <div key={i} className="pp-hbar">
          <div className="pp-hbar-t"><span>{r.label}</span><b>{r.note}</b></div>
          <div className="pp-hbar-track pp-cmp">
            <div style={{ width: `${Math.max(r.value > 0 ? 2 : 0, Math.min(100, r.value))}%` }} />
            {r.avg != null && <i className="pp-cmp-tick" style={{ left: `${Math.min(100, Math.max(0, r.avg))}%` }} title={`${avgLabel} ${r.avg}%`} />}
          </div>
        </div>
      ))}
      <p className="pp-muted small">แท่ง = ผลของคนนี้ · เส้นขีดตั้ง = {avgLabel}</p>
    </div>
  );
}

// "▲ 12%" / "▼ 8%" / "เท่าเดิม" against the previous period; sign and arrow carry the meaning, not colour.
export function Delta({ cur, prev, unit = "" }: { cur: number; prev: number; unit?: string }) {
  if (prev === 0 && cur === 0) return <span className="pp-delta">–</span>;
  if (prev === 0) return <span className="pp-delta">▲ ใหม่</span>;
  const p = Math.round((100 * (cur - prev)) / prev);
  if (p === 0) return <span className="pp-delta">= เท่าเดิม{unit}</span>;
  return <span className="pp-delta">{p > 0 ? "▲" : "▼"} {Math.abs(p)}%</span>;
}
