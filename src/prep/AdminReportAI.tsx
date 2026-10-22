import { useCallback, useEffect, useRef, useState } from "react";
import { rpc, supabase, thaiError } from "./api";
import { APPLY_LABEL, PRESETS, type Outcome } from "./reportPresets";

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
  human: { label: "AI ไม่แน่ใจ ต้องให้คนตรวจ", cls: "", apply: "" },
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

type Draft = { stem: string; choices: string[]; answer: number; explanation: string };

// Editing form for a question the AI was unsure about. Only the fields the admin actually changes are sent.
function FixForm({ q, d, onChange }: { q: Review["question"]; d: Draft; onChange: (d: Draft) => void }) {
  return (
    <div className="pp-ai-edit">
      <label><span className="pp-muted small">โจทย์</span>
        <textarea className="pp-input" rows={3} value={d.stem} onChange={e => onChange({ ...d, stem: e.target.value })} /></label>
      <span className="pp-muted small">ตัวเลือก (เลือกวงกลมหน้าข้อที่ถูก)</span>
      {d.choices.map((c, i) => (
        <div key={i} className="pp-ai-edit-ch">
          <input type="radio" name={`ans-${q.stem.length}`} checked={d.answer === i} onChange={() => onChange({ ...d, answer: i })} aria-label={`ข้อ ${L[i]} คือเฉลย`} />
          <span>{L[i]}.</span>
          <input className="pp-input" value={c} onChange={e => onChange({ ...d, choices: d.choices.map((x, k) => (k === i ? e.target.value : x)) })} />
        </div>
      ))}
      <label><span className="pp-muted small">คำอธิบาย</span>
        <textarea className="pp-input" rows={3} value={d.explanation} onChange={e => onChange({ ...d, explanation: e.target.value })} /></label>
    </div>
  );
}

// Builds the patch for prep_admin_apply_report_review, or an error text when the edit cannot be saved.
function buildFix(q: Review["question"], d: Draft): { fix?: Fix; error?: string } {
  const fix: Fix = {};
  if (d.stem.trim() !== q.stem.trim()) fix.stem = d.stem.trim();
  if ((d.explanation ?? "").trim() !== (q.explanation ?? "").trim()) fix.explanation = d.explanation.trim();
  const choices = d.choices.map(c => c.trim());
  if (choices.some((c, i) => c !== q.choices[i]) || d.answer !== q.answer) {
    if (choices.some(c => !c)) return { error: "ตัวเลือกต้องกรอกครบทั้ง 4 ข้อ" };
    if (new Set(choices.map(c => c.toLowerCase())).size !== 4) return { error: "ตัวเลือกต้องไม่ซ้ำกัน" };
    fix.choices = choices; fix.answer = d.answer;
  }
  if (!fix.stem && !fix.explanation && !fix.choices) return { error: "ยังไม่ได้แก้อะไรเลย" };
  if (fix.stem === "") return { error: "โจทย์ต้องไม่ว่าง" };
  return { fix };
}

function Card({ r, onDone }: { r: Review; onDone: () => void }) {
  const q = r.question;
  const human = r.verdict === "human";
  const [outcome, setOutcome] = useState<Outcome | null>(human ? null : (r.verdict as Outcome));
  const [msg, setMsg] = useState(human ? "" : r.user_message);
  const [draft, setDraft] = useState<Draft>({ stem: q.stem, choices: [...q.choices], answer: q.answer, explanation: q.explanation ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const v = VERDICT[r.verdict];

  const pick = (o: Outcome) => {
    setOutcome(o); setMsg(PRESETS[o][0].text); setError("");
    if (o === "fix") setDraft({ stem: q.stem, choices: [...q.choices], answer: q.answer, explanation: q.explanation ?? "" });
  };
  // The independent AI answer disagrees with the key in the system: offer it as a one-tap fix.
  const aiDiffers = human && r.blind_answer != null && r.blind_answer !== q.answer;
  const useAiKey = () => {
    setOutcome("fix"); setMsg(PRESETS.fix[0].text); setError("");
    setDraft({ stem: q.stem, choices: [...q.choices], answer: r.blind_answer as number, explanation: q.explanation ?? "" });
  };

  const apply = async () => {
    if (!outcome) return;
    let fix: Fix | null = null;
    if (human && outcome === "fix") {
      const b = buildFix(q, draft);
      if (b.error) { setError(b.error); return; }
      fix = b.fix ?? null;
    }
    if (!window.confirm(`${APPLY_LABEL[outcome]}?\n\nผู้รายงานทุกคนจะได้รับข้อความนี้:\n${msg}`)) return;
    setBusy(true); setError("");
    try {
      await rpc("prep_admin_apply_report_review", { p_review: r.id, p_message: msg, p_fix: fix, p_verdict: human ? outcome : null });
      onDone();
    } catch (e) { setError(thaiError(e)); setBusy(false); }
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

      {!human && r.verdict === "fix" && r.fix && (
        <div className="pp-ai-fix">
          <b>จะแก้เป็น:</b>
          {r.fix.stem && <div className="pp-ai-new"><span className="pp-muted small">โจทย์ใหม่</span>{r.fix.stem}</div>}
          {r.fix.choices
            ? <div className="pp-ai-new"><span className="pp-muted small">ตัวเลือกใหม่ (✓ = เฉลย)</span><Choices choices={r.fix.choices} answer={r.fix.answer ?? 0} /></div>
            : r.fix.answer != null && <div className="pp-ai-new"><span className="pp-muted small">เฉลยใหม่</span>{L[r.fix.answer]}. {q.choices[r.fix.answer]} (เดิม {L[q.answer]})</div>}
          {r.fix.explanation && <div className="pp-ai-new"><span className="pp-muted small">คำอธิบายใหม่</span>{r.fix.explanation}</div>}
        </div>
      )}

      {human && (
        <div className="pp-ai-human">
          <p><b>🙋 AI ไม่แน่ใจข้อนี้ ช่วยตัดสินหน่อย</b></p>
          <p className="pp-muted small">ยังไม่มีอะไรเปลี่ยนในข้อสอบ และยังไม่ส่งอะไรถึงผู้รายงาน จนกว่าคุณจะกดส่งในขั้นสุดท้าย</p>
          {aiDiffers && (
            <div className="pp-ai-vs">
              <span>เฉลยในระบบ <b>{L[q.answer]}</b></span><span>·</span><span>AI ลองทำเองได้ <b>{L[r.blind_answer as number]}</b></span>
            </div>
          )}
          <div className="pp-ai-step">ขั้น 1 · เลือกว่าจะทำอะไรกับข้อนี้</div>
          <div className="pp-ai-opts" role="group" aria-label="ผลการตรวจ">
            {aiDiffers && (
              <button type="button" className={`pp-ai-opt ${outcome === "fix" && draft.answer === r.blind_answer ? "on" : ""}`} onClick={useAiKey}>
                <b>ใช้เฉลยของ AI (ข้อ {L[r.blind_answer as number]})</b><span>เปลี่ยนเฉลยเป็นข้อ {L[r.blind_answer as number]} แล้วแจ้งผู้รายงานว่าแก้แล้ว</span>
              </button>
            )}
            <button type="button" className={`pp-ai-opt ${outcome === "ok" ? "on" : ""}`} onClick={() => pick("ok")}>
              <b>เฉลยเดิมถูกแล้ว</b><span>ข้อสอบไม่เปลี่ยน ตอบผู้รายงานว่าข้อนี้ถูกต้อง</span>
            </button>
            <button type="button" className={`pp-ai-opt ${outcome === "fix" && !(aiDiffers && draft.answer === r.blind_answer) ? "on" : ""}`} onClick={() => pick("fix")}>
              <b>แก้ข้อสอบเอง</b><span>เปิดฟอร์มแก้โจทย์ ตัวเลือก เฉลย หรือคำอธิบาย แล้วแจ้งผู้รายงานว่าแก้แล้ว</span>
            </button>
            <button type="button" className={`pp-ai-opt ${outcome === "hide" ? "on" : ""}`} onClick={() => pick("hide")}>
              <b>ซ่อนข้อนี้</b><span>เอาข้อนี้ออกจากชุดข้อสอบ (โจทย์ไม่ชัดหรือล้าสมัย) แล้วแจ้งผู้รายงาน</span>
            </button>
          </div>
          {outcome === "fix" && <FixForm q={q} d={draft} onChange={setDraft} />}
        </div>
      )}

      {outcome && (
        <>
          <div className="pp-ai-presets"><span className="pp-muted small">ข้อความสำเร็จรูป:</span>
            {PRESETS[outcome].map(p => <button key={p.label} type="button" className="pp-chipbtn" onClick={() => setMsg(p.text)}>{p.label}</button>)}
          </div>
          <div className="pp-ai-step">ขั้น 2 · ตรวจข้อความที่ผู้รายงานจะได้อ่าน (แก้ได้)</div>
          <label className="pp-ai-msg">
            <textarea className="pp-input" rows={3} maxLength={600} value={msg} onChange={e => setMsg(e.target.value)} />
          </label>
        </>
      )}
      {error && <div className="pp-error">{error}</div>}
      <div className="pp-ai-act">
        {outcome && <button className="pp-btn pp-btn-primary" disabled={busy || !msg.trim()} onClick={apply}>{APPLY_LABEL[outcome]}</button>}
        <button className="pp-btn pp-btn-ghost" disabled={busy} onClick={dismiss}>{human ? "ข้ามไปก่อน" : "ไม่ใช้ ข้ามไป"}</button>
      </div>
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

  const needHuman = (reviews ?? []).filter(r => r.verdict === "human");
  const decided = (reviews ?? []).filter(r => r.verdict !== "human");
  const sure = decided.filter(r => r.confidence >= 90);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const confirmAllSure = async () => {
    if (!sure.length || bulk) return;
    const n = (v: Verdict) => sure.filter(r => r.verdict === v).length;
    if (!window.confirm(`ยืนยันผลที่ AI มั่นใจ ≥ 90% ทั้ง ${sure.length} ข้อ?\n\nแก้ข้อสอบ ${n("fix")} · ซ่อน ${n("hide")} · ถูกอยู่แล้ว ${n("ok")}\nผู้รายงานทุกคนจะได้ข้อความที่ AI ร่างไว้ (ดูแต่ละข้อก่อนได้ถ้าไม่แน่ใจ)`)) return;
    setError("");
    for (let i = 0; i < sure.length; i++) {
      setBulk({ done: i, total: sure.length });
      try { await rpc("prep_admin_apply_report_review", { p_review: sure[i].id, p_message: sure[i].user_message, p_fix: null, p_verdict: null }); }
      catch (e) { setError(`ข้อ #${sure[i].question_id}: ${thaiError(e)} (หยุดที่ข้อนี้)`); break; }
    }
    setBulk(null); done();
  };

  return (
    <div className="pp-card">
      <h3>ตรวจรายงานด้วย AI</h3>
      <ol className="pp-ai-steps small">
        <li><b>กด "ตรวจด้วย AI"</b> AI ทำข้อสอบเองโดยไม่เห็นเฉลย แล้วเทียบกับที่ผู้ใช้แจ้ง</li>
        <li><b>AI ตัดสินให้แต่ละข้อ</b> (แก้ / ซ่อน / ถูกอยู่แล้ว) ถ้าไม่แน่ใจจะส่งมาให้คุณตัดสินเอง</li>
        <li><b>คุณกดยืนยัน</b> ข้อสอบถึงจะเปลี่ยน และผู้รายงานทุกคนจะได้ข้อความภาษาง่ายๆ ในหน้าบัญชี</li>
      </ol>
      <div className="pp-ai-act">
        <button className="pp-btn pp-btn-primary" disabled={busy || todo.length === 0} onClick={runAll}>
          {busy && progress ? `กำลังตรวจ ${progress.done + 1}/${progress.total}…` : todo.length ? `ตรวจด้วย AI (${todo.length} ข้อที่รอ)` : "ไม่มีข้อที่รอตรวจ"}
        </button>
        {busy && <button className="pp-btn pp-btn-ghost" onClick={() => { stop.current = true; }}>หยุด</button>}
      </div>
      {error && <div className="pp-error">{error}</div>}
      {needHuman.length > 0 && (
        <>
          <h3>🙋 รอคุณตัดสิน ({needHuman.length})</h3>
          <p className="pp-muted small">AI ไม่แน่ใจข้อเหล่านี้ ทำให้ครบก่อน แล้วค่อยยืนยันข้อที่ AI ตัดสินให้ด้านล่าง</p>
          {needHuman.map(r => <Card key={r.id} r={r} onDone={done} />)}
        </>
      )}
      {decided.length > 0 && (
        <>
          <h3>✅ AI ตัดสินแล้ว รอคุณยืนยัน ({decided.length})</h3>
          {sure.length > 0 && (
            <div className="pp-ai-act">
              <button className="pp-btn pp-btn-primary" disabled={!!bulk || busy} onClick={confirmAllSure}>
                {bulk ? `กำลังยืนยัน ${bulk.done + 1}/${bulk.total}…` : `ยืนยันทั้งหมดที่ AI มั่นใจ ≥ 90% (${sure.length} ข้อ)`}
              </button>
            </div>
          )}
          {decided.map(r => <Card key={r.id} r={r} onDone={done} />)}
        </>
      )}
      {reviews && reviews.length === 0 && todo.length === 0 && <p className="pp-muted">ไม่มีรายงานค้าง ทำครบแล้ว 🎉</p>}
    </div>
  );
}
