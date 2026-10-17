import { useCallback, useEffect, useRef, useState } from "react";
import { rpc, supabase, thaiError } from "./api";

type Fix = { stem?: string; choices?: string[]; answer?: number; explanation?: string };
type Verdict = "ok" | "fix" | "hide" | "human";
type Review = {
  id: number; question_id: number; verdict: Verdict; confidence: number; analysis: string; fix: Fix | null; user_message: string;
  blind_answer: number | null; model: string | null; report_count: number;
  question: { stem: string; choices: string[]; answer: number; explanation: string | null; topic: string; status: string };
  reports: string[];
};
const L = ["ก", "ข", "ค", "ง"];
const VERDICT: Record<Verdict, { label: string; cls: string; apply: string }> = {
  ok: { label: "ข้อนี้ถูกต้องแล้ว", cls: "ok", apply: "ตอบผู้รายงานว่าข้อนี้ถูกต้อง" },
  fix: { label: "ควรแก้ข้อสอบ", cls: "warn", apply: "แก้ข้อสอบและแจ้งผู้รายงาน" },
  hide: { label: "ควรซ่อนข้อนี้", cls: "bad", apply: "ซ่อนข้อนี้และแจ้งผู้รายงาน" },
  human: { label: "ต้องให้คนตรวจ", cls: "", apply: "" },
};

async function callAI(questionId: number) {
  const { data, error } = await supabase.functions.invoke("prep-report-ai", { body: { question_id: questionId } });
  if (error) {
    let msg = error.message, fatal = false;
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error; fatal = j?.fatal === true; } catch { /* keep generic */ }
    throw Object.assign(new Error(msg), { fatal });
  }
  if (data?.error) throw new Error(data.error);
}

const Choices = ({ choices, answer, mark }: { choices: string[]; answer: number; mark?: boolean }) => (
  <ol className="pp-ai-ch">{choices.map((c, i) => <li key={i} className={i === answer ? "key" : ""}>{L[i]}. {c}{i === answer && mark !== false ? " ✓" : ""}</li>)}</ol>
);

function Card({ r, onDone }: { r: Review; onDone: () => void }) {
  const [msg, setMsg] = useState(r.user_message);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const v = VERDICT[r.verdict];
  const q = r.question;

  const apply = async () => {
    if (!window.confirm(`${v.apply}?\n\nผู้รายงานทุกคนจะได้รับข้อความนี้:\n${msg}`)) return;
    setBusy(true); setError("");
    try { await rpc("prep_admin_apply_report_review", { p_review: r.id, p_message: msg }); onDone(); }
    catch (e) { setError(thaiError(e)); setBusy(false); }
  };
  const dismiss = async () => {
    setBusy(true); setError("");
    try { await rpc("prep_admin_dismiss_report_review", { p_review: r.id }); onDone(); }
    catch (e) { setError(thaiError(e)); setBusy(false); }
  };

  return (
    <div className="pp-ai-card">
      <div className="pp-ai-h">
        <span className={`pp-badge ${v.cls}`}>{v.label}</span>
        <span className="pp-muted small">ข้อ #{r.question_id} · {q.topic} · รายงาน {r.report_count} คน · ความมั่นใจ {r.confidence}%
          {r.blind_answer != null && ` · ผู้ตรวจอิสระตอบ ${L[r.blind_answer]}`}</span>
      </div>
      <div className="pp-ai-q">{q.stem}</div>
      <Choices choices={q.choices} answer={q.answer} />
      {r.reports.length > 0 && <div className="pp-ai-rep"><b>ผู้ใช้แจ้งว่า:</b> {r.reports.join(" | ")}</div>}
      <div className="pp-ai-an"><b>AI ตรวจแล้ว:</b> {r.analysis}</div>

      {r.verdict === "fix" && r.fix && (
        <div className="pp-ai-fix">
          <b>จะแก้เป็น:</b>
          {r.fix.stem && <div className="pp-ai-new"><span className="pp-muted small">โจทย์ใหม่</span>{r.fix.stem}</div>}
          {r.fix.choices
            ? <div className="pp-ai-new"><span className="pp-muted small">ตัวเลือกใหม่ (✓ = เฉลย)</span><Choices choices={r.fix.choices} answer={r.fix.answer ?? 0} /></div>
            : r.fix.answer != null && <div className="pp-ai-new"><span className="pp-muted small">เฉลยใหม่</span>{L[r.fix.answer]}. {q.choices[r.fix.answer]} (เดิม {L[q.answer]})</div>}
          {r.fix.explanation && <div className="pp-ai-new"><span className="pp-muted small">คำอธิบายใหม่</span>{r.fix.explanation}</div>}
        </div>
      )}

      {r.verdict !== "human" ? (
        <>
          <label className="pp-ai-msg"><span className="pp-muted small">ข้อความที่ผู้รายงานจะได้อ่าน (แก้ได้)</span>
            <textarea className="pp-input" rows={3} maxLength={600} value={msg} onChange={e => setMsg(e.target.value)} />
          </label>
          {error && <div className="pp-error">{error}</div>}
          <div className="pp-ai-act">
            <button className="pp-btn pp-btn-primary" disabled={busy || !msg.trim()} onClick={apply}>{v.apply}</button>
            <button className="pp-btn pp-btn-ghost" disabled={busy} onClick={dismiss}>ไม่ใช้ ข้ามไป</button>
          </div>
        </>
      ) : (
        <>
          <p className="pp-muted small">AI ไม่แน่ใจข้อนี้ จึงยังไม่ส่งอะไรให้ผู้รายงาน ให้แก้หรือตอบเองจากรายการด้านล่าง ผู้รายงานจะได้รับแจ้งเมื่อคุณปิดรายงาน</p>
          {error && <div className="pp-error">{error}</div>}
          <div className="pp-ai-act"><button className="pp-btn pp-btn-ghost" disabled={busy} onClick={dismiss}>เข้าใจแล้ว ซ่อนรายการนี้</button></div>
        </>
      )}
    </div>
  );
}

// AI check of reported questions: run it on every question that still has open reports, then approve each result.
export default function AdminReportAI({ onChanged }: { onChanged: () => void }) {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [todo, setTodo] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const stop = useRef(false);

  const fetchAll = useCallback(
    () => Promise.all([rpc<Review[]>("prep_admin_report_reviews", { p_status: "pending" }), rpc<number[]>("prep_admin_reports_to_review", { p_limit: 100 })]),
    []);
  const load = useCallback(async () => {
    try { const [rv, q] = await fetchAll(); setReviews(rv); setTodo(q); }
    catch (e) { setError(thaiError(e)); }
  }, [fetchAll]);
  useEffect(() => {
    let alive = true;
    fetchAll().then(([rv, q]) => { if (alive) { setReviews(rv); setTodo(q); } }).catch(e => { if (alive) setError(thaiError(e)); });
    return () => { alive = false; };
  }, [fetchAll]);

  const runAll = async () => {
    stop.current = false; setBusy(true); setError("");
    const ids = [...todo];
    let failed = 0;
    for (let i = 0; i < ids.length && !stop.current; i++) {
      setProgress({ done: i, total: ids.length });
      try { await callAI(ids[i]); }
      catch (e) {
        failed++;
        const err = e as Error & { fatal?: boolean };
        setError(`ข้อ #${ids[i]}: ${err.message}`);
        if (err.fatal) break;
      }
      await load();
    }
    setProgress(null); setBusy(false);
    if (failed === 0) setError("");
    await load();
  };

  const done = () => { load(); onChanged(); };

  return (
    <div className="pp-card">
      <h3>ตรวจรายงานด้วย AI</h3>
      <p className="pp-muted small">AI จะทำข้อสอบเองโดยไม่เห็นเฉลย แล้วเทียบกับรายงานของผู้ใช้ เสนอว่าควรแก้ ซ่อน หรือข้อนี้ถูกต้องแล้ว พร้อมข้อความภาษาง่ายๆ ถึงผู้รายงาน
        ไม่มีอะไรเปลี่ยนในข้อสอบจนกว่าคุณจะกดยืนยัน เมื่อยืนยัน ผู้รายงานทุกคนจะได้ข่าวในหน้าบัญชี</p>
      <div className="pp-ai-act">
        <button className="pp-btn pp-btn-primary" disabled={busy || todo.length === 0} onClick={runAll}>
          {busy && progress ? `กำลังตรวจ ${progress.done + 1}/${progress.total}…` : todo.length ? `ตรวจด้วย AI (${todo.length} ข้อที่รอ)` : "ไม่มีข้อที่รอตรวจ"}
        </button>
        {busy && <button className="pp-btn pp-btn-ghost" onClick={() => { stop.current = true; }}>หยุด</button>}
      </div>
      {error && <div className="pp-error">{error}</div>}
      {reviews && reviews.length > 0 && <h3>ผลที่รอคุณยืนยัน ({reviews.length})</h3>}
      {reviews?.map(r => <Card key={r.id} r={r} onDone={done} />)}
    </div>
  );
}
