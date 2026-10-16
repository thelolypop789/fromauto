import { useEffect, useMemo, useState } from "react";
import { rpc, thaiError } from "./api";
import { DOW, KIND_LABEL, MONTHS, bkkToday, pad, status, when, type CalEvent } from "./calendarUtil";
import "./calendar.css";

// Public page for signed-in users: month grid with markers, and the events of that month underneath.
export default function Calendar({ onBack }: { onBack: () => void }) {
  const today = bkkToday();
  const [events, setEvents] = useState<CalEvent[] | null>(null);
  const [error, setError] = useState("");
  const [ym, setYm] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  useEffect(() => { rpc<CalEvent[]>("prep_exam_calendar").then(setEvents).catch(e => setError(thaiError(e))); }, []);

  const first = `${ym.y}-${pad(ym.m + 1)}-01`;
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const lead = new Date(ym.y, ym.m, 1).getDay();
  const last = `${ym.y}-${pad(ym.m + 1)}-${pad(days)}`;
  const inMonth = useMemo(() => (events ?? []).filter(e => e.starts_on <= last && (e.ends_on ?? e.starts_on) >= first), [events, first, last]);
  const upcoming = useMemo(() => (events ?? []).filter(e => (e.ends_on ?? e.starts_on) >= today).slice(0, 4), [events, today]);
  const on = (d: number) => { const iso = `${ym.y}-${pad(ym.m + 1)}-${pad(d)}`; return (events ?? []).filter(e => e.starts_on <= iso && (e.ends_on ?? e.starts_on) >= iso); };
  const move = (delta: number) => setYm(p => { const t = new Date(p.y, p.m + delta, 1); return { y: t.getFullYear(), m: t.getMonth() }; });

  return (
    <>
      <button className="pp-link" onClick={onBack}>‹ กลับ</button>
      <div className="pp-card">
        <h2>ปฏิทินสอบ</h2>
        {error && <div className="pp-error">{error}</div>}
        {!events && !error && <div className="pp-spinner" />}
        {events && (
          <>
            <div className="pp-cal-head">
              <button className="pp-btn pp-btn-ghost" onClick={() => move(-1)} aria-label="เดือนก่อน">‹</button>
              <b>{MONTHS[ym.m]} {ym.y + 543}</b>
              <button className="pp-btn pp-btn-ghost" onClick={() => move(1)} aria-label="เดือนถัดไป">›</button>
            </div>
            <div className="pp-cal-grid" role="grid" aria-label={`${MONTHS[ym.m]} ${ym.y + 543}`}>
              {DOW.map(d => <div key={d} className="pp-cal-dow">{d}</div>)}
              {Array.from({ length: lead }, (_, i) => <div key={`o${i}`} className="pp-cal-day out" />)}
              {Array.from({ length: days }, (_, i) => {
                const evs = on(i + 1);
                const iso = `${ym.y}-${pad(ym.m + 1)}-${pad(i + 1)}`;
                const kinds = [...new Set(evs.map(e => e.kind))];
                return (
                  <div key={i} className={`pp-cal-day ${evs.length ? "has" : ""} ${iso === today ? "today" : ""}`}
                    aria-label={evs.length ? `${i + 1}: ${evs.map(e => `${KIND_LABEL[e.kind]} ${e.title}`).join(", ")}` : undefined}>
                    {i + 1}
                    {kinds.length > 0 && <i>{kinds.map(k => <s key={k} className={k} />)}</i>}
                  </div>
                );
              })}
            </div>
            <div className="pp-cal-legend"><span><s />วันสอบ</span><span><s className="apply" />รับสมัคร</span><span><s className="result" />ประกาศผล</span><span><s className="other" />อื่น ๆ</span></div>
          </>
        )}
      </div>

      {events && (
        <div className="pp-card">
          <h3>กำหนดการเดือน{MONTHS[ym.m]}</h3>
          {inMonth.length === 0 && <p className="pp-muted small">ไม่มีกำหนดการในเดือนนี้</p>}
          {inMonth.map(e => <EventRow key={e.id} e={e} today={today} />)}
          {upcoming.length > 0 && inMonth.length === 0 && (
            <div className="pp-upnext"><b>ที่กำลังจะมาถึง</b>{upcoming.map(e => <EventRow key={e.id} e={e} today={today} />)}</div>
          )}
          {events.length === 0 && <p className="pp-muted small">ทีมงานจะอัปเดตวันรับสมัครและวันสอบที่นี่เมื่อมีประกาศ</p>}
        </div>
      )}
    </>
  );
}

export function EventRow({ e, today }: { e: CalEvent; today: string }) {
  const past = (e.ends_on ?? e.starts_on) < today;
  return (
    <div className={`pp-event ${past ? "past" : ""}`}>
      <div className="pp-event-top"><span className={`pp-kind ${e.kind}`}>{KIND_LABEL[e.kind]}</span><b>{e.title}</b></div>
      <div className="pp-event-when">{when(e)} · {status(e, today)}</div>
      {e.note && <div className="small">{e.note}</div>}
      {e.link && <a className="pp-link small" href={e.link} target="_blank" rel="noopener noreferrer">ดูประกาศ</a>}
    </div>
  );
}
