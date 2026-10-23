import { useEffect, useRef, useState } from "react";
import { rpc, thaiError, type MockPayload } from "./api";
import { IconBack, IconFlag, IconGrid, IconNext } from "./icons";

const LABELS = ["ก", "ข", "ค", "ง"];
const mmss = (s: number) => `${Math.floor(s / 3600) ? Math.floor(s / 3600) + ":" : ""}${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

type Props = { payload: MockPayload; onDone: (p: MockPayload) => void; onExit: () => void };

// Timed exam. The deadline comes from the server (clock difference corrected); answers are saved one by one and can be
// changed until the end. Nothing is revealed until the attempt is submitted or time is up.
export default function MockPlayer({ payload, onDone, onExit }: Props) {
  const [picks, setPicks] = useState<(number | null)[]>(() => payload.items.map(i => i.picked));
  const [pos, setPos] = useState(() => Math.max(0, payload.items.findIndex(i => i.picked == null)));
  const [flags, setFlags] = useState<Set<number>>(new Set());
  const [showGrid, setShowGrid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [offset] = useState(() => Date.parse(payload.server_now) - Date.now());
  const deadline = Date.parse(payload.deadline);
  const calc = () => Math.max(0, Math.floor((deadline - (Date.now() + offset)) / 1000));
  const [left, setLeft] = useState(calc);
  const closing = useRef(false);
  const submitRef = useRef<() => void>(() => {});

  const submit = async () => {
    if (closing.current) return;
    closing.current = true; setBusy(true);
    try { onDone(await rpc<MockPayload>("prep_mock_submit", { p_attempt: payload.attempt_id })); }
    catch (e) { closing.current = false; setBusy(false); setError(thaiError(e)); }
  };
  useEffect(() => { submitRef.current = submit; });
  useEffect(() => {
    const id = setInterval(() => { const l = calc(); setLeft(l); if (l === 0) submitRef.current(); }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, offset]);

  const item = payload.items[pos];
  const answered = picks.filter(p => p != null).length;
  const total = payload.items.length;

  const pick = async (c: number | null) => {
    if (closing.current) return;
    const before = picks[pos];
    setPicks(prev => prev.map((p, i) => (i === pos ? c : p)));
    setError("");
    try { await rpc("prep_mock_answer", { p_attempt: payload.attempt_id, p_idx: item.idx, p_choice: c }); }
    catch (e) {
      if (e instanceof Error && e.message === "time_up") { submitRef.current(); return; }
      setPicks(prev => prev.map((p, i) => (i === pos ? before : p)));
      setError(thaiError(e));
    }
  };
  const flag = () => setFlags(prev => { const n = new Set(prev); if (n.has(pos)) n.delete(pos); else n.add(pos); return n; });
  const finish = () => {
    const blank = total - answered;
    const msg = `ส่งข้อสอบ ${payload.name}\nตอบแล้ว ${answered}/${total} ข้อ${blank ? `\nยังไม่ได้ตอบ ${blank} ข้อ (นับเป็นผิด)` : ""}${flags.size ? `\nมี ${flags.size} ข้อที่ทำเครื่องหมายไว้` : ""}\n\nส่งแล้วแก้ไม่ได้`;
    if (confirm(msg)) submit();
  };

  return (
    <div className="pp-player pp-mock">
      <header className="pp-top pp-player-top">
        <div className="pp-top-in">
          <button className="pp-btn pp-btn-ghost" onClick={onExit} aria-label="ออก (เวลายังเดิน)"><IconBack />ออก</button>
          <div className="pp-player-title"><b>{payload.name}</b><span className="pp-muted small">ตอบแล้ว {answered}/{total}</span></div>
          <span className={`pp-timer ${left < 300 ? "low" : ""}`} role="timer" aria-label="เวลาที่เหลือ">{mmss(left)}</span>
          <button className="pp-btn pp-btn-ghost" onClick={() => setShowGrid(!showGrid)} aria-label="ดูทุกข้อ"><IconGrid /></button>
        </div>
      </header>

      {showGrid && (
        <div className="pp-grid">
          {payload.items.map((_, k) => (
            <button key={k} className={`${picks[k] != null ? "ok" : ""} ${flags.has(k) ? "flag" : ""} ${k === pos ? "cur" : ""}`}
              onClick={() => { setPos(k); setShowGrid(false); }}>{k + 1}</button>
          ))}
        </div>
      )}

      <main className="pp-main">
        <div className="pp-card pp-q">
          <div className="pp-q-head">
            <div className="pp-q-topic">{item.topic}</div>
            {item.tag && <div className="pp-q-tag">{item.tag}</div>}
            <button className={`pp-report-btn ${flags.has(pos) ? "done" : ""}`} onClick={flag}><IconFlag size={14} />{flags.has(pos) ? "ทำเครื่องหมายแล้ว" : "กลับมาดูทีหลัง"}</button>
          </div>
          <div className="pp-q-stem"><span className="pp-q-no">{pos + 1}.</span> {item.stem}</div>
          <div className="pp-choices">
            {item.choices.map((text, c) => (
              <button key={c} className={`pp-choice ${picks[pos] === c ? "picked" : ""}`} disabled={busy} onClick={() => pick(picks[pos] === c ? null : c)}>
                <span className="pp-choice-l">{LABELS[c]}</span>
                <span className="pp-choice-t">{text}</span>
              </button>
            ))}
          </div>
          <p className="pp-muted small">แตะคำตอบซ้ำเพื่อยกเลิก · เปลี่ยนคำตอบได้จนกว่าจะส่ง</p>
          {error && <div className="pp-error">{error}</div>}
        </div>
      </main>

      <footer className="pp-foot">
        <div className="pp-foot-in">
          <button className="pp-btn pp-btn-ghost" disabled={pos === 0} onClick={() => setPos(pos - 1)}><IconBack />ก่อนหน้า</button>
          {pos < total - 1
            ? <button className="pp-btn pp-btn-primary" onClick={() => setPos(pos + 1)}>ข้อต่อไป<IconNext /></button>
            : <button className="pp-btn pp-btn-gold" disabled={busy} onClick={finish}>ส่งข้อสอบ</button>}
          {pos < total - 1 && <button className="pp-btn pp-btn-gold" disabled={busy} onClick={finish}>ส่ง</button>}
        </div>
      </footer>
    </div>
  );
}
