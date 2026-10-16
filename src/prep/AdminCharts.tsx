import { useEffect, useState } from "react";
import { rpc, thaiError } from "./api";
import { BarList, ColumnChart, Delta } from "./ChartParts";
import { nf } from "./chartFormat";

type Totals = { new_users: number; active_users: number; answers: number; revenue: number };
type Charts = {
  days: number;
  totals: Totals;
  previous: Totals;
  series: { day: string; new_users: number; active_users: number; answers: number; revenue: number }[];
  funnel: { step: string; n: number }[];
  sources: { src: string; users: number; paid: number }[];
  retention: { d1_users: number; d1_back: number; d7_users: number; d7_back: number };
  weak_topics: { topic: string; n: number; pct: number }[];
  tricky: { id: number; topic: string; stem: string; n: number; pct: number; wrong_choice: string | null; wrong_pct: number }[];
  mock: { code: string; name: string; started: number; submitted: number; auto: number; avg_pct: number | null }[];
};


const pct = (a: number, b: number) => (b > 0 ? Math.round((100 * a) / b) : null);

export default function AdminCharts() {
  const [days, setDays] = useState(30);
  const [c, setC] = useState<Charts | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    rpc<Charts>("prep_admin_charts", { p_days: days }).then(r => { if (live) { setC(r); setError(""); } }).catch(e => { if (live) setError(thaiError(e)); });
    return () => { live = false; };
  }, [days]);

  const picker = (
    <div className="pp-seg">
      {[7, 30, 90].map(n => <button key={n} className={days === n ? "on" : ""} onClick={() => setDays(n)}>{n} วัน</button>)}
    </div>
  );
  if (error) return <>{picker}<div className="pp-error">{error}</div></>;
  if (!c) return <>{picker}<div className="pp-spinner" /></>;

  const ds = c.series.map(s => s.day);
  const first = c.funnel[0]?.n ?? 0;
  const r = c.retention;
  const d1 = pct(r.d1_back, r.d1_users), d7 = pct(r.d7_back, r.d7_users);
  const noData = first === 0 && c.series.every(s => s.answers === 0);

  return (
    <>
      {picker}
      <p className="pp-muted small">ช่วง {c.days} วันล่าสุด (เวลาไทย) · เก็บเฉพาะจำนวนและแหล่งที่มา ไม่เก็บเนื้อหาที่ผู้ใช้พิมพ์</p>
      {noData && <div className="pp-card pp-empty"><p className="pp-muted">ยังไม่มีข้อมูลในช่วงนี้</p></div>}

      <div className="pp-card">
        <h3>เทียบกับ {c.days} วันก่อนหน้า</h3>
        <div className="pp-kpis">
          {([["คนที่เข้ามาใช้", "active_users", "คน"], ["สมาชิกใหม่", "new_users", "คน"], ["ข้อที่ทำ", "answers", "ข้อ"], ["รายได้", "revenue", "บาท"]] as const).map(([l, k, u]) => (
            <div key={k} className="pp-kpi"><b>{nf(c.totals[k])}</b><span>{l} ({u})</span>
              <small className="pp-muted"><Delta cur={c.totals[k]} prev={c.previous[k]} /> · ก่อนหน้า {nf(c.previous[k])}</small></div>
          ))}
        </div>
        <p className="pp-muted small">“คนที่เข้ามาใช้” นับคนไม่ซ้ำตลอดช่วง ช่วงก่อนหน้ายาวเท่ากัน ถ้าระบบเพิ่งเริ่มเก็บข้อมูลจะยังเป็น 0</p>
      </div>

      <div className="pp-card">
        <h3>แต่ละวัน</h3>
        <ColumnChart title="คนที่เข้ามาใช้" unit="คน" days={ds} values={c.series.map(s => s.active_users)} />
        <ColumnChart title="สมาชิกใหม่" unit="คน" days={ds} values={c.series.map(s => s.new_users)} />
        <ColumnChart title="ข้อที่ทำ" unit="ข้อ" days={ds} values={c.series.map(s => s.answers)} />
        <ColumnChart title="รายได้" unit="บาท" days={ds} values={c.series.map(s => s.revenue)} />
      </div>

      <div className="pp-card">
        <h3>จากสมัครถึงซื้อ</h3>
        <p className="pp-muted small">นับเฉพาะคนที่สมัครในช่วงนี้ · “เปิดหน้าซื้อ” เริ่มนับเมื่อมีระบบเก็บข้อมูล คนที่เคยส่งสลิปนับให้ด้วย</p>
        <BarList rows={c.funnel.map(f => ({ label: f.step, value: f.n, note: `${nf(f.n)}${first ? ` · ${pct(f.n, first)}%` : ""}` }))} />
      </div>

      <div className="pp-card">
        <h3>มาจากไหน</h3>
        {c.sources.length === 0 ? <p className="pp-muted small">ยังไม่มีสมาชิกใหม่ในช่วงนี้</p> : (
          <>
            <p className="pp-muted small">ใส่ ?src=ชื่อ ท้ายลิงก์ที่โพสต์ เช่น <b>/prep?src=fb-post1</b> · ตัวเลขคือ สมัครกี่คน / ซื้อกี่คน</p>
            <BarList rows={c.sources.map(s => ({ label: s.src, value: s.users, note: `${nf(s.users)} คน · ซื้อ ${nf(s.paid)}` }))} />
          </>
        )}
      </div>

      <div className="pp-card">
        <h3>กลับมาใช้ซ้ำ</h3>
        <div className="pp-kpis">
          <div className="pp-kpi"><b>{d1 === null ? "–" : `${d1}%`}</b><span>กลับมาวันถัดไป ({r.d1_back}/{r.d1_users})</span></div>
          <div className="pp-kpi"><b>{d7 === null ? "–" : `${d7}%`}</b><span>กลับมาวันที่ 7 ({r.d7_back}/{r.d7_users})</span></div>
        </div>
        <p className="pp-muted small">นับจากวันสมัคร คนที่สมัครไม่ถึง 1 / 7 วันยังไม่ถูกนับ ตัวเลขน้อยกว่า 20 คนอย่าเพิ่งเชื่อมาก</p>
      </div>

      <div className="pp-card">
        <h3>หมวดที่คนทำผิดมากที่สุด</h3>
        {c.weak_topics.length === 0 ? <p className="pp-muted small">ข้อมูลยังไม่พอ (ต้องมีคนตอบหมวดละ 30 ข้อขึ้นไป)</p> : (
          <>
            <p className="pp-muted small">% ตอบถูกของทุกคนรวมกัน ยิ่งสั้นยิ่งยาก · ใช้ตัดสินใจว่าควรเพิ่มเฉลยละเอียดหมวดไหน</p>
            <BarList rows={c.weak_topics.map(t => ({ label: t.topic, value: t.pct, note: `${t.pct}% · ${nf(t.n)} ข้อ` }))} />
          </>
        )}
      </div>

      <div className="pp-card">
        <h3>ข้อที่หลอกคนมากที่สุด</h3>
        {c.tricky.length === 0 ? <p className="pp-muted small">ข้อมูลยังไม่พอ (ต้องมีคนตอบข้อละ 10 ครั้งขึ้นไป)</p> : (
          <>
            <p className="pp-muted small">ถ้าคนเลือกตัวเลือกผิดข้อเดียวกันเยอะมาก อาจเป็นเพราะเฉลยผิด ลองเปิดข้อนั้นในแท็บ “คลังข้อสอบ” ตรวจดู</p>
            {c.tricky.map(t => (
              <div key={t.id} className="pp-tricky">
                <div className="pp-muted small">#{t.id} · {t.topic} · ตอบถูก {t.pct}% จาก {nf(t.n)} ครั้ง</div>
                <div>{t.stem.length > 140 ? `${t.stem.slice(0, 140)}…` : t.stem}</div>
                {t.wrong_choice && <div className="small">ผิดบ่อยสุด ({t.wrong_pct}% เลือก): <b>{t.wrong_choice.length > 80 ? `${t.wrong_choice.slice(0, 80)}…` : t.wrong_choice}</b></div>}
              </div>
            ))}
          </>
        )}
      </div>

      <div className="pp-card">
        <h3>ข้อสอบจำลอง</h3>
        <div className="pp-guide-table">
          {c.mock.map(m => (
            <div key={m.code}><b>{m.name}</b><span>เริ่ม {nf(m.started)} · ส่ง {nf(m.submitted)}{m.auto ? ` · หมดเวลา ${m.auto}` : ""}{m.avg_pct != null ? ` · เฉลี่ย ${m.avg_pct}%` : ""}</span></div>
          ))}
        </div>
      </div>
    </>
  );
}
