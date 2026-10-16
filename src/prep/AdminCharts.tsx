import { useEffect, useState } from "react";
import { rpc, thaiError } from "./api";

type Charts = {
  days: number;
  series: { day: string; new_users: number; active_users: number; answers: number; revenue: number }[];
  funnel: { step: string; n: number }[];
  sources: { src: string; users: number; paid: number }[];
  retention: { d1_users: number; d1_back: number; d7_users: number; d7_back: number };
  weak_topics: { topic: string; n: number; pct: number }[];
  tricky: { id: number; topic: string; stem: string; n: number; pct: number; wrong_choice: string | null; wrong_pct: number }[];
  mock: { code: string; name: string; started: number; submitted: number; auto: number; avg_pct: number | null }[];
};

const nf = (n: number) => n.toLocaleString("th-TH");
const shortDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" });

// One series, one hue, thin bars with a rounded top. Hover/tap a bar for its value; the table below has every number.
function ColumnChart({ title, unit, days, values }: { title: string; unit: string; days: string[]; values: number[] }) {
  const [hot, setHot] = useState<number | null>(null);
  const total = values.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...values);
  const W = 320, H = 110, padL = 0, padB = 16, top = 8;
  const slot = (W - padL) / values.length;
  const bw = Math.min(24, Math.max(3, slot - 3));
  const h = (v: number) => (v / max) * (H - padB - top);
  const peak = values.indexOf(Math.max(...values));
  return (
    <div className="pp-chart">
      <div className="pp-chart-head"><b>{title}</b><span className="pp-muted small">รวม {nf(total)} {unit}</span></div>
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
          <text className="pp-axis" x={0} y={H - 3}>{shortDay(days[0])}</text>
          <text className="pp-axis" x={W} y={H - 3} textAnchor="end">{shortDay(days[days.length - 1])}</text>
          {hot === null && values[peak] > 0 && <text className="pp-axis-strong" x={Math.min(W - 4, Math.max(4, padL + peak * slot + slot / 2))} y={Math.max(9, H - padB - h(values[peak]) - 3)} textAnchor="middle">{nf(values[peak])}</text>}
        </svg>
        {hot !== null && <div className="pp-tip" style={{ left: `${Math.min(80, Math.max(0, ((hot + 0.5) / values.length) * 100 - 10))}%` }}>{shortDay(days[hot])}: <b>{nf(values[hot])}</b> {unit}</div>}
      </div>
      <details className="pp-chart-table">
        <summary className="small pp-muted">ดูเป็นตาราง</summary>
        <div className="pp-guide-table">{days.map((d, i) => <div key={d}><span>{shortDay(d)}</span><b>{nf(values[i])}</b></div>)}</div>
      </details>
    </div>
  );
}

// Horizontal bars for a short ranked list. `value` sets the length, `note` is the text on the right.
function BarList({ rows }: { rows: { label: string; value: number; note: string }[] }) {
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

const pct = (a: number, b: number) => (b > 0 ? Math.round((100 * a) / b) : null);

export default function AdminCharts() {
  const [days, setDays] = useState(30);
  const [c, setC] = useState<Charts | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    rpc<Charts>("prep_admin_charts", { p_days: days }).then(r => { if (live) { setC(r); setError(""); } }).catch(e => { if (live) setError(thaiError(e)); });
    return () => { live = false; };
  }, [days]);

  const picker = (
    <div className="pp-seg">
      {[7, 30, 90].map(n => <button key={n} className={days === n ? "on" : ""} onClick={() => setDays(n)}>{n} วัน</button>)}
    </div>
  );
  if (error) return <>{picker}<div className="pp-error">{error}</div></>;
  if (!c) return <>{picker}<div className="pp-spinner" /></>;

  const ds = c.series.map(s => s.day);
  const first = c.funnel[0]?.n ?? 0;
  const r = c.retention;
  const d1 = pct(r.d1_back, r.d1_users), d7 = pct(r.d7_back, r.d7_users);
  const noData = first === 0 && c.series.every(s => s.answers === 0);

  return (
    <>
      {picker}
      <p className="pp-muted small">ช่วง {c.days} วันล่าสุด (เวลาไทย) · เก็บเฉพาะจำนวนและแหล่งที่มา ไม่เก็บเนื้อหาที่ผู้ใช้พิมพ์</p>
      {noData && <div className="pp-card pp-empty"><p className="pp-muted">ยังไม่มีข้อมูลในช่วงนี้</p></div>}

      <div className="pp-card">
        <h3>แต่ละวัน</h3>
        <ColumnChart title="คนที่เข้ามาใช้" unit="คน" days={ds} values={c.series.map(s => s.active_users)} />
        <ColumnChart title="สมาชิกใหม่" unit="คน" days={ds} values={c.series.map(s => s.new_users)} />
        <ColumnChart title="ข้อที่ทำ" unit="ข้อ" days={ds} values={c.series.map(s => s.answers)} />
        <ColumnChart title="รายได้" unit="บาท" days={ds} values={c.series.map(s => s.revenue)} />
      </div>

      <div className="pp-card">
        <h3>จากสมัครถึงซื้อ</h3>
        <p className="pp-muted small">นับเฉพาะคนที่สมัครในช่วงนี้ · “เปิดหน้าซื้อ” เริ่มนับเมื่อมีระบบเก็บข้อมูล คนที่เคยส่งสลิปนับให้ด้วย</p>
        <BarList rows={c.funnel.map(f => ({ label: f.step, value: f.n, note: `${nf(f.n)}${first ? ` · ${pct(f.n, first)}%` : ""}` }))} />
      </div>

      <div className="pp-card">
        <h3>มาจากไหน</h3>
        {c.sources.length === 0 ? <p className="pp-muted small">ยังไม่มีสมาชิกใหม่ในช่วงนี้</p> : (
          <>
            <p className="pp-muted small">ใส่ ?src=ชื่อ ท้ายลิงก์ที่โพสต์ เช่น <b>/prep?src=fb-post1</b> · ตัวเลขคือ สมัครกี่คน / ซื้อกี่คน</p>
            <BarList rows={c.sources.map(s => ({ label: s.src, value: s.users, note: `${nf(s.users)} คน · ซื้อ ${nf(s.paid)}` }))} />
          </>
        )}
      </div>

      <div className="pp-card">
        <h3>กลับมาใช้ซ้ำ</h3>
        <div className="pp-kpis">
          <div className="pp-kpi"><b>{d1 === null ? "–" : `${d1}%`}</b><span>กลับมาวันถัดไป ({r.d1_back}/{r.d1_users})</span></div>
          <div className="pp-kpi"><b>{d7 === null ? "–" : `${d7}%`}</b><span>กลับมาวันที่ 7 ({r.d7_back}/{r.d7_users})</span></div>
        </div>
        <p className="pp-muted small">นับจากวันสมัคร คนที่สมัครไม่ถึง 1 / 7 วันยังไม่ถูกนับ ตัวเลขน้อยกว่า 20 คนอย่าเพิ่งเชื่อมาก</p>
      </div>

      <div className="pp-card">
        <h3>หมวดที่คนทำผิดมากที่สุด</h3>
        {c.weak_topics.length === 0 ? <p className="pp-muted small">ข้อมูลยังไม่พอ (ต้องมีคนตอบหมวดละ 30 ข้อขึ้นไป)</p> : (
          <>
            <p className="pp-muted small">% ตอบถูกของทุกคนรวมกัน ยิ่งสั้นยิ่งยาก · ใช้ตัดสินใจว่าควรเพิ่มเฉลยละเอียดหมวดไหน</p>
            <BarList rows={c.weak_topics.map(t => ({ label: t.topic, value: t.pct, note: `${t.pct}% · ${nf(t.n)} ข้อ` }))} />
          </>
        )}
      </div>

      <div className="pp-card">
        <h3>ข้อที่หลอกคนมากที่สุด</h3>
        {c.tricky.length === 0 ? <p className="pp-muted small">ข้อมูลยังไม่พอ (ต้องมีคนตอบข้อละ 10 ครั้งขึ้นไป)</p> : (
          <>
            <p className="pp-muted small">ถ้าคนเลือกตัวเลือกผิดข้อเดียวกันเยอะมาก อาจเป็นเพราะเฉลยผิด ลองเปิดข้อนั้นในแท็บ “คลังข้อสอบ” ตรวจดู</p>
            {c.tricky.map(t => (
              <div key={t.id} className="pp-tricky">
                <div className="pp-muted small">#{t.id} · {t.topic} · ตอบถูก {t.pct}% จาก {nf(t.n)} ครั้ง</div>
                <div>{t.stem.length > 140 ? `${t.stem.slice(0, 140)}…` : t.stem}</div>
                {t.wrong_choice && <div className="small">ผิดบ่อยสุด ({t.wrong_pct}% เลือก): <b>{t.wrong_choice.length > 80 ? `${t.wrong_choice.slice(0, 80)}…` : t.wrong_choice}</b></div>}
              </div>
            ))}
          </>
        )}
      </div>

      <div className="pp-card">
        <h3>ข้อสอบจำลอง</h3>
        <div className="pp-guide-table">
          {c.mock.map(m => (
            <div key={m.code}><b>{m.name}</b><span>เริ่ม {nf(m.started)} · ส่ง {nf(m.submitted)}{m.auto ? ` · หมดเวลา ${m.auto}` : ""}{m.avg_pct != null ? ` · เฉลี่ย ${m.avg_pct}%` : ""}</span></div>
          ))}
        </div>
      </div>
    </>
  );
}
