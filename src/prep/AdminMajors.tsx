import { useEffect, useMemo, useState } from "react";
import { useAdminTrack } from "./adminTrack";
import { rpc, thaiError } from "./api";
import { nf } from "./chartFormat";

type Major = { code: string; name: string; users: number; new_n: number; active: number; answered: number; sets: number; paid: number; revenue: number; top_topics: { name: string; n: number }[] };
type Stats = {
  days: number;
  funnel: { users: number; picked_major: number; answered_10: number; paid: number; active: number; revenue: number };
  majors: Major[];
};
type Key = "users" | "active" | "answered" | "paid" | "conv" | "revenue";
const SORTS: [Key, string][] = [["users", "ผู้ใช้"], ["active", "เข้าใช้"], ["answered", "ตอบข้อ"], ["paid", "ซื้อ"], ["conv", "% ซื้อ"], ["revenue", "รายได้"]];
const conv = (m: Major) => (m.users > 0 ? (100 * m.paid) / m.users : 0);
const val = (m: Major, k: Key) => (k === "conv" ? conv(m) : m[k]);
const pct = (a: number, b: number) => (b > 0 ? Math.round((100 * a) / b) : 0);

// Which majors come in, practise and pay: users per major, activity, answers, buyers, revenue and each major's favourite topics.
export default function AdminMajors() {
  const track = useAdminTrack();
  const [days, setDays] = useState(30);
  const [st, setSt] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<Key>("users");

  useEffect(() => {
    let alive = true;
    rpc<Stats>("prep_admin_major_stats", { p_days: days, p_track: track })
      .then(s => { if (alive) { setSt(s); setError(""); } })
      .catch(e => { if (alive) setError(thaiError(e)); });
    return () => { alive = false; };
  }, [days, track]);

  const rows = useMemo(() => [...(st?.majors ?? [])].sort((a, b) => val(b, sort) - val(a, sort) || b.users - a.users), [st, sort]);
  const max = Math.max(1, ...rows.map(m => val(m, sort)));
  const real = (st?.majors ?? []).filter(m => m.code);
  const best = (k: Key, minUsers = 1) => [...real].filter(m => m.users >= minUsers).sort((a, b) => val(b, k) - val(a, k))[0];
  const hl = st && real.length ? [
    ["เข้าเยอะสุด", best("active"), (m: Major) => `${nf(m.active)} คน`],
    ["ทำข้อสอบเยอะสุด", best("answered"), (m: Major) => `${nf(m.answered)} ข้อ`],
    ["ซื้อมากสุด", best("paid"), (m: Major) => `${nf(m.paid)} คน`],
    ["% ซื้อสูงสุด (ผู้ใช้ ≥ 5)", best("conv", 5), (m: Major) => `${conv(m).toFixed(0)}%`],
  ] as const : [];
  const f = st?.funnel;

  return (
    <>
      <div className="pp-card">
        <h3>วิเคราะห์ผู้ใช้ตามวิชาเอก</h3>
        <div className="pp-seg" role="group" aria-label="ช่วงเวลา">
          {[7, 30, 90].map(d => <button key={d} className={days === d ? "on" : ""} onClick={() => setDays(d)}>{d} วันล่าสุด</button>)}
        </div>
        <p className="pp-muted small">"ผู้ใช้ใหม่" และ "เข้าใช้" นับตามช่วงที่เลือก ส่วนตอบข้อ ชุด ซื้อ และรายได้นับสะสมทั้งหมด</p>
        {error && <div className="pp-error">{error}</div>}
        {!st && !error && <div className="pp-spinner" />}
        {f && (
          <div className="pp-mj-funnel">
            <div><b>{nf(f.users)}</b><span>ผู้ใช้ทั้งหมด</span></div>
            <div><b>{nf(f.picked_major)}</b><span>เลือกเอกแล้ว ({pct(f.picked_major, f.users)}%)</span></div>
            <div><b>{nf(f.active)}</b><span>เข้าใช้ใน {st.days} วัน</span></div>
            <div><b>{nf(f.answered_10)}</b><span>ตอบ ≥ 10 ข้อ ({pct(f.answered_10, f.users)}%)</span></div>
            <div><b>{nf(f.paid)}</b><span>ซื้อแล้ว ({pct(f.paid, f.users)}%)</span></div>
            <div><b>{nf(f.revenue)}</b><span>รายได้ (บาท)</span></div>
          </div>
        )}
        {hl.length > 0 && (
          <ul className="pp-mj-hl">
            {hl.map(([label, m, fmt]) => m && <li key={label}><span className="pp-muted small">{label}</span><b>{m.name}</b> <span className="pp-muted small">{fmt(m)}</span></li>)}
          </ul>
        )}
      </div>

      {st && (
        <div className="pp-card">
          <h3>แต่ละวิชาเอก</h3>
          <div className="pp-seg pp-mj-sort" role="group" aria-label="เรียงตาม">
            {SORTS.map(([k, l]) => <button key={k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{l}</button>)}
          </div>
          {rows.length === 0 && <p className="pp-muted">ยังไม่มีผู้ใช้</p>}
          {rows.map(m => (
            <div key={m.code || "none"} className={`pp-mj-row ${m.code ? "" : "none"}`}>
              <div className="pp-mj-name"><b>{m.name}</b><span className="pp-muted small">{nf(m.users)} คน</span></div>
              <div className="pp-bar thin"><div style={{ width: `${(100 * val(m, sort)) / max}%` }} /></div>
              <div className="pp-mj-grid">
                <span><b>{nf(m.new_n)}</b> ใหม่</span>
                <span><b>{nf(m.active)}</b> เข้าใช้</span>
                <span><b>{nf(m.answered)}</b> ข้อที่ตอบ</span>
                <span><b>{nf(m.sets)}</b> ชุด</span>
                <span><b>{nf(m.paid)}</b> ซื้อ ({conv(m).toFixed(0)}%)</span>
                <span><b>{nf(m.revenue)}</b> บาท</span>
              </div>
              {m.top_topics.length > 0 && (
                <details>
                  <summary className="small pp-muted">ทำข้อสอบอะไรเยอะ</summary>
                  <ol className="pp-mj-topics">{m.top_topics.map(t => <li key={t.name}>{t.name} <span className="pp-muted small">{nf(t.n)} ข้อ</span></li>)}</ol>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
