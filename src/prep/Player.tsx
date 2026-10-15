import { useEffect, useMemo, useRef, useState } from "react";
import { choiceOrder, rpc, thaiError, type AnswerResult, type Item, type Round, type SubmitResult } from "./api";
import { IconBack, IconCheck, IconFlag, IconGrid, IconNext, IconX } from "./icons";

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
  const explainRef = useRef<HTMLDivElement>(null);

  // After answering on a phone, bring the explanation into view without jumping on desktop.
  useEffect(() => {
    if (item.picked != null && window.innerWidth < 900) explainRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [item.picked]);

  // Keyboard: 1–4 or ก ข ค ง to answer, Enter / → for next, ← for previous.
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => { keyRef.current = e => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey || e.altKey) return;
    const d = "1234".indexOf(e.key) >= 0 ? "1234".indexOf(e.key) : LABELS.indexOf(e.key);
    if (d >= 0 && item.picked == null) { e.preventDefault(); pick(order[d]); return; }
    if ((e.key === "Enter" || e.key === "ArrowRight") && item.picked != null) {
      e.preventDefault();
      if (allDone) { if (e.key === "Enter") submit(); } else next();
    }
    if (e.key === "ArrowLeft" && pos > 0) { e.preventDefault(); setPos(pos - 1); }
  }; });
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div className="pp-app pp-play">
      <header className="pp-top">
        <div className="pp-top-in">
          <button className="pp-link" onClick={onExit}><IconBack />ออก <span className="small" style={{ opacity: .75 }}>(บันทึกไว้แล้ว)</span></button>
          <span className="pp-spacer" />
          <span className="pp-muted">{round.mode === "wrong" ? "รอบข้อผิด" : `รอบที่ ${round.round_no}`}</span>
        </div>
        <div className="pp-progress">
          <div className="pp-bar"><div style={{ width: `${(100 * answered) / items.length}%` }} /></div>
          <div className="pp-progress-row">
            <span className="pp-score-pill">ข้อ <b>{pos + 1}/{items.length}</b> · ถูก <b>{right}</b> · ผิด <b>{answered - right}</b></span>
            <button className="pp-link" onClick={() => setShowGrid(v => !v)} aria-expanded={showGrid}><IconGrid size={15} />{showGrid ? "ซ่อน" : "ทุกข้อ"}</button>
          </div>
        </div>
      </header>

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
          <div className="pp-q-stem"><span className="pp-q-no">{pos + 1}.</span> {item.stem}</div>
          <div className="pp-choices">
            {order.map((orig, d) => {
              const state = item.picked == null ? ""
                : orig === item.answer ? "right"
                : orig === item.picked ? "wrong" : "dim";
              return (
                <button key={orig} className={`pp-choice ${state}`} disabled={busy || item.picked != null} onClick={() => pick(orig)}>
                  <span className="pp-choice-l">{LABELS[d]}</span>
                  <span className="pp-choice-t">{item.choices[orig]}</span>
                  <span className="pp-choice-ico">{state === "right" ? <IconCheck size={22} /> : state === "wrong" ? <IconX size={22} /> : null}</span>
                </button>
              );
            })}
          </div>

          {item.picked != null && (
            <div ref={explainRef} className={`pp-explain ${item.correct ? "ok" : "bad"}`}>
              <div className="pp-explain-h">
                {item.correct ? <><IconCheck />ถูกต้อง</> : <><IconX />ยังไม่ถูก — คำตอบคือ {LABELS[order.indexOf(item.answer ?? 0)]}</>}
              </div>
              {item.explanation && <p>{item.explanation}</p>}
              {item.law_ref && <p className="pp-muted">อ้างอิง: {item.law_ref}</p>}
              <button className="pp-link small" disabled={reported.has(item.question_id)} onClick={report}>
                <IconFlag />{reported.has(item.question_id) ? "ส่งรายงานแล้ว ขอบคุณครับ" : "แจ้งข้อนี้มีปัญหา"}
              </button>
            </div>
          )}
          {error && <div className="pp-error">{error}</div>}
          <div className="pp-kbd">แป้นลัด: <kbd>1</kbd>–<kbd>4</kbd> เลือกคำตอบ · <kbd>Enter</kbd> ข้อต่อไป · <kbd>←</kbd> ย้อนกลับ</div>
        </div>
      </main>

      <footer className="pp-foot">
        <div className="pp-foot-in">
          <button className="pp-btn pp-btn-ghost" disabled={pos === 0} onClick={() => setPos(pos - 1)}><IconBack />ก่อนหน้า</button>
          {allDone
            ? <button className="pp-btn pp-btn-gold" disabled={busy} onClick={submit}>ส่งรอบนี้ ดูผล</button>
            : item.picked != null
              ? <button className="pp-btn pp-btn-primary" onClick={next}>ข้อต่อไป<IconNext /></button>
              : <button className="pp-btn pp-btn-outline" onClick={submit} disabled={busy}>ส่งเลย</button>}
        </div>
      </footer>
    </div>
  );
}
