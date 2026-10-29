import { useCallback, useEffect, useState } from "react";
import { useAdminTrack } from "./adminTrack";
import { rpc, thaiError } from "./api";
import { ColumnChart, Delta, type ChartMark } from "./ChartParts";
import { nf, shortDay } from "./chartFormat";

// The owner's view on the first admin tab: one period picker for everything below, a sentence that says what changed,
// four headline numbers against the previous period, the daily trend with exam dates and Facebook posts marked, the
// pay funnel, results by channel with ad spend, and weekly signup cohorts. Numbers come from prep_admin_overview,
// prep_admin_pay_funnel, prep_admin_channels and prep_admin_cohorts (all filtered by the สพฐ./สอศ. switch).

type Totals = { revenue: number; signups: number; buyers: number };
type Day = { d: string; revenue: number; signups: number; buyers: number; active: number };
type Overview = { n: number; from: string; to: string; cur: Totals; prev: Totals; learners: number; learners_prev: number; series: Day[]; marks: ChartMark[] };
type Funnel = { since: string; events: Record<string, number>; submitted: number; approved: number; wall: { n: number; viewed: number; bought: number } };
type Channel = { src: string; signups: number; buyers: number; revenue: number; spend: number | null };
type Cohort = { week: string; paid: boolean; size: number; active: number[] };
type Spend = { id: number; day: string; src: string; amount: number; note: string | null };

const RANGES = [7, 30, 90] as const;
const pct = (a: number, b: number) => (b ? (100 * a) / b : 0);
const p1 = (x: number) => `${x.toFixed(1)}%`;
const change = (cur: number, prev: number) => (prev ? Math.round((100 * (cur - prev)) / prev) : null);

// One sentence a busy owner can read: the biggest moves first, in plain words.
function headline(o: Overview) {
  const parts: string[] = [];
  const say = (label: string, cur: number, prev: number, unit: string) => {
    const c = change(cur, prev);
    if (c === null) return;
    if (Math.abs(c) < 5) parts.push(`${label}ทรงตัว (${nf(cur)}${unit})`);
    else parts.push(`${label}${c > 0 ? "เพิ่มขึ้น" : "ลดลง"} ${Math.abs(c)}% (${nf(prev)} → ${nf(cur)}${unit})`);
  };
  say("รายได้", o.cur.revenue, o.prev.revenue, " บาท");
  say("ผู้สมัครใหม่", o.cur.signups, o.prev.signups, " คน");
  const cr = pct(o.cur.buyers, o.cur.signups), pr = pct(o.prev.buyers, o.prev.signups);
  if (o.prev.signups && o.cur.signups) parts.push(`อัตราการซื้อ ${p1(cr)} (ก่อนหน้า ${p1(pr)})`);
  if (!parts.length) return `ยังไม่มีข้อมูลช่วง ${o.n} วันก่อนหน้าให้เทียบ · ${o.n} วันนี้รายได้ ${nf(o.cur.revenue)} บาท ผู้สมัคร ${nf(o.cur.signups)} คน`;
  return `${o.n} วันล่าสุดเทียบกับ ${o.n} วันก่อนหน้า: ${parts.join(" · ")}`;
}

function Spark({ values }: { values: number[] }) {
  const W = 120, H = 28, max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * W},${H - 2 - (v / max) * (H - 4)}`).join(" ");
  return <svg className="pp-spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true"><polyline points={pts} /></svg>;
}

function Kpi({ label, value, cur, prev, spark, note }: { label: string; value: string; cur: number; prev: number; spark: number[]; note: string }) {
  return (
    <div className="pp-okpi">
      <span className="pp-okpi-l">{label}</span>
      <b>{value}</b>
      <span className="pp-okpi-d"><Delta cur={cur} prev={prev} /> <span className="pp-muted">จากช่วงก่อน</span></span>
      <Spark values={spark} />
      <span className="pp-muted small">{note}</span>
    </div>
  );
}

const PAY_STEPS: [string, string][] = [
  ["buy_view", "เปิดหน้าซื้อ"], ["pkg_select", "เลือกแพ็กเอง"], ["qr_save", "บันทึกรูป QR"], ["slip_pick", "แนบสลิป"],
  ["submitted", "ส่งสลิปสำเร็จ"], ["approved", "อนุมัติแล้ว"],
];

function Steps({ rows, base }: { rows: { label: string; v: number }[]; base: number }) {
  const top = Math.max(1, ...rows.map(r => r.v));
  return (
    <div className="pp-funnel">
      {rows.map((r, i) => (
        <div key={r.label} className="pp-funnel-row">
          <span>{r.label}</span>
          <span className="pp-funnel-bar"><i style={{ width: `${(100 * r.v) / top}%` }} /></span>
          <b>{nf(r.v)}</b>
          <em>{i === 0 ? "" : `${Math.round(pct(r.v, base))}%`}</em>
        </div>
      ))}
    </div>
  );
}

// Two short funnels whose steps really are nested: the free-limit wall (the same people followed to the buy screen
// and to a purchase), and the buy screen (each step as a share of the people who opened it in the period).
function PayFunnel({ days, track }: { days: number; track: string | null }) {
  const [f, setF] = useState<Funnel | null>(null);
  useEffect(() => { rpc<Funnel>("prep_admin_pay_funnel", { p_days: days, p_track: track }).then(setF).catch(() => setF(null)); }, [days, track]);
  if (!f) return null;
  const val = (k: string) => (k === "submitted" ? f.submitted : k === "approved" ? f.approved : f.events[k] ?? 0);
  const buy = val("buy_view");
  const wallView = pct(f.wall.viewed, f.wall.n), buyToSlip = pct(f.submitted, buy);
  return (
    <div className="pp-card">
      <h3>เส้นทางการซื้อ</h3>
      <p className="pp-headline small">
        ใช้ชุดฟรีครบแล้วไปเปิดหน้าซื้อ <b>{Math.round(wallView)}%</b> · เปิดหน้าซื้อแล้วส่งสลิป <b>{Math.round(buyToSlip)}%</b>
        {" · "}จุดที่หลุดมากกว่าคือ <b>{wallView < buyToSlip ? "หน้าชุดฟรีครบ → หน้าซื้อ" : "หน้าซื้อ → ส่งสลิป"}</b>
      </p>
      <h4>1 · คนที่ใช้ชุดฟรีครบ (คนกลุ่มเดียวกัน)</h4>
      <Steps base={f.wall.n} rows={[{ label: "ใช้ชุดฟรีครบ", v: f.wall.n }, { label: "เปิดหน้าซื้อต่อ", v: f.wall.viewed }, { label: "ซื้อแล้ว", v: f.wall.bought }]} />
      <h4>2 · หน้าซื้อ (% ของคนที่เปิดหน้าซื้อ)</h4>
      <Steps base={buy} rows={PAY_STEPS.map(([k, label]) => ({ label, v: val(k) }))} />
      <p className="pp-muted small">
        นับคน ไม่นับครั้ง{(f.events.slip_fail ?? 0) > 0 ? ` · ส่งสลิปไม่สำเร็จ ${f.events.slip_fail} คน` : ""}
        {" · "}ขั้นเลือกแพ็ก บันทึก QR แนบสลิป เริ่มเก็บ 29 ต.ค. 2569 ช่วงแรกจึงต่ำกว่าความจริง
      </p>
    </div>
  );
}

function Channels({ days, track }: { days: number; track: string | null }) {
  const [rows, setRows] = useState<Channel[] | null>(null);
  const [spends, setSpends] = useState<Spend[]>([]);
  const [form, setForm] = useState({ day: new Date().toISOString().slice(0, 10), src: "", amount: "", note: "" });
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    rpc<Channel[]>("prep_admin_channels", { p_days: days, p_track: track }).then(setRows).catch(e => setErr(thaiError(e)));
    rpc<Spend[]>("prep_admin_ad_spend_list").then(setSpends).catch(() => setSpends([]));
  }, [days, track]);
  useEffect(load, [load]);
  const save = async () => {
    setErr("");
    if (!/^[a-z0-9_-]{1,40}$/.test(form.src.trim().toLowerCase()) || !Number(form.amount)) { setErr("ใส่ช่องทาง (ค่า src ในลิงก์ เช่น fb-ad2) และยอดเงิน"); return; }
    try {
      await rpc("prep_admin_ad_spend_save", { p_day: form.day, p_src: form.src.trim().toLowerCase(), p_amount: Number(form.amount), p_note: form.note || null });
      setForm(f => ({ ...f, amount: "", note: "" })); load();
    } catch (e) { setErr(thaiError(e)); }
  };
  const remove = async (id: number) => { try { await rpc("prep_admin_ad_spend_delete", { p_id: id }); load(); } catch (e) { setErr(thaiError(e)); } };
  if (!rows) return err ? <div className="pp-error">{err}</div> : null;
  const total = rows.reduce((a, r) => ({ s: a.s + r.signups, b: a.b + r.buyers, rev: a.rev + r.revenue, sp: a.sp + (r.spend ?? 0) }), { s: 0, b: 0, rev: 0, sp: 0 });
  return (
    <div className="pp-card">
      <h3>ตามช่องทาง</h3>
      <p className="pp-muted small">ผู้สมัครในช่วงนี้ แยกตาม <code>?src=</code> ของลิงก์ที่เข้ามาครั้งแรก · รายได้ = ยอดซื้อในแอปของคนกลุ่มนั้นทั้งหมด · ต้นทุนต่อผู้ซื้อ = ค่าโฆษณา ÷ ผู้ซื้อ</p>
      <div className="pp-otable-wrap">
        <table className="pp-otable">
          <thead><tr><th>ช่องทาง</th><th>สมัคร</th><th>ซื้อ</th><th>อัตรา</th><th>รายได้</th><th>ค่าโฆษณา</th><th>ต้นทุน/ผู้ซื้อ</th><th>คืนทุน</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.src}>
                <td>{r.src}</td><td>{nf(r.signups)}</td><td>{nf(r.buyers)}</td>
                <td>{r.signups ? p1(pct(r.buyers, r.signups)) : "–"}</td>
                <td>{nf(r.revenue)}</td>
                <td>{r.spend ? nf(r.spend) : "–"}</td>
                <td>{r.spend ? (r.buyers ? nf(Math.round(r.spend / r.buyers)) : "ยังไม่มีผู้ซื้อ") : "–"}</td>
                <td>{r.spend ? `${(r.revenue / r.spend).toFixed(1)} เท่า` : "–"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td>รวม</td><td>{nf(total.s)}</td><td>{nf(total.b)}</td><td>{total.s ? p1(pct(total.b, total.s)) : "–"}</td><td>{nf(total.rev)}</td><td>{total.sp ? nf(total.sp) : "–"}</td><td>{total.sp && total.b ? nf(Math.round(total.sp / total.b)) : "–"}</td><td>{total.sp ? `${(total.rev / total.sp).toFixed(1)} เท่า` : "–"}</td></tr></tfoot>
        </table>
      </div>
      <details className="pp-spend">
        <summary>บันทึกค่าโฆษณา ({spends.length} รายการ)</summary>
        <div className="pp-spend-form">
          <input className="pp-input" type="date" value={form.day} onChange={e => setForm({ ...form, day: e.target.value })} aria-label="วันที่จ่าย" />
          <input className="pp-input" list="pp-src-list" placeholder="ช่องทาง เช่น fb-ad2" value={form.src} onChange={e => setForm({ ...form, src: e.target.value })} aria-label="ช่องทาง" />
          <datalist id="pp-src-list">{rows.filter(r => r.src !== "(ไม่ทราบ)").map(r => <option key={r.src} value={r.src} />)}</datalist>
          <input className="pp-input" inputMode="numeric" placeholder="ยอด (บาท)" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value.replace(/\D/g, "") })} aria-label="ยอดเงิน" />
          <input className="pp-input" placeholder="หมายเหตุ (ไม่บังคับ)" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} aria-label="หมายเหตุ" />
          <button className="pp-btn pp-btn-primary" onClick={save}>บันทึก</button>
        </div>
        {err && <div className="pp-error">{err}</div>}
        {spends.map(s => (
          <div key={s.id} className="pp-keyrow"><div>{shortDay(s.day)} · <b>{s.src}</b> · {nf(s.amount)} บาท{s.note ? <span className="pp-muted small"> · {s.note}</span> : null}</div>
            <button className="pp-link small" onClick={() => remove(s.id)}>ลบ</button></div>
        ))}
      </details>
    </div>
  );
}

// Share of each signup week active (answered ≥ 1) in each later week; buyers and free users on separate rows.
function Cohorts({ track }: { track: string | null }) {
  const [rows, setRows] = useState<Cohort[] | null>(null);
  useEffect(() => { rpc<Cohort[]>("prep_admin_cohorts", { p_weeks: 8, p_track: track }).then(setRows).catch(() => setRows(null)); }, [track]);
  if (!rows?.length) return null;
  const cols = Math.max(...rows.map(r => r.active.length));
  return (
    <div className="pp-card">
      <h3>ผู้ใช้รุ่นต่อรุ่น (กลับมาใช้รายสัปดาห์)</h3>
      <p className="pp-muted small">แต่ละแถว = คนที่สมัครสัปดาห์นั้น · ช่อง = % ที่ทำข้อสอบอย่างน้อย 1 ข้อในสัปดาห์ที่ 0, 1, 2… หลังสมัคร · สีเข้ม = กลับมามาก</p>
      <div className="pp-otable-wrap">
        <table className="pp-otable pp-cohort">
          <thead><tr><th>สมัครสัปดาห์</th><th>กลุ่ม</th><th>คน</th>{Array.from({ length: cols }, (_, i) => <th key={i}>ส.{i}</th>)}</tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.week + r.paid}>
                <td>{shortDay(r.week)}</td><td>{r.paid ? "ผู้ซื้อ" : "ฟรี"}</td><td>{nf(r.size)}</td>
                {Array.from({ length: cols }, (_, i) => {
                  if (i >= r.active.length) return <td key={i} />;
                  const v = Math.round(pct(r.active[i], r.size));
                  return <td key={i} className={`pp-heat ${v >= 50 ? "dark" : ""}`} style={{ ["--a" as string]: Math.max(0.06, v / 100) }} title={`${r.active[i]} จาก ${r.size} คน`}>{v}%</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminOverview() {
  const track = useAdminTrack();
  const [days, setDays] = useState<number>(() => { try { return Number(localStorage.getItem("pp-admin-days")) || 7; } catch { return 7; } });
  // The answer is kept with the period it was asked for, so switching periods shows the spinner, not old numbers.
  const key = `${days}|${track}`;
  const [res, setRes] = useState<{ key: string; data: Overview } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    rpc<Overview>("prep_admin_overview", { p_days: days, p_track: track }).then(data => setRes({ key, data })).catch(e => setErr(thaiError(e)));
  }, [days, track, key]);
  const o = res?.key === key ? res.data : null;
  const pick = (n: number) => { setDays(n); try { localStorage.setItem("pp-admin-days", String(n)); } catch { /* per device */ } };
  const s = o?.series ?? [];
  const col = (k: keyof Day) => s.map(x => Number(x[k]));
  return (
    <>
      <div className="pp-seg pp-seg-sub pp-orange" role="radiogroup" aria-label="ช่วงเวลา">
        {RANGES.map(n => <button key={n} role="radio" aria-checked={days === n} className={days === n ? "on" : ""} onClick={() => pick(n)}>{n} วัน</button>)}
      </div>
      {err && <div className="pp-error">{err}</div>}
      {!o && !err && <div className="pp-spinner" />}
      {o && (
        <>
          <p className="pp-headline">{headline(o)}</p>
          <div className="pp-okpis">
            <Kpi label="รายได้" value={`${nf(o.cur.revenue)} บาท`} cur={o.cur.revenue} prev={o.prev.revenue} spark={col("revenue")} note="คำสั่งซื้อในแอป + คีย์ LINE" />
            <Kpi label="ผู้สมัครใหม่" value={`${nf(o.cur.signups)} คน`} cur={o.cur.signups} prev={o.prev.signups} spark={col("signups")} note="บัญชีใหม่" />
            <Kpi label="อัตราการซื้อ" value={p1(pct(o.cur.buyers, o.cur.signups))} cur={pct(o.cur.buyers, o.cur.signups)} prev={pct(o.prev.buyers, o.prev.signups)} spark={col("buyers")}
              note={`ผู้ซื้อใหม่ ${nf(o.cur.buyers)} ÷ ผู้สมัครใหม่`} />
            <Kpi label="ผู้เรียนที่ใช้งาน" value={`${nf(o.learners)} คน`} cur={o.learners} prev={o.learners_prev} spark={col("active")} note="ทำ ≥ 10 ข้อในช่วงนี้" />
          </div>
          <div className="pp-card pp-chart-grid">
            <ColumnChart title="รายได้รายวัน" unit="บาท" days={s.map(x => x.d)} values={col("revenue")} marks={o.marks} />
            <ColumnChart title="ผู้สมัครใหม่รายวัน" unit="คน" days={s.map(x => x.d)} values={col("signups")} marks={o.marks.filter(m => m.kind !== "post")} />
          </div>
        </>
      )}
      <PayFunnel days={days} track={track} />
      <Channels days={days} track={track} />
      <Cohorts track={track} />
    </>
  );
}
