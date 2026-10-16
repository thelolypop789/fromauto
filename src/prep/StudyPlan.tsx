import { useEffect, useState } from "react";
import { rpc, thaiError } from "./api";
import { SHOP } from "./config";

type Plan = { exam_date: string | null; daily_goal: number; days_left: number | null; answered_today: number; streak: number };
const GOALS = [20, 40, 60, 100, 150];
const thDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
const isoDay = (offset: number) => { const t = new Date(Date.now() + offset * 86_400_000); return t.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }); };

// Exam countdown + today's goal + streak, so there is a reason to come back every day.
// answeredToday comes from prep_me (refreshed after every round), the rest from prep_plan.
export default function StudyPlan({ answeredToday }: { answeredToday: number }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");
  const [goal, setGoal] = useState(40);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { rpc<Plan>("prep_plan").then(setPlan).catch(() => { /* card hides itself */ }); }, []);
  if (!plan) return null;

  const open = () => { setDate(plan.exam_date ?? ""); setGoal(plan.daily_goal); setErr(""); setEditing(true); };
  const save = async () => {
    setBusy(true); setErr("");
    try { setPlan(await rpc<Plan>("prep_set_plan", { p_exam_date: date || null, p_goal: goal })); setEditing(false); }
    catch (e) { const m = e instanceof Error ? e.message : ""; setErr(m === "invalid_date" ? "เลือกวันที่ตั้งแต่วันนี้ ถึงไม่เกิน 2 ปีข้างหน้า" : thaiError(e)); }
    setBusy(false);
  };

  if (editing) {
    return (
      <div className="pp-card pp-studyplan">
        <h3>ตั้งวันสอบและเป้ารายวัน</h3>
        <label className="small pp-muted" htmlFor="pp-exam-date">วันสอบ (ไม่รู้แน่นอนใส่วันโดยประมาณได้ แก้ทีหลังได้)</label>
        <input id="pp-exam-date" className="pp-input" type="date" value={date} min={isoDay(0)} max={isoDay(730)} onChange={e => setDate(e.target.value)} />
        <label className="small pp-muted">เป้าต่อวัน</label>
        <div className="pp-seg">{GOALS.map(g => <button key={g} className={goal === g ? "on" : ""} onClick={() => setGoal(g)}>{g} ข้อ</button>)}</div>
        {err && <div className="pp-error">{err}</div>}
        <div className="pp-row">
          <button className="pp-btn pp-btn-ghost" disabled={busy} onClick={() => setEditing(false)}>ยกเลิก</button>
          <button className="pp-btn pp-btn-primary" disabled={busy} onClick={save}>{busy ? "กำลังบันทึก..." : "บันทึก"}</button>
        </div>
      </div>
    );
  }

  const done = Math.min(answeredToday, plan.daily_goal);
  const reached = answeredToday >= plan.daily_goal;
  return (
    <div className="pp-card pp-studyplan">
      <div className="pp-plan-top">
        {plan.days_left != null
          ? <div className="pp-plan-count"><b>{plan.days_left === 0 ? "วันนี้" : plan.days_left}</b><span>{plan.days_left === 0 ? "วันสอบ สู้ ๆ" : `วันก่อนสอบ · ${thDate(plan.exam_date!)}`}</span></div>
          : <div className="pp-plan-count"><span>ยังไม่ได้ตั้งวันสอบ</span></div>}
        <button className="pp-link small" onClick={open}>{plan.exam_date ? "แก้ไข" : "ตั้งวันสอบ"}</button>
      </div>
      <div className="pp-plan-goal">
        <span>เป้าวันนี้ <b>{answeredToday.toLocaleString("th-TH")}/{plan.daily_goal}</b> ข้อ{reached ? " · ครบแล้ว" : ""}</span>
        {plan.streak > 0 && <span className="pp-muted small">ทำต่อเนื่อง {plan.streak} วัน</span>}
      </div>
      <div className="pp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={plan.daily_goal} aria-valuenow={done}><div style={{ width: `${(100 * done) / plan.daily_goal}%` }} /></div>
    </div>
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
