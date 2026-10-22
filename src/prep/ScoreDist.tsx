import { useEffect, useState } from "react";
import { rpc, track, type ScoreDistData } from "./api";

// "How did everyone else do?" under a result: rank, average, best, a histogram with the user's bar in gold, and the
// user's own recent scores. kind 'daily' = today's daily quiz; kind 'mock' = this mock attempt vs. the subject.
export default function ScoreDist({ kind, attemptId }: { kind: "daily" | "mock"; attemptId?: string }) {
  const [d, setD] = useState<ScoreDistData | null>(null);
  const [hot, setHot] = useState<number | null>(null);

  useEffect(() => {
    rpc<ScoreDistData | null>("prep_score_dist", { p_kind: kind, p_key: attemptId ?? null }).then(r => { setD(r); if (r) track("scoredist_view"); }).catch(() => setD(null));
  }, [kind, attemptId]);

  if (!d) return null;
  const pct = d.kind === "mock";
  const fmt = (v: number) => pct ? `${v}%` : `${v}`;
  const of = pct ? "" : `/${d.total}`;
  const label = (i: number) => pct ? (i === 10 ? "100" : `${i * 10}`) : `${i}`;
  const range = (i: number) => pct ? (i === 10 ? "100%" : `${i * 10}–${i * 10 + 9}%`) : `${i} คะแนน`;
  const myBar = pct ? Math.min(10, Math.floor(d.mine / 10)) : d.mine;
  const diff = d.avg == null ? 0 : Math.round((d.mine - d.avg) * 10) / 10;
  const max = Math.max(1, ...(d.buckets ?? []));

  return (
    <div className="pp-card pp-sd">
      <h3>{pct ? "เทียบกับผู้สอบวิชานี้" : "สถิติข้อสอบประจำวันนี้"}</h3>
      <p className="pp-muted small">{pct ? "ผู้สอบ" : "ผู้ทำ"} {d.players.toLocaleString("th-TH")} คน</p>

      {d.buckets == null || d.rank == null || d.avg == null || d.best == null ? (
        <p className="pp-muted small">ยังมีผู้ทำไม่ถึง 3 คน กลับมาดูอันดับอีกครั้งภายหลัง</p>
      ) : (
        <>
          <div className="pp-sd-tiles">
            <div className="me"><span>อันดับของคุณ</span><b>{d.rank}</b><small>จาก {d.players.toLocaleString("th-TH")} คน</small></div>
            <div><span>ค่าเฉลี่ยผู้ทำ</span><b>{fmt(d.avg)}</b><small>{of ? `${of} คะแนน` : "ถูกเฉลี่ย"}</small></div>
            <div><span>คะแนนสูงสุด</span><b>{fmt(d.best)}</b><small>{of ? `${of} คะแนน` : "ของผู้ทำ"}</small></div>
          </div>
          <div className={`pp-sd-note ${diff > 0 ? "up" : diff < 0 ? "down" : ""}`}>
            {diff > 0 ? `↗ คะแนนครั้งนี้สูงกว่าค่าเฉลี่ย ${fmt(diff)}` : diff < 0 ? `↘ คะแนนครั้งนี้ต่ำกว่าค่าเฉลี่ย ${fmt(-diff)}` : "คะแนนครั้งนี้เท่ากับค่าเฉลี่ย"}
          </div>

          <div className="pp-sd-chart" role="img" onMouseLeave={() => setHot(null)}
            aria-label={`จำนวนคนตามคะแนน คุณอยู่ช่วง ${range(myBar)} อันดับ ${d.rank} จาก ${d.players} คน`}>
            {d.buckets.map((n, i) => (
              <div key={i} className={`pp-sd-col ${i === myBar ? "me" : ""} ${hot === i ? "hot" : ""}`}
                onMouseEnter={() => setHot(i)} onClick={() => setHot(i)}>
                <span className="pp-sd-n">{n > 0 ? n : ""}</span>
                <div className="pp-sd-bar" style={{ height: `${n > 0 ? Math.max(4, (100 * n) / max) : 0}%` }} />
                <span className="pp-sd-x">{label(i)}</span>
              </div>
            ))}
            {hot !== null && <div className="pp-sd-tip" style={{ left: `${((hot + 0.5) / d.buckets.length) * 100}%` }}>
              {range(hot)}: <b>{d.buckets[hot]}</b> คน{hot === myBar ? " · คุณอยู่ตรงนี้" : ""}</div>}
          </div>
          <p className="pp-sd-cap">จำนวนคนตามคะแนน{pct ? " (%)" : ""} · <b>แท่งสีทอง</b> = คะแนนของคุณ</p>
          <p className="pp-muted small">
            {pct ? "เทียบคะแนนครั้งนี้กับคะแนนที่ดีที่สุดของผู้สอบคนอื่น (ข้อสอบสุ่มตามสัดส่วนเดียวกัน)" : "นับเฉพาะคนที่ทำครบ 10 ข้อ"}
            {" · คะแนนเท่ากันได้อันดับเดียวกัน · อันดับเปลี่ยนได้เมื่อมีผู้ทำเพิ่ม"}
          </p>
          <details className="pp-chart-table">
            <summary className="small pp-muted">ดูเป็นตาราง</summary>
            <div className="pp-guide-table">{d.buckets.map((n, i) => <div key={i}><span>{range(i)}</span><b>{n} คน</b></div>)}</div>
          </details>
        </>
      )}

      {d.history.length > 0 && (
        <>
          <h4 className="pp-sd-h4">{pct ? "คะแนนวิชานี้ของคุณ" : "คะแนนของคุณ 7 วันล่าสุด"}</h4>
          <div className="pp-sd-hist">
            {d.history.map((h, i) => (
              <div key={i} className={h.current ? "cur" : ""}>
                <span>{h.label}</span><b>{fmt(h.value)}<small>{of}</small></b>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
