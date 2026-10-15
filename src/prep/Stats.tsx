import { useEffect, useState } from "react";
import { GROUPS, rpc, thaiError, type Dashboard, type Me, type TopicStat } from "./api";

type Props = { me: Me; onWeakSet: () => void };

const MIN_N = 10; // first-try answers needed before a topic's accuracy is trusted

// Lower bound of the 95% Wilson interval: ranks topics without trusting tiny samples.
function wilsonLow(correct: number, n: number) {
  if (n === 0) return 0;
  const z = 1.96, p = correct / n;
  return (p + z * z / (2 * n) - z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)) / (1 + z * z / n);
}

const pct = (c: number, n: number) => (n ? Math.round((100 * c) / n) : 0);

function tone(p: number) {
  return p >= 75 ? "good" : p >= 60 ? "mid" : "low";
}

export default function Stats({ me, onWeakSet }: Props) {
  const [d, setD] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    rpc<Dashboard>("prep_dashboard").then(setD).catch(e => setError(thaiError(e)));
  }, []);

  if (error) return <div className="pp-error">{error}</div>;
  if (!d) return <div className="pp-spinner" />;

  const tried = d.topics.filter(t => t.n > 0);
  const trusted = tried.filter(t => t.n >= MIN_N);
  const strong = [...trusted].sort((a, b) => wilsonLow(b.correct, b.n) - wilsonLow(a.correct, a.n)).slice(0, 3);
  const weak = [...trusted].sort((a, b) => a.correct / a.n - b.correct / b.n).filter(t => !strong.includes(t)).slice(0, 3);

  const groups = Object.keys(GROUPS).map(g => {
    const ts = d.topics.filter(t => t.grp === g);
    return {
      g,
      n: ts.reduce((s, t) => s + t.n, 0),
      correct: ts.reduce((s, t) => s + t.correct, 0),
      seen: ts.reduce((s, t) => s + t.seen, 0),
      available: ts.reduce((s, t) => s + t.available, 0),
    };
  }).filter(x => x.available > 0 || x.n > 0);

  const firstTry = tried.reduce((s, t) => s + t.n, 0);
  const firstRight = tried.reduce((s, t) => s + t.correct, 0);
  const maxDay = Math.max(1, ...d.days.map(x => x.answered));
  const canMakeSet = me.plan === "paid" || me.free_sets_used < me.free_sets_limit;

  const TopicRow = ({ t }: { t: TopicStat }) => {
    const p = pct(t.correct, t.n);
    return (
      <div className="pp-trow">
        <div className="pp-trow-name">{t.name}</div>
        <div className="pp-bar thin"><div className={tone(p)} style={{ width: `${p}%` }} /></div>
        <div className="pp-trow-pct">{p}%</div>
        <div className="pp-muted small">
          {t.n < MIN_N ? `ข้อมูลยังน้อย ทำอีก ${MIN_N - t.n} ข้อผลจะแม่นขึ้น` : `ทำครั้งแรก ${t.n} ข้อ`} · เห็นแล้ว {t.seen}/{t.available}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="pp-kpis">
        <div className="pp-kpi"><b>{d.answered_total.toLocaleString()}</b><span>ข้อที่ทำทั้งหมด</span></div>
        <div className="pp-kpi"><b>{pct(firstRight, firstTry)}%</b><span>ถูกตั้งแต่ครั้งแรก</span></div>
        <div className="pp-kpi"><b>{d.seen}/{d.bank}</b><span>ข้อในคลังที่เคยเห็น</span></div>
        <div className="pp-kpi"><b>🔥 {d.streak}</b><span>วันติดต่อกัน</span></div>
        <div className="pp-kpi"><b>{d.sets_cleared}/{d.sets}</b><span>ชุดที่เคลียร์แล้ว</span></div>
        <div className="pp-kpi"><b>{d.stubborn}</b><span>ข้อดื้อ (ผิด ≥ 2 ครั้ง)</span></div>
      </div>

      {firstTry === 0 ? (
        <div className="pp-card pp-empty"><p className="pp-muted">ทำข้อสอบสักชุดก่อน แล้วผลวิเคราะห์จะขึ้นที่นี่</p></div>
      ) : (
        <>
          <div className="pp-two">
            <div className="pp-card">
              <h3>💪 จุดแข็ง</h3>
              {strong.length ? strong.map(t => <TopicRow key={t.code} t={t} />)
                : <p className="pp-muted">ทำหมวดละอย่างน้อย {MIN_N} ข้อเพื่อดูจุดแข็ง</p>}
            </div>
            <div className="pp-card">
              <h3>🎯 ควรทบทวน</h3>
              {weak.length ? weak.map(t => <TopicRow key={t.code} t={t} />)
                : <p className="pp-muted">ทำหมวดละอย่างน้อย {MIN_N} ข้อเพื่อดูจุดอ่อน</p>}
              {d.still_wrong > 0 && canMakeSet && (
                <button className="pp-btn pp-btn-primary" onClick={onWeakSet}>สร้างชุด "เน้นจุดอ่อน" ({d.still_wrong} ข้อที่ยังผิด)</button>
              )}
            </div>
          </div>

          <div className="pp-card">
            <h3>ภาพรวมรายวิชา (เกณฑ์ผ่าน 60%)</h3>
            {groups.map(x => {
              const p = pct(x.correct, x.n);
              return (
                <div key={x.g} className="pp-trow">
                  <div className="pp-trow-name"><b>{GROUPS[x.g]}</b></div>
                  <div className="pp-bar thin pass"><div className={tone(p)} style={{ width: `${p}%` }} /></div>
                  <div className="pp-trow-pct">{x.n ? `${p}%` : "–"}</div>
                  <div className="pp-muted small">ทำครั้งแรก {x.n} ข้อ · เห็นแล้ว {x.seen}/{x.available}</div>
                </div>
              );
            })}
          </div>

          <div className="pp-card">
            <h3>ทุกหมวดที่ทำ</h3>
            {[...tried].sort((a, b) => a.correct / a.n - b.correct / b.n).map(t => <TopicRow key={t.code} t={t} />)}
          </div>
        </>
      )}

      <div className="pp-card">
        <h3>14 วันล่าสุด</h3>
        <div className="pp-days">
          {d.days.map(x => (
            <div key={x.day} className="pp-day" title={`${x.day}: ${x.answered} ข้อ`}>
              <div className="pp-day-bar" style={{ height: `${(100 * x.answered) / maxDay}%` }}>
                <div style={{ height: `${x.answered ? (100 * x.correct) / x.answered : 0}%` }} />
              </div>
              <span>{Number(x.day.slice(8))}</span>
            </div>
          ))}
        </div>
        <p className="pp-muted small">แท่งสีเข้ม = ตอบถูก · รวมทุกรอบที่ทำซ้ำ</p>
      </div>
    </>
  );
}
