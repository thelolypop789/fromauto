import { useEffect, useState } from "react";
import { rpc, thaiError, type Daily } from "./api";
import { IconBack, IconCheck, IconNext, IconX } from "./icons";

const LABELS = ["ก", "ข", "ค", "ง"];

// Ten questions a day, the same for everybody, free for every signed-in user.
export default function DailyQuiz({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<Daily | null>(null);
  const [pos, setPos] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    rpc<Daily>("prep_daily_quiz").then(d => {
      setData(d);
      const first = d.items.findIndex(i => i.picked == null);
      setPos(first < 0 ? d.items.length - 1 : first);
    }).catch(e => setError(thaiError(e)));
  }, []);

  if (error) return <div className="pp-card"><div className="pp-error">{error}</div><button className="pp-btn pp-btn-ghost" onClick={onBack}><IconBack />กลับ</button></div>;
  if (!data || pos === null) return <div className="pp-center"><div className="pp-spinner" /></div>;

  const item = data.items[pos];
  const answered = data.items.filter(i => i.picked != null).length;

  const pick = async (c: number) => {
    if (busy || item.picked != null) return;
    setBusy(true); setError("");
    try { setData(await rpc<Daily>("prep_daily_answer", { p_idx: item.idx, p_choice: c })); }
    catch (e) { setError(thaiError(e)); }
    setBusy(false);
  };

  return (
    <>
      <div className="pp-card pp-daily-head">
        <div>
          <b>ข้อสอบประจำวัน</b>
          <span className="pp-muted small"> · ทำแล้ว {answered}/{data.total} · ฟรีทุกบัญชี</span>
        </div>
        <span className="pp-daily-streak" title="วันที่ทำครบ 10 ข้อติดต่อกัน">🔥 {data.streak} วัน</span>
      </div>

      {data.done && (
        <div className="pp-card pp-daily-done">
          <h3>วันนี้ได้ {data.score}/{data.total} ข้อ</h3>
          <p className="pp-muted">ทำครบต่อเนื่อง {data.streak} วัน · วันนี้มีคนทำแล้ว {data.players.toLocaleString()} คน · พรุ่งนี้มีชุดใหม่ 10 ข้อ</p>
          <button className="pp-btn pp-btn-gold" onClick={onBack}><IconBack />กลับหน้าแรก</button>
        </div>
      )}

      <div className="pp-card pp-q">
        <div className="pp-q-stem"><span className="pp-q-no">{pos + 1}.</span> {item.stem}</div>
        <div className="pp-choices">
          {item.choices.map((text, c) => {
            const state = item.picked == null ? ""
              : c === item.answer ? "right" : c === item.picked ? "wrong" : "dim";
            return (
              <button key={c} className={`pp-choice ${state}`} disabled={busy || item.picked != null} onClick={() => pick(c)}>
                <span className="pp-choice-l">{LABELS[c]}</span>
                <span className="pp-choice-t">{text}</span>
                <span className="pp-choice-ico">{state === "right" ? <IconCheck size={22} /> : state === "wrong" ? <IconX size={22} /> : null}</span>
              </button>
            );
          })}
        </div>
        {item.picked != null && (
          <div className={`pp-explain ${item.correct ? "ok" : "bad"}`}>
            <div className="pp-explain-h">
              {item.correct ? <><IconCheck />ถูกต้อง</> : <><IconX />ยังไม่ถูก — คำตอบคือ {LABELS[item.answer ?? 0]}</>}
            </div>
            {item.explanation && <p>{item.explanation}</p>}
            {item.pct_correct != null && <p className="pp-muted small">คนที่ตอบข้อนี้วันนี้ ตอบถูก {item.pct_correct}%</p>}
          </div>
        )}
        {error && <div className="pp-error">{error}</div>}
        <div className="pp-row">
          <button className="pp-btn pp-btn-ghost" disabled={pos === 0} onClick={() => setPos(pos - 1)}><IconBack />ก่อนหน้า</button>
          <button className="pp-btn pp-btn-primary" disabled={pos >= data.items.length - 1 || item.picked == null} onClick={() => setPos(pos + 1)}>ข้อต่อไป<IconNext /></button>
        </div>
      </div>
    </>
  );
}
