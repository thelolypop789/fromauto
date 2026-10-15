import type { Me, SubmitResult } from "./api";

type Props = {
  result: SubmitResult;
  title: string;
  me: Me;
  onStart: (setId: string, mode: "full" | "wrong") => void;
  onHome: () => void;
  onUpgrade: () => void;
};

export default function RoundResult({ result: r, title, me, onStart, onHome, onUpgrade }: Props) {
  const outOfFree = me.plan !== "paid" && me.free_sets_used >= me.free_sets_limit;
  return (
    <div className="pp-card pp-result">
      <div className="pp-muted">{title} · {r.mode === "wrong" ? "รอบข้อผิด" : `รอบที่ ${r.round_no}`}</div>
      {r.cleared ? (
        <>
          <div style={{ fontSize: 56 }}>🏆</div>
          <h2>เคลียร์ชุดนี้แล้ว!</h2>
          <p className="pp-muted">ตอบถูกครบทุกข้อ ข้อเหล่านี้จะช่วยให้ผลวิเคราะห์แม่นขึ้น</p>
        </>
      ) : (
        <>
          <div className="pp-score">{r.correct}<small>/{r.total}</small></div>
          <div className="pp-big">{Math.round(r.pct)}%</div>
          <p className="pp-muted">ยังผิดอยู่ {r.wrong_count} ข้อ — ทำซ้ำจนกว่าจะถูกครบ</p>
        </>
      )}
      <div className="pp-col">
        {!r.cleared && <button className="pp-btn pp-btn-primary" onClick={() => onStart(r.set_id, "wrong")}>ทำเฉพาะข้อผิด ({r.wrong_count})</button>}
        <button className={`pp-btn ${r.cleared ? "pp-btn-primary" : "pp-btn-ghost"}`} onClick={() => onStart(r.set_id, "full")}>ทำทั้งชุดใหม่ (สลับลำดับ)</button>
        <button className="pp-btn pp-btn-ghost" onClick={onHome}>กลับหน้าชุดของฉัน</button>
      </div>
      {r.cleared && outOfFree && (
        <div className="pp-upsell">
          <b>อยากได้ข้อใหม่เพิ่ม?</b>
          <p>ใช้ชุดฟรีครบแล้ว อัปเกรดเพื่อสร้างชุดใหม่จากคลังได้ไม่จำกัด</p>
          <button className="pp-btn pp-btn-gold" onClick={onUpgrade}>ดูวิธีอัปเกรด</button>
        </div>
      )}
    </div>
  );
}
