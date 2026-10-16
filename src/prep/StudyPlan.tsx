import { useEffect, useState } from "react";
import { rpc, thaiError } from "./api";
import { SHOP } from "./config";
import { KIND_LABEL, bkkToday, full, status, when, type CalEvent } from "./calendarUtil";
import { IconCalendar } from "./icons";

type Plan = { exam_title: string | null; exam_date: string | null; daily_goal: number; days_left: number | null; answered_today: number; streak: number };
const GOALS = [20, 40, 60, 100, 150];

// Countdown to the next exam day the team published, today's goal, streak, and the next calendar item.
// answeredToday comes from prep_me (refreshed after every round), the rest from prep_plan / prep_exam_calendar.
export default function StudyPlan({ answeredToday, onCalendar }: { answeredToday: number; onCalendar: () => void }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [soon, setSoon] = useState<CalEvent[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [goal, setGoal] = useState(40);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    rpc<Plan>("prep_plan").then(setPlan).catch(() => { /* cards hide themselves */ });
    rpc<CalEvent[]>("prep_exam_calendar").then(list => {
      const today = bkkToday();
      setSoon(list.filter(e => (e.ends_on ?? e.starts_on) >= today).slice(0, 4));
    }).catch(() => setSoon([]));
  }, []);
  if (!plan) return null;

  const save = async () => {
    setBusy(true); setErr("");
    try { setPlan(await rpc<Plan>("prep_set_goal", { p_goal: goal })); setEditing(false); }
    catch (e) { setErr(thaiError(e)); }
    setBusy(false);
  };

  const today = bkkToday();
  const done = Math.min(answeredToday, plan.daily_goal);
  const reached = answeredToday >= plan.daily_goal;
  const list = (soon ?? []).slice(0, 3);
  return (
    <>
      <section className="pp-examcard" aria-label="ปฏิทินสอบ">
        <div className="pp-examcard-top">
          <div className="pp-examcard-count">
            {plan.days_left != null ? (
              <>
                <b>{plan.days_left === 0 ? "วันนี้" : plan.days_left}</b>
                <span>{plan.days_left === 0 ? "วันสอบ สู้ ๆ" : "วัน"}</span>
              </>
            ) : <span className="pp-examcard-none">ยังไม่มีประกาศวันสอบ</span>}
          </div>
          {plan.days_left != null && <div className="pp-examcard-title">ถึง {plan.exam_title}<small>{plan.exam_date ? full(plan.exam_date) : ""}</small></div>}
        </div>
        {list.length > 0 && (
          <ul className="pp-examcard-list">
            {list.map(e => (
              <li key={e.id}>
                <span className={`pp-kind ${e.kind}`}>{KIND_LABEL[e.kind]}</span>
                <span className="pp-examcard-ev">{e.title}<small>{when(e)}</small></span>
                <span className="pp-examcard-when">{status(e, today)}</span>
              </li>
            ))}
          </ul>
        )}
        <button className="pp-btn pp-btn-primary pp-wide" onClick={onCalendar}><IconCalendar size={20} />เปิดปฏิทินสอบ</button>
      </section>

      <div className="pp-card pp-studyplan">
        {editing ? (
          <>
            <h3>เป้าต่อวัน</h3>
            <div className="pp-seg">{GOALS.map(g => <button key={g} className={goal === g ? "on" : ""} onClick={() => setGoal(g)}>{g} ข้อ</button>)}</div>
            {err && <div className="pp-error">{err}</div>}
            <div className="pp-row">
              <button className="pp-btn pp-btn-ghost" disabled={busy} onClick={() => setEditing(false)}>ยกเลิก</button>
              <button className="pp-btn pp-btn-primary" disabled={busy} onClick={save}>{busy ? "กำลังบันทึก..." : "บันทึก"}</button>
            </div>
          </>
        ) : (
          <>
            <div className="pp-plan-goal" style={{ marginTop: 0 }}>
              <span>เป้าวันนี้ <b>{answeredToday.toLocaleString("th-TH")}/{plan.daily_goal}</b> ข้อ{reached ? " · ครบแล้ว" : ""}</span>
              <span className="pp-muted small">
                {plan.streak > 0 ? `ทำต่อเนื่อง ${plan.streak} วัน · ` : ""}
                <button className="pp-link small" onClick={() => { setGoal(plan.daily_goal); setErr(""); setEditing(true); }}>ปรับเป้า</button>
              </span>
            </div>
            <div className="pp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={plan.daily_goal} aria-valuenow={done}><div style={{ width: `${(100 * done) / plan.daily_goal}%` }} /></div>
          </>
        )}
      </div>
    </>
  );
}

const LINE_KEY = "pp-line-card-hidden";
// Invites people to add the LINE OA (daily questions / reminders are sent from LINE OA Manager by the team).
export function LineCard() {
  const [hidden, setHidden] = useState(() => { try { return !!localStorage.getItem(LINE_KEY); } catch { return false; } });
  if (hidden || !SHOP.contactUrl) return null;
  return (
    <div className="pp-card pp-linecard">
      <div><b>แอด LINE รับข้อสอบและข่าวสอบ</b><span className="pp-muted small">ทักถามทีมงานได้ที่ {SHOP.contactText}</span></div>
      <div className="pp-row">
        <a className="pp-btn pp-btn-line" href={SHOP.contactUrl} target="_blank" rel="noopener noreferrer">แอดเพื่อน</a>
        <button className="pp-link small" onClick={() => { try { localStorage.setItem(LINE_KEY, "1"); } catch { /* ignore */ } setHidden(true); }}>ซ่อน</button>
      </div>
    </div>
  );
}
