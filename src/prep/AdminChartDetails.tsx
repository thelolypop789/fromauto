import { useEffect, useState } from "react";
import { useAdminTrack } from "./adminTrack";
import { rpc, thaiError } from "./api";
import { BarList } from "./ChartParts";
import { nf } from "./chartFormat";

type Charts = {
  weak_topics: { topic: string; n: number; pct: number }[];
  tricky: { id: number; topic: string; stem: string; n: number; pct: number; wrong_choice: string | null; wrong_pct: number }[];
  mock: { code: string; name: string; started: number; submitted: number; auto: number; avg_pct: number | null }[];
};


// Question- and exam-level detail, loaded only when the admin opens it.
export default function AdminChartDetails() {
  const track = useAdminTrack();
  const days = 30;
  const [c, setC] = useState<Charts | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    rpc<Charts>("prep_admin_charts", { p_days: days, p_track: track }).then(r => { if (live) { setC(r); setError(""); } }).catch(e => { if (live) setError(thaiError(e)); });
    return () => { live = false; };
  }, [days, track]);

  if (error) return <div className="pp-error">{error}</div>;
  if (!c) return <div className="pp-spinner" />;

  return (
    <>
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
