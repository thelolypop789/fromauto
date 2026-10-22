import { useEffect, useState } from "react";
import { PASS_PCT, rpc, type Scorecard } from "./api";

const TITLE = { A: "ภาค ก", B: "ภาค ข" } as const;
const pctOf = (score: number, total: number) => Math.round((100 * score) / Math.max(1, total));
const day = (s: string) => new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "short" });

// Scores collected per section: the best mock score of each subject, added up per ภาค, against the 60% line.
export default function MockScorecard() {
  const [d, setD] = useState<Scorecard | null>(null);
  useEffect(() => { rpc<Scorecard>("prep_mock_scorecard").then(setD).catch(() => setD(null)); }, []);
  if (!d) return null;
  const any = d.sections.some(s => s.done > 0);

  return (
    <div className="pp-card pp-sc">
      <h3>คะแนนสะสมแต่ละภาค</h3>
      <p className="pp-muted small">นำคะแนนดีที่สุดของแต่ละวิชามารวมเป็นคะแนนภาค · เกณฑ์อ้างอิง {PASS_PCT}% ต่อภาค</p>
      <div className="pp-sc-secs">
        {d.sections.map(s => {
          const p = pctOf(s.best_sum, s.questions), full = s.done === s.subjects_n;
          return (
            <div key={s.section} className={`pp-sc-sec ${s.done ? (p >= PASS_PCT ? "ok" : "low") : "none"}`}>
              <span>{TITLE[s.section]}</span>
              <b>{s.done ? s.best_sum : "–"}<small>/{s.questions}</small></b>
              <em>{s.done ? `${p}%${full ? (p >= PASS_PCT ? " · ถึงเกณฑ์" : " · ยังไม่ถึงเกณฑ์") : ""}` : "ยังไม่ได้สอบ"}</em>
              <small className="pp-muted">สอบแล้ว {s.done}/{s.subjects_n} วิชา{!full && s.done ? " (คะแนนยังไม่ครบภาค)" : ""}</small>
            </div>
          );
        })}
      </div>
      {!any && <p className="pp-muted small">ยังไม่มีคะแนน เริ่มสอบวิชาไหนก่อนก็ได้ คะแนนจะสะสมที่นี่</p>}
      {any && d.sections.map(s => (
        <div key={s.section} className="pp-sc-list">
          {s.subjects.filter(x => x.tries > 0).map(x => (
            <div key={x.code} className="pp-sc-row">
              <div className="pp-sc-name">
                <span>{x.name.replace(/^ภาค [กข]: /, "")}</span>
                <small className="pp-muted">ล่าสุด {x.last}/{x.questions}{x.last_at ? ` · ${day(x.last_at)}` : ""} · สอบ {x.tries} ครั้ง</small>
              </div>
              {x.history.length > 1 && (
                <div className="pp-sc-spark" role="img" aria-label={`คะแนน ${x.history.length} ครั้งล่าสุด: ${x.history.join(", ")}%`}>
                  {x.history.map((h, i) => <i key={i} className={h >= PASS_PCT ? "ok" : ""} style={{ height: `${Math.max(8, h)}%` }} title={`${h}%`} />)}
                </div>
              )}
              <b className={pctOf(x.best ?? 0, x.questions) >= PASS_PCT ? "ok" : "low"}>{x.best}<small>/{x.questions}</small></b>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
