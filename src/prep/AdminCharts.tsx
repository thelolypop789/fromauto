import { useEffect, useMemo, useState } from "react";
import { useAdminTrack } from "./adminTrack";
import { rpc, thaiError } from "./api";
import { Delta } from "./ChartParts";
import CompareChart from "./CompareChart";
import AdminChartDetails from "./AdminChartDetails";
import { nf, shortDay } from "./chartFormat";

type M = { active: number; new: number; answers: number; revenue: number; buyers: number; mocks: number };
type Totals = M & { d1_users: number; d1_back: number; funnel: number[] };
type Compare = {
  range: { mode: "previous" | "mark"; n: number; cur_from: string; cur_to: string; prev_from: string; prev_to: string };
  cur: Totals; prev: Totals;
  series: { i: number; cur_day: string; prev_day: string; cur: M; prev: M }[];
  sources: { src: string; users: number; buyers: number; revenue: number; prev_users: number; prev_buyers: number }[];
  features: Record<string, { cur: number; prev: number; first_day: string | null }>;
  promo: { orders_cur: number; orders_prev: number; discount_cur: number };
  marks: { day: string; label: string }[];
  all_marks: { day: string; label: string }[];
  snapshots: { day: string; users: number; paid: number; majors: number; approved: number; tagged: number }[];
};

const METRICS = [
  { k: "active", label: "คนใช้งาน", unit: "คน" },
  { k: "new", label: "สมาชิกใหม่", unit: "คน" },
  { k: "answers", label: "ข้อที่ทำ", unit: "ข้อ" },
  { k: "buyers", label: "คนซื้อ", unit: "คน" },
  { k: "revenue", label: "รายได้", unit: "บาท" },
] as const;
type MK = typeof METRICS[number]["k"];
const FUNNEL = ["สมัคร", "สร้างชุดฝึก", "เปิดหน้าซื้อ", "ส่งสลิป", "ซื้อสำเร็จ"];
const FEATURES: [string, string][] = [
  ["level_view", "เลเวลและวันต่อเนื่อง"], ["readiness_view", "เกจความพร้อมสอบ"], ["subtopic_pick", "เลือกหมวดย่อยวิชาเอก"],
  ["scoredist_view", "กราฟเทียบคะแนนคนอื่น"], ["promo_apply", "ใช้โค้ดส่วนลด"], ["board_view", "ดูตารางอันดับ"], ["buy_view", "เปิดหน้าซื้อ"],
  ["install_view", "เห็นป๊อปอัปติดตั้งแอป"], ["install_click", "กดติดตั้งแอป"], ["install_done", "ติดตั้งแอปสำเร็จ"], ["summary_view", "เปิดสรุปแบบแผนผัง"],
];
const pct = (a: number, b: number) => (b > 0 ? Math.round((100 * a) / b) : null);
const dayName = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" });

function Spark({ v }: { v: number[] }) {
  const max = Math.max(1, ...v), W = 60, H = 22;
  const d = v.map((p, i) => `${i ? "L" : "M"}${((i * W) / Math.max(1, v.length - 1)).toFixed(1)},${(H - 2 - (p / max) * (H - 4)).toFixed(1)}`).join(" ");
  return <svg className="pp-spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true"><path d={d} /></svg>;
}

// One screen to see whether things are getting better: every number is this period against the one before it
// (or after a release against the days before it), the five daily numbers share one chart, and the extras sit under it.
export default function AdminCharts() {
  const track = useAdminTrack();
  const [days, setDays] = useState(14);
  const [mark, setMark] = useState<string>("");     // "" = compare with the period before
  const [d, setD] = useState<Compare | null>(null);
  const [error, setError] = useState("");
  const [metric, setMetric] = useState<MK>("active");
  const [more, setMore] = useState(false);

  useEffect(() => {
    let live = true;
    rpc<Compare>("prep_admin_compare", { p_days: days, p_mark: mark || null, p_track: track })
      .then(r => { if (live) { setD(r); setError(""); } }).catch(e => { if (live) setError(thaiError(e)); });
    return () => { live = false; };
  }, [days, mark, track]);

  const view = useMemo(() => {
    if (!d) return null;
    const get = (k: MK, w: "cur" | "prev") => d.series.map(s => s[w][k]);
    return { get, curDays: d.series.map(s => s.cur_day), prevDays: d.series.map(s => s.prev_day) };
  }, [d]);

  const controls = (
    <div className="pp-cmp-controls">
      <div className="pp-seg">
        {[7, 14, 30, 90].map(n => <button key={n} className={!mark && days === n ? "on" : ""} onClick={() => { setMark(""); setDays(n); }}>{n} วัน</button>)}
      </div>
      {(d?.all_marks.length ?? 0) > 0 && (
        <label className="small pp-cmp-mark">เทียบก่อน/หลัง
          <select className="pp-input" value={mark} onChange={e => setMark(e.target.value)}>
            <option value="">— ช่วงก่อนหน้าเท่ากัน —</option>
            {d!.all_marks.map(m => <option key={m.day} value={m.day}>{dayName(m.day)} · {m.label}</option>)}
          </select>
        </label>
      )}
    </div>
  );
  if (error) return <>{controls}<div className="pp-error">{error}</div></>;
  if (!d || !view) return <>{controls}<div className="pp-spinner" /></>;

  const r = d.range, c = d.cur, p = d.prev;
  const curName = mark ? `หลัง ${dayName(r.cur_from)} (${r.n} วัน)` : `${dayName(r.cur_from)}–${dayName(r.cur_to)}`;
  const prevName = mark ? `ก่อนหน้า ${r.n} วัน` : `${dayName(r.prev_from)}–${dayName(r.prev_to)}`;
  const ret = (t: Totals) => pct(t.d1_back, t.d1_users);
  const rc = ret(c), rp = ret(p);
  const marksIn = d.marks.map(m => ({ idx: Math.round((Date.parse(m.day) - Date.parse(r.cur_from)) / 86_400_000), label: m.label }))
    .filter(m => m.idx >= 0 && m.idx < r.n);
  const m0 = METRICS.find(m => m.k === metric)!;
  const per = (t: Totals) => (t.active ? Math.round(t.answers / t.active) : 0);

  return (
    <>
      {controls}
      <p className="pp-muted small">
        {curName} เทียบกับ {prevName} (เวลาไทย){mark && r.n < 3 ? " · หลังออกฟีเจอร์ยังไม่ถึง 3 วัน ตัวเลขยังไม่น่าเชื่อถือ" : ""}
        {!mark && p.new + p.active < 10 ? " · ระบบเพิ่งเริ่ม ช่วงก่อนหน้ายังมีข้อมูลน้อย ลองเลือก “เทียบก่อน/หลัง” ที่วันออกฟีเจอร์" : ""}
      </p>

      <div className="pp-card">
        <div className="pp-cmp-kpis">
          {METRICS.map(m => (
            <button key={m.k} className={`pp-cmp-kpi ${metric === m.k ? "on" : ""}`} onClick={() => setMetric(m.k)} aria-pressed={metric === m.k}>
              <span>{m.label}</span>
              <b>{nf(c[m.k])}<small> {m.unit}</small></b>
              <small className="pp-muted"><Delta cur={c[m.k]} prev={p[m.k]} /> · ก่อน {nf(p[m.k])}</small>
              <Spark v={view.get(m.k, "cur")} />
            </button>
          ))}
          <div className="pp-cmp-kpi static">
            <span>กลับมาวันถัดไป</span>
            <b>{rc === null ? "–" : `${rc}%`}</b>
            <small className="pp-muted">{rc !== null && rp !== null ? `${rc - rp >= 0 ? "▲" : "▼"} ${Math.abs(rc - rp)} จุด · ก่อน ${rp}%` : "ก่อน –"}</small>
            <small className="pp-muted">{c.d1_back}/{c.d1_users} คน</small>
          </div>
        </div>
        <h3 className="pp-cmp-h">{m0.label} รายวัน</h3>
        <CompareChart title={m0.label} unit={m0.unit} cur={view.get(metric, "cur")} prev={view.get(metric, "prev")}
          curDays={view.curDays} prevDays={view.prevDays} marks={marksIn} curName={curName} prevName={prevName} />
        <p className="pp-muted small">ข้อที่ทำต่อคนที่ใช้งาน {nf(per(c))} (ก่อน {nf(per(p))}) · จำลองสอบ {nf(c.mocks)} ครั้ง (ก่อน {nf(p.mocks)}) · กดการ์ดด้านบนเพื่อสลับกราฟ</p>
      </div>

      <div className="pp-card">
        <h3>จากสมัครถึงซื้อ</h3>
        <p className="pp-muted small">นับคนที่สมัครในแต่ละช่วง · แท่งบน = ช่วงนี้ แท่งล่าง = ช่วงก่อนหน้า</p>
        <div className="pp-cmp-funnel">
          {FUNNEL.map((label, i) => {
            const a = c.funnel[i] ?? 0, b = p.funnel[i] ?? 0, base = Math.max(1, c.funnel[0], p.funnel[0]);
            return (
              <div key={label} className="pp-cmp-f">
                <div className="pp-cmp-f-t"><span>{label}</span>
                  <b>{nf(a)}{c.funnel[0] ? ` · ${pct(a, c.funnel[0])}%` : ""}<small className="pp-muted"> · ก่อน {nf(b)}{p.funnel[0] ? ` · ${pct(b, p.funnel[0])}%` : ""}</small></b></div>
                <div className="pp-cmp-f-bars"><div className="cur" style={{ width: `${(100 * a) / base}%` }} /><div className="prev" style={{ width: `${(100 * b) / base}%` }} /></div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pp-card">
        <h3>ช่องทางที่คนมา</h3>
        {d.sources.length === 0 ? <p className="pp-muted small">ยังไม่มีสมาชิกใหม่</p> : (
          <>
            <p className="pp-muted small">ใส่ ?src=ชื่อ ท้ายลิงก์โพสต์ (ลิงก์โค้ดส่วนลดใส่ให้แล้ว) · แปลง = คนซื้อ ÷ คนสมัคร</p>
            <div className="pp-cmp-src">
              <div className="head"><span>ช่องทาง</span><span>สมัคร</span><span>ซื้อ</span><span>รายได้</span></div>
              {d.sources.filter(s => s.users > 0).map(s => (
                <div key={s.src}>
                  <span>{s.src}</span>
                  <span>{nf(s.users)} <small className="pp-muted"><Delta cur={s.users} prev={s.prev_users} /></small></span>
                  <span>{nf(s.buyers)} <small className="pp-muted">{pct(s.buyers, s.users) ?? 0}%</small></span>
                  <span>{nf(s.revenue)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="pp-card">
        <h3>ฟีเจอร์ใหม่ใช้จริงไหม</h3>
        <p className="pp-muted small">จำนวนคนที่เปิดใช้อย่างน้อย 1 ครั้งในช่วง และสัดส่วนของคนที่ใช้งานแอป · เริ่มเก็บตั้งแต่ฟีเจอร์ออก</p>
        <div className="pp-cmp-src feat">
          <div className="head"><span>ฟีเจอร์</span><span>ช่วงนี้</span><span>ก่อนหน้า</span></div>
          {FEATURES.map(([k, label]) => {
            const f = d.features[k]; if (!f) return null;
            return (
              <div key={k}>
                <span>{label}</span>
                <span>{f.first_day ? <>{nf(f.cur)} คน <small className="pp-muted">{pct(f.cur, c.active) ?? 0}%</small></> : <small className="pp-muted">ยังไม่มีคนใช้</small>}</span>
                <span>{f.first_day ? <>{nf(f.prev)} <small className="pp-muted"><Delta cur={f.cur} prev={f.prev} /></small></> : "–"}</span>
              </div>
            );
          })}
          <div><span>คำสั่งซื้อที่ใช้โค้ด</span><span>{nf(d.promo.orders_cur)} <small className="pp-muted">ลดไป {nf(d.promo.discount_cur)} บาท</small></span><span>{nf(d.promo.orders_prev)}</span></div>
        </div>
      </div>

      {d.snapshots.length > 0 && (() => {
        const a = d.snapshots[0], z = d.snapshots[d.snapshots.length - 1];
        return (
          <div className="pp-card">
            <h3>ตัวเลขสะสม</h3>
            <p className="pp-muted small">บันทึกอัตโนมัติทุกคืน 23:55 · {d.snapshots.length < 2 ? "เริ่มเก็บวันนี้ พรุ่งนี้จะเริ่มเห็นการเปลี่ยนแปลง" : `${shortDay(a.day)} → ${shortDay(z.day)}`}</p>
            <div className="pp-guide-table">
              {([["สมาชิกทั้งหมด", "users"], ["สมาชิกที่จ่ายแล้ว", "paid"], ["เลือกวิชาเอกแล้ว", "majors"], ["ข้อสอบในคลัง", "approved"], ["ข้อที่จัดหมวดย่อยแล้ว", "tagged"]] as const).map(([l, k]) => (
                <div key={k}><span>{l}</span><b>{nf(z[k])}{d.snapshots.length > 1 ? <small className="pp-muted"> ({z[k] - a[k] >= 0 ? "+" : ""}{nf(z[k] - a[k])})</small> : null}</b></div>
              ))}
            </div>
          </div>
        );
      })()}

      <MarkEditor marks={d.all_marks} reload={() => rpc<Compare>("prep_admin_compare", { p_days: days, p_mark: mark || null, p_track: track }).then(setD)} />

      <details className="pp-cmp-more" onToggle={e => setMore((e.target as HTMLDetailsElement).open)}>
        <summary>รายละเอียดข้อสอบ: หมวดที่ผิดมาก · ข้อที่หลอกคน · จำลองสอบ</summary>
        {more && <AdminChartDetails />}
      </details>
    </>
  );
}

// Dates of releases, so charts can show a line where something changed. Clearing the text removes a mark.
function MarkEditor({ marks, reload }: { marks: { day: string; label: string }[]; reload: () => Promise<unknown> }) {
  const [day, setDay] = useState("");
  const [label, setLabel] = useState("");
  const [err, setErr] = useState("");
  const save = async (dd: string, ll: string) => {
    try { await rpc("prep_admin_release_mark_set", { p_day: dd, p_label: ll }); setErr(""); setLabel(""); await reload(); } catch (e) { setErr(thaiError(e)); }
  };
  return (
    <details className="pp-cmp-more">
      <summary>จุดบันทึกการออกฟีเจอร์ ({marks.length})</summary>
      <p className="pp-muted small">เส้นตั้งบนกราฟ และตัวเลือก “เทียบก่อน/หลัง” มาจากรายการนี้</p>
      {marks.map(m => <div key={m.day} className="pp-keyrow"><div><b>{dayName(m.day)}</b> · {m.label}</div>
        <button className="pp-link small" onClick={() => confirm(`ลบจุดบันทึกวันที่ ${dayName(m.day)}?`) && save(m.day, "")}>ลบ</button></div>)}
      <div className="pp-row" style={{ gap: 8, flexWrap: "wrap" }}>
        <input className="pp-input" type="date" value={day} onChange={e => setDay(e.target.value)} style={{ flex: "0 0 150px" }} />
        <input className="pp-input" placeholder="เช่น ออกโหมดจับเวลา" maxLength={80} value={label} onChange={e => setLabel(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
        <button className="pp-btn pp-btn-primary" disabled={!day || !label.trim()} onClick={() => save(day, label)}>เพิ่ม</button>
      </div>
      {err && <div className="pp-error">{err}</div>}
    </details>
  );
}
