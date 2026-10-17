import { useEffect, useMemo, useState } from "react";
import { rpc, thaiError } from "./api";

type Stats = {
  days: number; days_with_data: number; first_day: string | null; active_users: number;
  by_hour: { h: number; people: number }[];
  by_dow: { dow: number; people: number }[];
  grid: { dow: number; h: number; people: number }[];
  segments: { paid: { h: number; n: number }[]; free: { h: number; n: number }[] };
  majors: { name: string; users: number; peak_h: number; evening_pct: number }[];
};
const DOW = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];
const DOW_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const BANDS: { label: string; from: number; to: number }[] = [
  { label: "ดึก 00:00–05:00", from: 0, to: 5 }, { label: "เช้ามืด 05:00–08:00", from: 5, to: 8 }, { label: "เช้า 08:00–12:00", from: 8, to: 12 },
  { label: "เที่ยง–บ่าย 12:00–17:00", from: 12, to: 17 }, { label: "เย็น 17:00–20:00", from: 17, to: 20 }, { label: "ค่ำ 20:00–24:00", from: 20, to: 24 },
];
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
const range = (h: number) => `${hh(h)}–${hh((h + 1) % 24)}`;
const f1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString("th-TH");
const peakOf = (rows: { h: number; n: number }[]) => rows.reduce((b, r) => (r.n > b.n ? r : b), { h: -1, n: 0 }).h;

// When people use the app (Thai time, from the once-a-minute "I am here" ping): plain-language summary first, then bands, hours and a day x hour map.
export default function AdminTimes() {
  const [days, setDays] = useState(14);
  const [st, setSt] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [tip, setTip] = useState("");

  useEffect(() => {
    let alive = true;
    rpc<Stats>("prep_admin_time_stats", { p_days: days })
      .then(s => { if (alive) { setSt(s); setError(""); } })
      .catch(e => { if (alive) setError(thaiError(e)); });
    return () => { alive = false; };
  }, [days]);

  const v = useMemo(() => {
    if (!st) return null;
    const total = st.by_hour.reduce((a, r) => a + r.people, 0);
    const bands = BANDS.map(b => {
      const sum = st.by_hour.filter(r => r.h >= b.from && r.h < b.to).reduce((a, r) => a + r.people, 0);
      return { ...b, sum, share: total > 0 ? (100 * sum) / total : 0, avg: sum / (b.to - b.from) };
    });
    const topBand = bands.reduce((a, b) => (b.share > a.share ? b : a), bands[0]);
    const hours = [...st.by_hour].sort((a, b) => b.people - a.people);
    const peakH = hours[0];
    const bestDow = [...st.by_dow].sort((a, b) => b.people - a.people)[0];
    const maxHour = Math.max(0.01, ...st.by_hour.map(r => r.people));
    const maxCell = Math.max(0.01, ...st.grid.map(g => g.people));
    const cell = new Map(st.grid.map(g => [g.dow * 24 + g.h, g.people]));
    return { total, bands, topBand, hours, peakH, bestDow, maxHour, maxCell, cell, maxBand: Math.max(1, ...bands.map(b => b.share)) };
  }, [st]);

  const empty = st && st.active_users === 0;
  return (
    <>
      <div className="pp-card">
        <h3>ช่วงเวลาที่คนเข้าใช้</h3>
        <div className="pp-seg" role="group" aria-label="ช่วงเวลา">
          {[7, 14, 30, 90].map(d => <button key={d} className={days === d ? "on" : ""} onClick={() => setDays(d)}>{d} วัน</button>)}
        </div>
        {error && <div className="pp-error">{error}</div>}
        {!st && !error && <div className="pp-spinner" />}
        {empty && <p className="pp-muted">ยังไม่มีข้อมูลการเข้าใช้ในช่วงนี้</p>}
        {st && !empty && v && (
          <>
            {st.days_with_data < 7 && (
              <div className="pp-ai-an small">มีข้อมูลแค่ {st.days_with_data} วัน (เริ่มเก็บ {st.first_day}) ยังสรุปรูปแบบรายสัปดาห์ไม่ได้แน่นอน ยิ่งผ่านไปหลายวันตัวเลขยิ่งแม่น</div>
            )}
            <div className="pp-tm-sum">
              <div><span className="pp-muted small">ช่วงที่คนเข้าเยอะสุด</span><b>{range(v.peakH.h)} น.</b><span className="pp-muted small">เฉลี่ย {f1(v.peakH.people)} คนต่อชั่วโมง</span></div>
              <div><span className="pp-muted small">ช่วงของวันที่เข้าเยอะสุด</span><b>{v.topBand.label.split(" ")[0]}</b><span className="pp-muted small">{Math.round(v.topBand.share)}% ของการใช้งานทั้งหมด</span></div>
              <div><span className="pp-muted small">วันที่เข้าเยอะสุด</span><b>{DOW[v.bestDow.dow]}</b><span className="pp-muted small">เฉลี่ย {f1(v.bestDow.people)} คนต่อวัน</span></div>
            </div>
            <div className="pp-ai-human small">
              💡 <b>ใช้ตัดสินใจ:</b> ตั้งโพสต์เพจและเปิดแอดให้ขึ้นก่อนช่วงพีคประมาณ 1 ชั่วโมง คือราว <b>{hh((v.peakH.h + 23) % 24)} น.</b> และส่งแจ้งเตือนหรือข้อความ LINE ช่วง <b>{range(v.peakH.h)} น.</b>
            </div>
            <p className="pp-muted small">คนที่เข้าไม่ซ้ำกันในช่วงที่เลือก {st.active_users.toLocaleString("th-TH")} คน · เวลาไทย · ตัวเลข "คน" คือเฉลี่ยจำนวนคนที่เปิดแอปในชั่วโมงนั้นต่อวัน</p>
          </>
        )}
      </div>

      {st && !empty && v && (
        <>
          <div className="pp-card">
            <h3>แบ่งตามช่วงของวัน</h3>
            {v.bands.map(b => (
              <div key={b.label} className={`pp-tm-band ${b === v.topBand ? "top" : ""}`}>
                <div className="pp-tm-bandh"><span>{b.label}</span><b>{Math.round(b.share)}%</b></div>
                <div className="pp-bar thin"><div style={{ width: `${(100 * b.share) / v.maxBand}%` }} /></div>
              </div>
            ))}
          </div>

          <div className="pp-card">
            <h3>รายชั่วโมง</h3>
            <p className="pp-muted small">แตะแท่งเพื่อดูตัวเลข แท่งสีทองคือชั่วโมงที่คนเข้าเยอะสุด</p>
            <div className="pp-tm-cols" role="img" aria-label="จำนวนคนเฉลี่ยรายชั่วโมง">
              {st.by_hour.map(r => (
                <button key={r.h} type="button" className={`pp-tm-col ${r.h === v.peakH.h ? "peak" : ""}`} onClick={() => setTip(`${range(r.h)} น. · เฉลี่ย ${f1(r.people)} คน`)} aria-label={`${range(r.h)} ${f1(r.people)} คน`}>
                  <i style={{ height: `${Math.max(3, (100 * r.people) / v.maxHour)}%` }} />
                  <span>{r.h % 3 === 0 ? String(r.h).padStart(2, "0") : ""}</span>
                </button>
              ))}
            </div>
            <div className="pp-tm-tip">{tip || "แตะแท่งเพื่อดูรายละเอียด"}</div>
          </div>

          <div className="pp-card">
            <h3>วันไหน ชั่วโมงไหน</h3>
            <p className="pp-muted small">ยิ่งเข้มยิ่งมีคนเข้าเยอะ แตะช่องเพื่อดูตัวเลข</p>
            <div className="pp-tm-heat">
              <div className="pp-tm-row"><div className="pp-tm-dl" />
                {Array.from({ length: 24 }, (_, h) => <div key={h} className="pp-tm-hl">{h % 6 === 0 ? String(h).padStart(2, "0") : ""}</div>)}</div>
              {DOW_SHORT.map((d, dow) => (
                <div key={d} className="pp-tm-row">
                  <div className="pp-tm-dl">{d}</div>
                  {Array.from({ length: 24 }, (_, h) => {
                    const p = v.cell.get(dow * 24 + h) ?? 0;
                    return <button key={h} type="button" className="pp-tm-cell" style={{ background: p > 0 ? `rgba(142,27,46,${0.1 + 0.9 * (p / v.maxCell)})` : undefined }}
                      onClick={() => setTip(`${DOW[dow]} ${range(h)} น. · เฉลี่ย ${f1(p)} คน`)} aria-label={`${DOW[dow]} ${range(h)} ${f1(p)} คน`} />;
                  })}
                </div>
              ))}
            </div>
            <div className="pp-tm-tip">{tip || "แตะช่องเพื่อดูรายละเอียด"}</div>
          </div>

          <div className="pp-card">
            <h3>แยกตามกลุ่ม</h3>
            <p className="pp-muted small">ช่วงที่เข้าเยอะสุดของแต่ละกลุ่ม และสัดส่วนที่ใช้หลัง 18:00 น.</p>
            <div className="pp-tm-seg">
              <div><span className="pp-muted small">คนที่ซื้อแล้ว</span><b>{st.segments.paid.length ? range(peakOf(st.segments.paid)) + " น." : "ยังไม่มีข้อมูล"}</b></div>
              <div><span className="pp-muted small">ยังใช้ฟรี</span><b>{st.segments.free.length ? range(peakOf(st.segments.free)) + " น." : "ยังไม่มีข้อมูล"}</b></div>
            </div>
            {st.majors.length === 0 && <p className="pp-muted small">ยังไม่มีวิชาเอกที่มีผู้ใช้ตั้งแต่ 3 คน</p>}
            {st.majors.map(m => (
              <div key={m.name} className="pp-keyrow">
                <div><b>{m.name}</b><div className="pp-muted small">{m.users} คน</div></div>
                <div className="pp-tm-mj"><b>{range(m.peak_h)} น.</b><span className="pp-muted small">หลัง 18:00 {m.evening_pct}%</span></div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
