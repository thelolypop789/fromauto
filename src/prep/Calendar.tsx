import { useEffect, useMemo, useState } from "react";
import { rpc, thaiError } from "./api";
import { DOW, KIND_LABEL, MONTHS, bkkToday, pad, status, when, type CalEvent } from "./calendarUtil";
import "./calendar.css";

// Page for signed-in users. Top: every coming date with its details, in order. Below: a month grid; tap a day to read what is on it.
export default function Calendar({ onBack }: { onBack: () => void }) {
  const today = bkkToday();
  const [events, setEvents] = useState<CalEvent[] | null>(null);
  const [error, setError] = useState("");
  const [ym, setYm] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => { rpc<CalEvent[]>("prep_exam_calendar").then(setEvents).catch(e => setError(thaiError(e))); }, []);

  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const lead = new Date(ym.y, ym.m, 1).getDay();
  const upcoming = useMemo(() => (events ?? []).filter(e => (e.ends_on ?? e.starts_on) >= today), [events, today]);
  const past = useMemo(() => (events ?? []).filter(e => (e.ends_on ?? e.starts_on) < today).reverse(), [events, today]);
  const onDay = (iso: string) => (events ?? []).filter(e => e.starts_on <= iso && (e.ends_on ?? e.starts_on) >= iso);
  const move = (delta: number) => { setPicked(null); setYm(p => { const t = new Date(p.y, p.m + delta, 1); return { y: t.getFullYear(), m: t.getMonth() }; }); };
  const dayEvents = picked ? onDay(picked) : [];

  return (
    <>
      <button className="pp-link" onClick={onBack}>‹ กลับ</button>
      {error && <div className="pp-error">{error}</div>}
      {!events && !error && <div className="pp-spinner" />}
      {events && (
        <>
          <div className="pp-card">
            <h2>กำหนดการสอบ</h2>
            <p className="pp-muted small">เรียงตามวันที่ กำหนดการที่เขียนว่า “ภายในวันที่” คือวันสุดท้ายที่ต้องประกาศ อาจประกาศก่อนหน้านั้น ตรวจประกาศฉบับจริงของ สพฐ./เขตพื้นที่ก่อนตัดสินใจเสมอ</p>
            {upcoming.length === 0 && <p className="pp-muted small">ยังไม่มีกำหนดการที่กำลังมาถึง ทีมงานจะอัปเดตที่นี่เมื่อมีประกาศ</p>}
            {upcoming.map(e => <EventRow key={e.id} e={e} today={today} />)}
            {past.length > 0 && (
              <details className="pp-cal-past">
                <summary className="small pp-muted">ที่ผ่านมาแล้ว ({past.length})</summary>
                {past.map(e => <EventRow key={e.id} e={e} today={today} />)}
              </details>
            )}
          </div>

          <div className="pp-card">
            <h3>ดูเป็นรายเดือน</h3>
            <div className="pp-cal-head">
              <button className="pp-btn pp-btn-ghost" onClick={() => move(-1)} aria-label="เดือนก่อน">‹</button>
              <b>{MONTHS[ym.m]} {ym.y + 543}</b>
              <button className="pp-btn pp-btn-ghost" onClick={() => move(1)} aria-label="เดือนถัดไป">›</button>
            </div>
            <div className="pp-cal-grid" role="grid" aria-label={`${MONTHS[ym.m]} ${ym.y + 543}`}>
              {DOW.map(d => <div key={d} className="pp-cal-dow">{d}</div>)}
              {Array.from({ length: lead }, (_, i) => <div key={`o${i}`} className="pp-cal-day out" />)}
              {Array.from({ length: days }, (_, i) => {
                const iso = `${ym.y}-${pad(ym.m + 1)}-${pad(i + 1)}`;
                const evs = onDay(iso);
                const kinds = [...new Set(evs.map(e => e.kind))];
                return (
                  <button key={i} className={`pp-cal-day ${evs.length ? "has" : ""} ${iso === today ? "today" : ""} ${iso === picked ? "sel" : ""}`}
                    onClick={() => setPicked(iso === picked ? null : iso)}
                    aria-label={evs.length ? `${i + 1}: ${evs.map(e => `${KIND_LABEL[e.kind]} ${e.title}`).join(", ")}` : `${i + 1}`}>
                    {i + 1}
                    {kinds.length > 0 && <i>{kinds.map(k => <s key={k} className={k} />)}</i>}
                  </button>
                );
              })}
            </div>
            <div className="pp-cal-legend"><span><s />วันสอบ</span><span><s className="apply" />รับสมัคร</span><span><s className="result" />ประกาศผล</span><span><s className="other" />อื่น ๆ</span></div>
            {picked && (
              <div className="pp-upnext">
                {dayEvents.length === 0 ? <span className="pp-muted">ไม่มีกำหนดการในวันที่เลือก</span> : dayEvents.map(e => <EventRow key={e.id} e={e} today={today} />)}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

// One date, with everything students need: what it is, when, how long to go, details and the official link.
export function EventRow({ e, today }: { e: CalEvent; today: string }) {
  const done = (e.ends_on ?? e.starts_on) < today;
  const d = new Date(e.starts_on + "T00:00:00");
  return (
    <div className={`pp-event pp-event-row ${done ? "past" : ""}`}>
      <div className={`pp-event-date ${e.kind}`}>
        <b>{d.getDate()}</b><span>{d.toLocaleDateString("th-TH", { month: "short" })}</span>
      </div>
      <div className="pp-event-body">
        <div className="pp-event-top"><span className={`pp-kind ${e.kind}`}>{KIND_LABEL[e.kind]}</span><span className="pp-event-st">{status(e, today)}</span></div>
        <b className="pp-event-title">{e.title}</b>
        <div className="pp-event-when">{when(e)}</div>
        {e.note && <div className="pp-event-note">{e.note}</div>}
        {e.link && <a className="pp-link small" href={e.link} target="_blank" rel="noopener noreferrer">เปิดเว็บ/ประกาศทางการ ›</a>}
      </div>
    </div>
  );
}
