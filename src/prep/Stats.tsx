import { useEffect, useState, type ReactNode } from "react";
import { GROUPS, LEVELS, PASS_PCT, SECTIONS, rpc, thaiError, type Dashboard, type Insights, type Me, type TopicStat } from "./api";
import type { Preset } from "./CreateSet";
import { IconCheck, IconTarget, IconX } from "./icons";
import Readiness from "./Readiness";

type Props = { me: Me; onPractice: (preset?: Preset) => void };

const MIN_N = 10; // first-try answers needed before a topic's accuracy is trusted

// Lower bound of the 95% Wilson interval: ranks topics without trusting tiny samples.
function wilsonLow(correct: number, n: number) {
  if (n === 0) return 0;
  const z = 1.96, p = correct / n;
  return (p + z * z / (2 * n) - z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)) / (1 + z * z / n);
}

const pct = (c: number, n: number) => (n ? Math.round((100 * c) / n) : 0);
const tone = (p: number) => (p >= 75 ? "good" : p >= PASS_PCT ? "mid" : "low");
const DOW = ["", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];
const BANDS: Record<string, string> = { easy: "ข้อง่าย", medium: "ปานกลาง", hard: "ข้อยาก", new: "ยังไม่มีสถิติ" };
const fmtDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" });

// ---------- small chart pieces ----------

type Bar = { key: string; label: string; value: number; inner?: number; tip: string };

// Vertical bars; optional inner (darker) part = correct. Hover/tap shows the exact numbers.
function Bars({ data, height = 130, every = 1 }: { data: Bar[]; height?: number; every?: number }) {
  const [hi, setHi] = useState<number | null>(null);
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div className="pp-chart" onMouseLeave={() => setHi(null)}>
      <div className="pp-tip" aria-live="polite">{hi != null ? data[hi].tip : " "}</div>
      <div className="pp-days" style={{ height }}>
        {data.map((d, i) => (
          <button key={d.key} className={`pp-day ${hi === i ? "hi" : ""}`} onMouseEnter={() => setHi(i)} onFocus={() => setHi(i)}
            onClick={() => setHi(i)} aria-label={d.tip}>
            <div className="pp-day-bar" style={{ height: `${(100 * d.value) / max}%` }}>
              <div style={{ height: `${d.inner == null ? 100 : d.value ? (100 * d.inner) / d.value : 0}%` }} />
            </div>
            <span>{i % every === 0 ? d.label : " "}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Accuracy over time (single series, 0–100%) with the pass line.
function Line({ points }: { points: { label: string; value: number | null; tip: string }[] }) {
  const [hi, setHi] = useState<number | null>(null);
  const W = typeof window !== "undefined" && window.innerWidth < 700 ? 340 : 640, H = 200, P = 10;
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, points.length - 1);
  const y = (v: number) => H - P - (v / 100) * (H - 2 * P);
  const segs: string[] = [];
  let cur = "";
  points.forEach((p, i) => {
    if (p.value == null) { if (cur) segs.push(cur); cur = ""; return; }
    cur += `${cur ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
  });
  if (cur) segs.push(cur);
  return (
    <div className="pp-chart" onMouseLeave={() => setHi(null)}>
      <div className="pp-tip" aria-live="polite">{hi != null ? points[hi].tip : " "}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="pp-line" role="img" aria-label="ความแม่นยำรายสัปดาห์">
        {[0, 50, 100].map(v => <line key={v} x1={P} x2={W - P} y1={y(v)} y2={y(v)} className="pp-grid-l" />)}
        <line x1={P} x2={W - P} y1={y(PASS_PCT)} y2={y(PASS_PCT)} className="pp-pass-l" />
        <text x={P + 2} y={y(PASS_PCT) - 5} className="pp-pass-t">เกณฑ์ผ่าน {PASS_PCT}%</text>
        {segs.map((d, i) => <path key={i} d={d} className="pp-line-p" />)}
        {hi != null && <line x1={x(hi)} x2={x(hi)} y1={P} y2={H - P} className="pp-cross" />}
        {points.map((p, i) => p.value != null && (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={hi === i ? 6 : 4.5} className="pp-line-dot" />
        ))}
        {points.map((_, i) => (
          <rect key={`h${i}`} x={x(i) - (W - 2 * P) / points.length / 2} y={0} width={(W - 2 * P) / points.length} height={H}
            fill="transparent" onMouseEnter={() => setHi(i)} onClick={() => setHi(i)} />
        ))}
      </svg>
      <div className="pp-line-x">{points.map((p, i) => <span key={i}>{p.label}</span>)}</div>
    </div>
  );
}

// Horizontal accuracy bar against the pass line.
function Meter({ label, c, n, sub, action }: { label: ReactNode; c: number; n: number; sub?: string; action?: ReactNode }) {
  const p = pct(c, n);
  return (
    <div className="pp-trow">
      <div className="pp-trow-name">{label}</div>
      <div className="pp-bar thin pass" title={n ? `${c}/${n} ข้อ = ${p}%` : "ยังไม่มีข้อมูล"}><div className={tone(p)} style={{ width: `${n ? p : 0}%` }} /></div>
      <div className="pp-trow-pct">{n ? `${p}%` : "–"}</div>
      <div className="pp-muted small pp-trow-meta">{sub}{action}</div>
    </div>
  );
}

function Verdict({ p, n }: { p: number; n: number }) {
  if (n < MIN_N) return <span className="pp-verdict wait">ข้อมูลยังน้อย</span>;
  if (p >= 75) return <span className="pp-verdict ok"><IconCheck size={14} />พร้อมสอบ</span>;
  if (p >= PASS_PCT) return <span className="pp-verdict mid"><IconCheck size={14} />ผ่านเกณฑ์</span>;
  return <span className="pp-verdict low"><IconX size={14} />ต่ำกว่าเกณฑ์</span>;
}

// ---------- page ----------

type Tab = "overview" | "sections" | "trend" | "review";

export default function Stats({ me, onPractice }: Props) {
  const [d, setD] = useState<Dashboard | null>(null);
  const [ins, setIns] = useState<Insights | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    Promise.all([rpc<Dashboard>("prep_dashboard"), rpc<Insights>("prep_insights")])
      .then(([a, b]) => { setD(a); setIns(b); })
      .catch(e => setError(thaiError(e)));
  }, []);

  if (error) return <div className="pp-error">{error}</div>;
  if (!d || !ins) return <div className="pp-spinner" />;

  const canMakeSet = me.plan === "paid" || me.free_sets_used < me.free_sets_limit;
  const tried = d.topics.filter(t => t.n > 0);
  const trusted = tried.filter(t => t.n >= MIN_N);
  const strong = [...trusted].sort((a, b) => wilsonLow(b.correct, b.n) - wilsonLow(a.correct, a.n)).slice(0, 3);
  const weak = [...trusted].sort((a, b) => a.correct / a.n - b.correct / b.n).filter(t => !strong.includes(t)).slice(0, 3);
  const firstTry = tried.reduce((s, t) => s + t.n, 0);
  const firstRight = tried.reduce((s, t) => s + t.correct, 0);
  const practiceBtn = (t: TopicStat) => canMakeSet && (
    <button className="pp-link small" onClick={() => onPractice({ topics: [t.code] })}>ฝึกหมวดนี้ →</button>
  );
  const TopicRow = ({ t }: { t: TopicStat }) => (
    <Meter label={t.name} c={t.correct} n={t.n}
      sub={`${t.n < MIN_N ? `ทำอีก ${MIN_N - t.n} ข้อผลจะแม่นขึ้น` : `ทำครั้งแรก ${t.n} ข้อ`} · เห็นแล้ว ${t.seen}/${t.available} `}
      action={practiceBtn(t)} />
  );

  const m = ins.mastery;
  const unseen = Math.max(0, d.bank - m.seen);
  const stack = [
    { k: "mastered", label: "ทำได้ตั้งแต่ครั้งแรก", n: m.mastered, cls: "s-ok" },
    { k: "recovered", label: "เคยผิด แก้ได้แล้ว", n: m.recovered, cls: "s-mid" },
    { k: "wrong", label: "ยังตอบผิดอยู่", n: m.still_wrong, cls: "s-bad" },
  ];

  const tabs: [Tab, string][] = [["overview", "ภาพรวม"], ["sections", "ภาค / หมวด"], ["trend", "แนวโน้ม"], ["review", "ทบทวน"]];

  return (
    <>
      <div className="pp-h"><h2>วิเคราะห์ผล</h2><span className="pp-muted small">ใช้คำตอบครั้งแรกของแต่ละข้อ</span></div>
      <div className="pp-seg pp-subtabs" role="tablist">
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === "overview" && (
        <>
          <Readiness onPractice={canMakeSet ? onPractice : undefined} />
          <div className="pp-kpis">
            <div className="pp-kpi"><b>{d.answered_total.toLocaleString()}</b><span>ข้อที่ทำทั้งหมด (รวมทำซ้ำ)</span></div>
            <div className="pp-kpi"><b>{firstTry ? `${pct(firstRight, firstTry)}%` : "–"}</b><span>ถูกตั้งแต่ครั้งแรก</span></div>
            <div className="pp-kpi"><b>{d.seen}<small>/{d.bank}</small></b><span>ข้อในคลังที่เคยเห็น</span></div>
            <div className="pp-kpi"><b>{d.streak}</b><span>วันติดต่อกัน</span></div>
            <div className="pp-kpi"><b>{ins.round_totals.all}</b><span>รอบที่ส่งแล้ว ({ins.round_totals.wrong} รอบข้อผิด)</span></div>
            <div className="pp-kpi"><b>{d.sets_cleared}<small>/{d.sets}</small></b><span>ชุดที่เคลียร์แล้ว</span></div>
          </div>

          <div className="pp-ready">
            {(["A", "B"] as const).map(sec => {
              const s = ins.sections.find(x => x.section === sec);
              const n = s?.n ?? 0, c = s?.correct ?? 0, p = pct(c, n);
              return (
                <div key={sec} className="pp-card pp-ready-c">
                  <div className="pp-ready-h"><span className="pp-sec-badge sm">{SECTIONS[sec].short}</span><b>{SECTIONS[sec].name}</b></div>
                  <div className="pp-ready-n"><span className="pp-big">{n ? `${p}%` : "–"}</span><Verdict p={p} n={n} /></div>
                  <div className="pp-bar thin pass"><div className={tone(p)} style={{ width: `${n ? p : 0}%` }} /></div>
                  <div className="pp-ready-g">
                    <span><b>{s?.seen ?? 0}</b>/{s?.available ?? 0}<br />เคยเห็น</span>
                    <span><b>{s?.mastered ?? 0}</b><br />ทำได้แน่น</span>
                    <span><b>{s?.still_wrong ?? 0}</b><br />ยังผิดอยู่</span>
                  </div>
                  {canMakeSet && <button className="pp-btn pp-btn-ghost" onClick={() => onPractice({ section: sec })}>ฝึก{SECTIONS[sec].short}</button>}
                </div>
              );
            })}
          </div>

          <div className="pp-card">
            <h3>สถานะความรู้ในคลัง {d.bank.toLocaleString()} ข้อ</h3>
            <div className="pp-stack" role="img" aria-label={stack.map(x => `${x.label} ${x.n}`).join(", ") + `, ยังไม่เคยเห็น ${unseen}`}>
              {stack.map(x => x.n > 0 && <div key={x.k} className={x.cls} style={{ flexGrow: x.n }} title={`${x.label}: ${x.n} ข้อ`} />)}
              {unseen > 0 && <div className="s-none" style={{ flexGrow: unseen }} title={`ยังไม่เคยเห็น: ${unseen} ข้อ`} />}
            </div>
            <div className="pp-legend">
              {stack.map(x => <span key={x.k}><i className={x.cls} />{x.label} <b>{x.n}</b></span>)}
              <span><i className="s-none" />ยังไม่เคยเห็น <b>{unseen}</b></span>
            </div>
          </div>

          {firstTry === 0 ? (
            <div className="pp-card pp-empty"><div className="pp-empty-ico"><IconTarget size={30} /></div><p className="pp-muted">ทำข้อสอบสักชุดก่อน แล้วผลวิเคราะห์จะขึ้นที่นี่</p></div>
          ) : (
            <div className="pp-two">
              <div className="pp-card">
                <h3>จุดแข็ง</h3>
                {strong.length ? strong.map(t => <TopicRow key={t.code} t={t} />)
                  : <p className="pp-muted">ทำหมวดละอย่างน้อย {MIN_N} ข้อเพื่อดูจุดแข็ง</p>}
              </div>
              <div className="pp-card">
                <h3>ควรทบทวน</h3>
                {weak.length ? weak.map(t => <TopicRow key={t.code} t={t} />)
                  : <p className="pp-muted">ทำหมวดละอย่างน้อย {MIN_N} ข้อเพื่อดูจุดอ่อน</p>}
              </div>
            </div>
          )}
        </>
      )}

      {tab === "sections" && (
        <>
          {(["A", "B"] as const).map(sec => (
            <div key={sec} className="pp-card">
              <div className="pp-ready-h"><span className="pp-sec-badge sm">{SECTIONS[sec].short}</span><b>{SECTIONS[sec].name}</b></div>
              {SECTIONS[sec].groups.map(g => {
                const ts = d.topics.filter(t => t.grp === g && (t.available > 0 || t.n > 0));
                if (!ts.length) return null;
                const n = ts.reduce((s, t) => s + t.n, 0), c = ts.reduce((s, t) => s + t.correct, 0);
                return (
                  <details key={g} className="pp-acc">
                    <summary>
                      <Meter label={<b>{GROUPS[g]}</b>} c={c} n={n}
                        sub={`${ts.length} หมวด · ทำครั้งแรก ${n} ข้อ · เห็นแล้ว ${ts.reduce((s, t) => s + t.seen, 0)}/${ts.reduce((s, t) => s + t.available, 0)}`} />
                    </summary>
                    <div className="pp-acc-body">{ts.map(t => <TopicRow key={t.code} t={t} />)}</div>
                  </details>
                );
              })}
            </div>
          ))}

          <div className="pp-two">
            <div className="pp-card">
              <h3>ตามระดับความคิด</h3>
              <p className="pp-muted small">จำ → เข้าใจ → ประยุกต์ใช้ → วิเคราะห์</p>
              {ins.levels.length ? ins.levels.map(l => <Meter key={l.level} label={LEVELS[l.level] ?? l.level} c={l.correct} n={l.n} sub={`${l.n} ข้อ`} />)
                : <p className="pp-muted">ยังไม่มีข้อมูล</p>}
            </div>
            <div className="pp-card">
              <h3>ตามความยากของข้อ</h3>
              <p className="pp-muted small">ความยากวัดจากผู้ใช้ทุกคน (ข้อที่มีคนทำ ≥ 5 คน)</p>
              {ins.difficulty.length ? ins.difficulty.map(b => <Meter key={b.band} label={BANDS[b.band]} c={b.correct} n={b.n} sub={`${b.n} ข้อ`} />)
                : <p className="pp-muted">ยังไม่มีข้อมูล</p>}
            </div>
          </div>
        </>
      )}

      {tab === "trend" && (
        <>
          <div className="pp-card">
            <h3>ความแม่นยำรายสัปดาห์ (8 สัปดาห์)</h3>
            <Line points={ins.weeks.map(w => ({
              label: fmtDay(w.week), value: w.n ? pct(w.correct, w.n) : null,
              tip: w.n ? `สัปดาห์ ${fmtDay(w.week)}: ถูกครั้งแรก ${w.correct}/${w.n} = ${pct(w.correct, w.n)}%` : `สัปดาห์ ${fmtDay(w.week)}: ไม่มีข้อใหม่`,
            }))} />
          </div>
          <div className="pp-two">
            <div className="pp-card">
              <h3>จำนวนข้อรายสัปดาห์</h3>
              <Bars height={110} data={ins.weeks.map(w => ({ key: w.week, label: fmtDay(w.week), value: w.answered, tip: `สัปดาห์ ${fmtDay(w.week)}: ${w.answered} ข้อ` }))} every={2} />
            </div>
            <div className="pp-card">
              <h3>30 วันล่าสุด</h3>
              <Bars height={110} every={5} data={ins.days.map(x => ({
                key: x.day, label: String(Number(x.day.slice(8))), value: x.answered, inner: x.correct,
                tip: `${fmtDay(x.day)}: ${x.answered} ข้อ · ถูก ${x.correct}`,
              }))} />
              <p className="pp-muted small">ส่วนสีเข้ม = ตอบถูก (รวมทำซ้ำ)</p>
            </div>
          </div>
          <div className="pp-two">
            <div className="pp-card">
              <h3>วันในสัปดาห์ที่ฝึก</h3>
              <Bars height={100} data={[1, 2, 3, 4, 5, 6, 7].map(k => {
                const w = ins.weekdays.find(x => x.dow === k);
                return { key: String(k), label: DOW[k], value: w?.answered ?? 0, inner: w?.correct ?? 0, tip: `${DOW[k]}: ${w?.answered ?? 0} ข้อ · ถูก ${pct(w?.correct ?? 0, w?.answered ?? 0)}%` };
              })} />
            </div>
            <div className="pp-card">
              <h3>ช่วงเวลาที่ฝึก</h3>
              <Bars height={100} every={6} data={Array.from({ length: 24 }, (_, h) => {
                const x = ins.hours.find(r => r.hour === h);
                return { key: String(h), label: `${h}`, value: x?.n ?? 0, inner: x?.correct ?? 0, tip: `${h}:00–${h}:59 น.: ${x?.n ?? 0} ข้อ · ถูก ${pct(x?.correct ?? 0, x?.n ?? 0)}%` };
              })} />
              <p className="pp-muted small">นับตามเวลาที่เริ่มรอบ</p>
            </div>
          </div>
          <div className="pp-card">
            <h3>ประวัติการส่งรอบ (30 รอบล่าสุด)</h3>
            {ins.rounds.length === 0 ? <p className="pp-muted">ยังไม่มีรอบที่ส่ง</p> : (
              <div className="pp-rounds">
                {[...ins.rounds].reverse().map((r, i) => {
                  const p = pct(r.correct, r.total);
                  return (
                    <div key={i} className="pp-round">
                      <div className="pp-round-t"><b>{r.title}</b><span className="pp-muted small">{r.mode === "wrong" ? "รอบข้อผิด" : `รอบที่ ${r.round_no}`} · {new Date(r.at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</span></div>
                      <div className="pp-bar thin pass"><div className={tone(p)} style={{ width: `${p}%` }} /></div>
                      <span className="pp-round-s">{r.correct}/{r.total}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {tab === "review" && (
        <>
          <div className="pp-kpis">
            <div className="pp-kpi"><b>{m.still_wrong}</b><span>ข้อที่ยังตอบผิด</span></div>
            <div className="pp-kpi"><b>{m.stubborn}</b><span>ข้อดื้อ (ผิด ≥ 2 ครั้ง)</span></div>
            <div className="pp-kpi"><b>{m.recovered}</b><span>เคยผิด แก้ได้แล้ว</span></div>
          </div>
          {canMakeSet && m.still_wrong > 0 && (
            <button className="pp-btn pp-btn-primary pp-wide" onClick={() => onPractice({ mode: "weak", topics: tried.map(t => t.code) })}>
              สร้างชุด "เน้นจุดอ่อน" จากหมวดที่เคยทำ
            </button>
          )}
          <div className="pp-card">
            <h3>ข้อที่ผิดบ่อยที่สุด</h3>
            {ins.stubborn_list.length === 0 ? <p className="pp-muted">ยังไม่มีข้อที่ตอบผิด</p> : ins.stubborn_list.map(s => (
              <div key={s.id} className="pp-stub">
                <div className="pp-stub-n"><b>{s.wrong}</b><span>ครั้ง</span></div>
                <div className="pp-stub-t">
                  <div>{s.stem}</div>
                  <div className="pp-muted small">{s.topic} · ทำ {s.seen} ครั้ง · {s.last_correct ? "ล่าสุดตอบถูกแล้ว" : "ล่าสุดยังผิด"}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="pp-card">
            <h3>หมวดที่ควรทบทวน (เรียงจากคะแนนต่ำ)</h3>
            {tried.length === 0 ? <p className="pp-muted">ยังไม่มีข้อมูล</p>
              : [...tried].sort((a, b) => a.correct / a.n - b.correct / b.n).slice(0, 8).map(t => <TopicRow key={t.code} t={t} />)}
          </div>
        </>
      )}
    </>
  );
}
