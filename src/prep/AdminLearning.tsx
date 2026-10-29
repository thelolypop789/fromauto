import { useEffect, useState } from "react";
import { useAdminTrack } from "./adminTrack";
import { PASS_PCT, rpc, thaiError } from "./api";
import { BarList } from "./ChartParts";
import { nf, shortDay } from "./chartFormat";

// แอดมิน → ภาพรวม → การเรียนรู้: is the product making people exam-ready? Readiness comes from a nightly snapshot of
// everyone who practised in the last 14 days (prep.readiness_daily), so it starts filling from the day it shipped.
type Learning = {
  ready: { n: number; pass: number; buckets: number[] };
  ready_weeks: { w: string; n: number; pass: number }[];
  mock: { n: number; pass: number; buckets: number[] };
  curve: { b: number; users: number; acc: number }[];
  review: { due: number; overdue7: number; users_due: number; users_reviewed: number };
  hard: { topic: string; name: string; n: number; pct: number; suspect: number }[];
  bank: { unseen: number; suspect: number; thin: { topic: string; name: string; slots: number; have: number }[] };
};

const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

// Ten bands of 10 points; bands at or above the pass line are solid, the rest lighter. Hover a band for its count.
function Bands({ title, buckets, unit }: { title: string; buckets: number[]; unit: string }) {
  const [hot, setHot] = useState<number | null>(null);
  const max = Math.max(1, ...buckets), total = buckets.reduce((a, b) => a + b, 0);
  const W = 320, H = 110, padB = 16, top = 8, slot = W / 10, bw = slot - 6;
  return (
    <div className="pp-chart">
      <div className="pp-chart-head"><b>{title}</b><span className="pp-muted small">{nf(total)} {unit}</span></div>
      <div className="pp-chart-box" onMouseLeave={() => setHot(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${buckets.map((v, i) => `${i * 10}–${i * 10 + 9} ${v}`).join(", ")}`}>
          <line className="pp-grid" x1={0} x2={W} y1={H - padB} y2={H - padB} />
          {buckets.map((v, i) => {
            const bh = (v / max) * (H - padB - top), x = i * slot + 3, y = H - padB - bh, r = Math.min(4, bh);
            return (
              <g key={i} onMouseEnter={() => setHot(i)} onClick={() => setHot(i)}>
                <rect x={i * slot} y={0} width={slot} height={H - padB} fill="transparent" />
                {v > 0 && <path className={`pp-bar-mark ${i * 10 >= PASS_PCT ? "" : "soft"} ${hot === i ? "hot" : ""}`}
                  d={`M${x},${y + bh} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${y + bh} Z`} />}
                <text className="pp-axis" x={i * slot + slot / 2} y={H - 3} textAnchor="middle">{i * 10}</text>
              </g>
            );
          })}
          <line className="pp-cc-mark" x1={(PASS_PCT / 10) * slot} x2={(PASS_PCT / 10) * slot} y1={top} y2={H - padB} />
        </svg>
        {hot !== null && <div className="pp-tip" style={{ left: `${Math.min(75, hot * 10)}%` }}>{hot * 10}–{hot * 10 + 9}%: <b>{nf(buckets[hot])}</b> {unit}</div>}
      </div>
      <p className="pp-muted small">เส้นประ = เกณฑ์ผ่าน {PASS_PCT}% · แท่งเข้ม = ผ่านเกณฑ์</p>
    </div>
  );
}

export default function AdminLearning() {
  const track = useAdminTrack();
  const [days, setDays] = useState(30);
  // The answer is kept with the period it was asked for, so switching periods shows the spinner, not old numbers.
  const key = `${days}|${track}`;
  const [res, setRes] = useState<{ key: string; data: Learning } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { rpc<Learning>("prep_admin_learning", { p_days: days, p_track: track }).then(data => setRes({ key, data })).catch(e => setErr(thaiError(e))); }, [days, track, key]);
  const d = res?.key === key ? res.data : null;
  if (err) return <div className="pp-error">{err}</div>;
  return (
    <>
      <div className="pp-seg pp-seg-sub pp-orange" role="radiogroup" aria-label="ช่วงเวลา">
        {[7, 30, 90].map(n => <button key={n} role="radio" aria-checked={days === n} className={days === n ? "on" : ""} onClick={() => setDays(n)}>{n} วัน</button>)}
      </div>
      {!d ? <div className="pp-spinner" /> : (
        <>
          <p className="pp-headline">
            {d.ready.n
              ? `ผู้เรียนที่ฝึกอยู่ ${nf(d.ready.n)} คน มีความพร้อมผ่านเกณฑ์ ${PASS_PCT}% แล้ว ${pct(d.ready.pass, d.ready.n)}% · สอบจำลองผ่าน ${pct(d.mock.pass, d.mock.n)}% จาก ${nf(d.mock.n)} ครั้ง`
              : "เริ่มเก็บคะแนนความพร้อมรายวันแล้ว ตัวเลขจะขึ้นหลังรอบเก็บคืนนี้ (23:45 น.)"}
          </p>
          <div className="pp-okpis">
            <div className="pp-okpi"><span className="pp-okpi-l">พร้อมสอบ (≥ {PASS_PCT})</span><b>{d.ready.n ? `${pct(d.ready.pass, d.ready.n)}%` : "–"}</b><span className="pp-muted small">{nf(d.ready.pass)} จาก {nf(d.ready.n)} คนที่ฝึกใน 14 วัน</span></div>
            <div className="pp-okpi"><span className="pp-okpi-l">สอบจำลองผ่าน</span><b>{d.mock.n ? `${pct(d.mock.pass, d.mock.n)}%` : "–"}</b><span className="pp-muted small">{nf(d.mock.n)} ครั้งที่ส่งในช่วงนี้</span></div>
            <div className="pp-okpi"><span className="pp-okpi-l">ทำทบทวนตามรอบ</span><b>{nf(d.review.users_reviewed)} คน</b><span className="pp-muted small">จาก {nf(d.review.users_due)} คนที่มีข้อถึงรอบ</span></div>
            <div className="pp-okpi"><span className="pp-okpi-l">ข้อทบทวนค้าง</span><b>{nf(d.review.due)}</b><span className="pp-muted small">ในนั้นเลย 7 วัน {nf(d.review.overdue7)} ข้อ</span></div>
          </div>
          <div className="pp-card">
            <div className="pp-chart-grid">
              <Bands title="การกระจายคะแนนความพร้อม (ล่าสุดของแต่ละคน)" buckets={d.ready.buckets} unit="คน" />
              <Bands title="การกระจายคะแนนสอบจำลอง" buckets={d.mock.buckets} unit="ครั้ง" />
            </div>
            {d.ready_weeks.length > 0 && (
              <>
                <h4>% ผู้เรียนที่พร้อมสอบ รายสัปดาห์</h4>
                <BarList rows={d.ready_weeks.map(w => ({ label: `สัปดาห์ ${shortDay(w.w)}`, value: pct(w.pass, w.n), note: `${pct(w.pass, w.n)}% · ${nf(w.n)} คน` }))} />
              </>
            )}
          </div>
          <div className="pp-card">
            <h3>เก่งขึ้นจริงไหม (ความแม่นครั้งแรก)</h3>
            <p className="pp-muted small">ถูกตั้งแต่ครั้งแรกของข้อที่ไม่เคยเห็น เรียงตามจำนวนข้อที่แต่ละคนทำมา · ถ้าเส้นไม่ขยับ แปลว่าคะแนนที่สูงขึ้นมาจากการจำเฉลย (นับตั้งแต่ 24 ต.ค. 2569)</p>
            <BarList rows={d.curve.map(c => ({ label: `ข้อที่ ${c.b * 100 + 1}–${(c.b + 1) * 100}`, value: c.acc, note: `${c.acc}% · ${nf(c.users)} คน` }))} />
          </div>
          <div className="pp-card">
            <h3>10 หมวดที่ผู้เรียนตอบถูกน้อยที่สุด</h3>
            <p className="pp-muted small">นับการตอบครั้งแรก หมวดที่มีคนตอบ ≥ 100 ครั้ง · ถ้ามีเฉลยน่าสงสัยมาก ให้ตรวจเฉลยก่อนสรุปว่าผู้เรียนอ่อน</p>
            <div className="pp-otable-wrap">
              <table className="pp-otable">
                <thead><tr><th>หมวด</th><th>ตอบถูก</th><th>ครั้ง</th><th>เฉลยน่าสงสัย</th></tr></thead>
                <tbody>{d.hard.map(h => <tr key={h.topic}><td>{h.name}</td><td>{h.pct}%</td><td>{nf(h.n)}</td><td>{h.suspect ? <span className="pp-chip warn">{h.suspect} ข้อ</span> : "–"}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
          <div className="pp-card">
            <h3>สุขภาพคลังข้อสอบ</h3>
            <div className="pp-okpis">
              <div className="pp-okpi"><span className="pp-okpi-l">เฉลยน่าสงสัย</span><b>{nf(d.bank.suspect)}</b><span className="pp-muted small">ตรวจที่ ข้อสอบ → คลังข้อสอบ</span></div>
              <div className="pp-okpi"><span className="pp-okpi-l">ข้อที่ยังไม่มีใครทำ</span><b>{nf(d.bank.unseen)}</b><span className="pp-muted small">ข้อสอบเผยแพร่แล้ว</span></div>
            </div>
            {d.bank.thin.length > 0 && (
              <>
                <h4>หมวดที่ข้อน้อยเมื่อเทียบกับผังสอบ (เป้า ≥ 10 เท่าของจำนวนข้อในสอบจำลอง)</h4>
                <BarList rows={d.bank.thin.map(t => ({ label: t.name, value: Math.min(100, (10 * t.have) / t.slots), note: `${nf(t.have)} ข้อ · ${(t.have / t.slots).toFixed(1)} เท่า` }))} />
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
