import { useMemo, useState } from "react";
import { choiceOrder, rpc, thaiError, type AnswerResult, type Item, type Round, type SubmitResult } from "./api";

type Props = { round: Round; onExit: () => void; onSubmitted: (r: SubmitResult) => void };

const LABELS = ["ก", "ข", "ค", "ง"];

export default function Player({ round, onExit, onSubmitted }: Props) {
  const [items, setItems] = useState<Item[]>(round.items);
  const [pos, setPos] = useState(() => Math.max(0, round.items.findIndex(i => i.picked == null)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showGrid, setShowGrid] = useState(false);
  const [reported, setReported] = useState<Set<number>>(new Set());

  const item = items[pos];
  const answered = items.filter(i => i.picked != null).length;
  const right = items.filter(i => i.correct).length;
  const order = useMemo(() => choiceOrder(`${round.attempt_id}:${item.question_id}`), [round.attempt_id, item.question_id]);

  const pick = async (choice: number) => {
    if (busy || item.picked != null) return;
    setBusy(true); setError("");
    try {
      const r = await rpc<AnswerResult>("prep_answer", { p_attempt: round.attempt_id, p_idx: item.idx, p_choice: choice });
      setItems(prev => prev.map(i => i.idx === item.idx
        ? { ...i, picked: r.picked, correct: r.correct, answer: r.answer, explanation: r.explanation, law_ref: r.law_ref } : i));
    } catch (e) {
      setError(thaiError(e));
    }
    setBusy(false);
  };

  const next = () => {
    const after = items.findIndex((i, k) => k > pos && i.picked == null);
    const any = items.findIndex(i => i.picked == null);
    setPos(after >= 0 ? after : any >= 0 ? any : Math.min(pos + 1, items.length - 1));
    window.scrollTo(0, 0);
  };

  const submit = async () => {
    const left = items.length - answered;
    if (left > 0 && !confirm(`ยังไม่ได้ตอบ ${left} ข้อ (นับเป็นข้อผิด) ส่งเลยไหม?`)) return;
    setBusy(true); setError("");
    try {
      onSubmitted(await rpc<SubmitResult>("prep_submit", { p_attempt: round.attempt_id }));
    } catch (e) {
      setError(thaiError(e));
      setBusy(false);
    }
  };

  const report = async () => {
    const reason = prompt("ข้อนี้มีปัญหาอะไร? (เช่น เฉลยผิด, โจทย์ไม่ชัด)");
    if (!reason?.trim()) return;
    try {
      await rpc("prep_report", { p_question: item.question_id, p_reason: reason.trim() });
      setReported(prev => new Set(prev).add(item.question_id));
    } catch (e) { alert(thaiError(e)); }
  };

  const allDone = answered === items.length;

  return (
    <div className="pp-app pp-play">
      <header className="pp-top">
        <button className="pp-link" onClick={onExit}>← ออก (บันทึกไว้แล้ว)</button>
        <span className="pp-muted">{round.mode === "wrong" ? "รอบข้อผิด" : `รอบที่ ${round.round_no}`}</span>
      </header>
      <div className="pp-progress">
        <div className="pp-bar"><div style={{ width: `${(100 * answered) / items.length}%` }} /></div>
        <button className="pp-link" onClick={() => setShowGrid(v => !v)}>
          ข้อ {pos + 1}/{items.length} · ถูก {right} {showGrid ? "▲" : "▼"}
        </button>
      </div>

      {showGrid && (
        <div className="pp-grid">
          {items.map((i, k) => (
            <button key={i.idx} className={`${i.picked == null ? "" : i.correct ? "ok" : "bad"} ${k === pos ? "cur" : ""}`}
              onClick={() => { setPos(k); setShowGrid(false); }}>{k + 1}</button>
          ))}
        </div>
      )}

      <main className="pp-main">
        <div className="pp-card pp-q">
          <div className="pp-q-topic">{item.topic}</div>
          <div className="pp-q-stem">{pos + 1}. {item.stem}</div>
          <div className="pp-choices">
            {order.map((orig, d) => {
              const state = item.picked == null ? ""
                : orig === item.answer ? "right"
                : orig === item.picked ? "wrong" : "dim";
              return (
                <button key={orig} className={`pp-choice ${state}`} disabled={busy || item.picked != null} onClick={() => pick(orig)}>
                  <span className="pp-choice-l">{LABELS[d]}</span>
                  <span>{item.choices[orig]}</span>
                </button>
              );
            })}
          </div>

          {item.picked != null && (
            <div className={`pp-explain ${item.correct ? "ok" : "bad"}`}>
              <b>{item.correct ? "✅ ถูกต้อง" : `❌ ยังไม่ถูก — คำตอบคือ ${LABELS[order.indexOf(item.answer ?? 0)]}`}</b>
              {item.explanation && <p>{item.explanation}</p>}
              {item.law_ref && <p className="pp-muted">อ้างอิง: {item.law_ref}</p>}
              <button className="pp-link small" disabled={reported.has(item.question_id)} onClick={report}>
                {reported.has(item.question_id) ? "ส่งรายงานแล้ว ขอบคุณครับ" : "⚑ แจ้งข้อนี้มีปัญหา"}
              </button>
            </div>
          )}
          {error && <div className="pp-error">{error}</div>}
        </div>
      </main>

      <footer className="pp-foot">
        <button className="pp-btn pp-btn-ghost" disabled={pos === 0} onClick={() => setPos(pos - 1)}>ก่อนหน้า</button>
        {allDone
          ? <button className="pp-btn pp-btn-primary" disabled={busy} onClick={submit}>ส่งรอบนี้ ดูผล</button>
          : item.picked != null
            ? <button className="pp-btn pp-btn-primary" onClick={next}>ข้อต่อไป →</button>
            : <button className="pp-btn pp-btn-ghost" onClick={submit} disabled={busy}>ส่งเลย</button>}
      </footer>
    </div>
  );
}
