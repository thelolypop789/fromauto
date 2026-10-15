import { useEffect, useState } from "react";
import { rpc, thaiError, type Me, type SetSummary } from "./api";
import { IconCheck, IconCrown, IconPlus, IconTarget } from "./icons";
import InstallBanner from "./InstallBanner";

type Props = {
  me: Me;
  onCreate: () => void;
  onStart: (setId: string, mode: "full" | "wrong") => void;
  onUpgrade: () => void;
};

export default function Home({ me, onCreate, onStart, onUpgrade }: Props) {
  const [sets, setSets] = useState<SetSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    rpc<SetSummary[]>("prep_list_sets").then(setSets).catch(e => setError(thaiError(e)));
  }, []);

  const canCreate = me.plan === "paid" || me.free_sets_used < me.free_sets_limit;

  const freeLeft = Math.max(0, me.free_sets_limit - me.free_sets_used);
  const cleared = sets?.filter(s => s.cleared_at).length ?? 0;

  return (
    <>
      <InstallBanner />

      <section className="pp-hero">
        <div className="pp-hero-top">
          <div>
            <div className="pp-hero-lab">วันนี้ทำไปแล้ว</div>
            <div className="pp-big">{me.answered_today.toLocaleString()} <small>ข้อ</small></div>
          </div>
          {canCreate
            ? <button className="pp-btn pp-btn-gold" onClick={onCreate}><IconPlus />สร้างชุดใหม่</button>
            : <button className="pp-btn pp-btn-gold" onClick={onUpgrade}><IconCrown size={20} />อัปเกรดเพื่อสร้างชุดใหม่</button>}
        </div>
        <div className="pp-hero-stats">
          <div><b>{sets?.length ?? "–"}</b><span>ชุดของฉัน</span></div>
          <div><b>{sets ? cleared : "–"}</b><span>เคลียร์แล้ว</span></div>
          <div><b>{me.plan === "paid" ? "∞" : freeLeft}</b><span>{me.plan === "paid" ? "สร้างได้" : "ชุดฟรีคงเหลือ"}</span></div>
        </div>
      </section>

      {error && <div className="pp-error">{error}</div>}
      {sets === null && !error && <div className="pp-spinner" />}

      {sets && sets.length === 0 && (
        <div className="pp-card pp-empty">
          <div className="pp-empty-ico"><IconTarget size={30} /></div>
          <h3>เริ่มชุดแรกกันเลย</h3>
          <p className="pp-muted">เลือกหมวดที่อยากซ้อม ระบบจะจัดข้อสอบให้ ทำซ้ำได้ไม่จำกัดจนกว่าจะถูกครบ</p>
          <button className="pp-btn pp-btn-primary" onClick={onCreate}><IconPlus />สร้างชุดแรก</button>
        </div>
      )}

      {sets && sets.length > 0 && <div className="pp-h"><h2>ชุดฝึกของฉัน</h2><span className="pp-muted small">{sets.length} ชุด</span></div>}
      <div className="pp-sets">
      {sets?.map(s => {
        const done = !!s.cleared_at;
        const played = s.rounds > 0;
        return (
          <div key={s.id} className={`pp-card pp-set ${done ? "cleared" : ""}`}>
            <div className="pp-set-head">
              <div>
                <div className="pp-set-title">{s.title}</div>
                <div className="pp-muted pp-set-meta">{s.size} ข้อ · ทำไป {s.rounds} รอบ{s.best_pct != null ? ` · ดีสุด ${Math.round(s.best_pct)}%` : ""}</div>
              </div>
              {done ? <span className="pp-badge ok"><IconCheck size={14} />เคลียร์แล้ว</span>
                : played ? <span className="pp-badge warn">เหลือผิด {s.remaining}</span>
                : <span className="pp-badge">ยังไม่เริ่ม</span>}
            </div>
            {played && (
              <div className="pp-bar"><div style={{ width: `${Math.round(100 * (s.size - s.remaining) / s.size)}%` }} /></div>
            )}
            <div className="pp-set-actions">
              {s.open_round ? (
                <button className="pp-btn pp-btn-primary" onClick={() => onStart(s.id, s.open_round!.mode)}>
                  ทำต่อ ({s.open_round.answered}/{s.open_round.total})
                </button>
              ) : (
                <>
                  {played && !done && s.remaining > 0 && (
                    <button className="pp-btn pp-btn-primary" onClick={() => onStart(s.id, "wrong")}>ทำเฉพาะข้อผิด ({s.remaining})</button>
                  )}
                  <button className={`pp-btn ${played && !done ? "pp-btn-ghost" : "pp-btn-primary"}`} onClick={() => onStart(s.id, "full")}>
                    {played ? "ทำทั้งชุดใหม่" : "เริ่มทำ"}
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </>
  );
}
