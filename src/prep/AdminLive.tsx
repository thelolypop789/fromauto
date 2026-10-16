import { useCallback, useEffect, useState } from "react";
import { rpc, thaiError } from "./api";
import { ColumnChart } from "./ChartParts";
import { nf } from "./chartFormat";

type Live = {
  now: string; online_now: number; online_15m: number; rounds_in_progress: number; rounds_last_hour: number; signups_today: number;
  peak_today: { users: number; at: string } | null;
  users24: { t: string; users: number }[];
  rounds24: { t: string; rounds: number }[];
};
const hm = (iso: string) => new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
const REFRESH_MS = 15_000;

// "Right now" tab: refreshes every 15 s while the tab is visible. Counts signed-in people only (the app pings once a minute).
export default function AdminLive() {
  const [d, setD] = useState<Live | null>(null);
  const [error, setError] = useState("");
  const [at, setAt] = useState<string>("");
  const load = useCallback(() => {
    rpc<Live>("prep_admin_live").then(r => { setD(r); setAt(r.now); setError(""); }).catch(e => setError(thaiError(e)));
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(() => { if (document.visibilityState === "visible") load(); }, REFRESH_MS);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  if (error && !d) return <div className="pp-error">{error}</div>;
  if (!d) return <div className="pp-spinner" />;
  return (
    <>
      <div className="pp-card">
        <h3><span className="pp-live-dot" aria-hidden="true" /> ตอนนี้ <span className="pp-muted small">อัปเดตทุก 15 วินาที · {hm(at)}</span></h3>
        <div className="pp-kpis">
          <div className="pp-kpi"><b>{nf(d.online_now)}</b><span>ออนไลน์ตอนนี้</span></div>
          <div className="pp-kpi"><b>{nf(d.online_15m)}</b><span>ใน 15 นาที</span></div>
          <div className="pp-kpi"><b>{nf(d.rounds_in_progress)}</b><span>กำลังทำข้อสอบ</span></div>
          <div className="pp-kpi"><b>{nf(d.rounds_last_hour)}</b><span>ทำจบใน 1 ชม.</span></div>
          <div className="pp-kpi"><b>{nf(d.signups_today)}</b><span>สมัครใหม่วันนี้</span></div>
          <div className="pp-kpi"><b>{d.peak_today ? nf(d.peak_today.users) : "–"}</b><span>{d.peak_today ? `สูงสุดวันนี้ (${hm(d.peak_today.at)})` : "สูงสุดวันนี้"}</span></div>
        </div>
        {error && <div className="pp-error">{error}</div>}
        <p className="pp-muted small">นับเฉพาะคนที่ล็อกอินและเปิดแอปค้างไว้ (แอปส่งสัญญาณทุก 1 นาที) ผู้เข้าชมที่ยังไม่ล็อกอินไม่ถูกนับ “ออนไลน์” = มีสัญญาณใน 2 นาทีที่ผ่านมา</p>
      </div>
      <div className="pp-card">
        <h3>24 ชั่วโมงที่ผ่านมา</h3>
        <ColumnChart title="คนออนไลน์ (ทุก 10 นาที)" unit="คน" headNote={`สูงสุด ${nf(Math.max(0, ...d.users24.map(x => x.users)))} คน`} days={d.users24.map(x => x.t)} values={d.users24.map(x => x.users)} format={hm} />
        <ColumnChart title="ข้อสอบที่ทำจบ (รายชั่วโมง)" unit="ชุด" days={d.rounds24.map(x => x.t)} values={d.rounds24.map(x => x.rounds)} format={hm} />
        <p className="pp-muted small">ช่วงที่ยังไม่เปิดระบบเก็บข้อมูล กราฟจะเป็น 0</p>
      </div>
    </>
  );
}
