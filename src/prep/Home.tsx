import { useEffect, useState } from "react";
import { GROUPS, PASS_PCT, SECTIONS, rpc, thaiError, type Dashboard, type Me, type Profile, type ReviewCounts, type SetSummary } from "./api";
import MajorPicker from "./MajorPicker";
import type { Preset } from "./CreateSet";
import { IconCheck, IconCrown, IconPlus, IconTarget } from "./icons";
import InstallBanner from "./InstallBanner";
import ExpiryBanner from "./ExpiryBanner";

type Props = {
  me: Me;
  profile: Profile;
  onMajor: (code: string, name: string) => void;
  onCreate: (preset?: Preset) => void;
  onStart: (setId: string, mode: "full" | "wrong") => void;
  onReview: (kind: "due" | "wrong") => void;
  onDaily: () => void;
  onUpgrade: () => void;
};

export default function Home({ me, profile, onMajor, onCreate, onStart, onReview, onDaily, onUpgrade }: Props) {
  const [picking, setPicking] = useState(false);
  const [sets, setSets] = useState<SetSummary[] | null>(null);
  const [error, setError] = useState("");
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [counts, setCounts] = useState<ReviewCounts | null>(null);

  useEffect(() => {
    rpc<SetSummary[]>("prep_list_sets").then(setSets).catch(e => setError(thaiError(e)));
    rpc<ReviewCounts>("prep_review_counts").then(setCounts).catch(() => { /* tiles show without counts */ });
    rpc<Dashboard>("prep_dashboard").then(setDash).catch(() => { /* explorer just shows without progress */ });
  }, []);

  const canCreate = me.plan === "paid" || me.free_sets_used < me.free_sets_limit;

  const freeLeft = Math.max(0, me.free_sets_limit - me.free_sets_used);
  const cleared = sets?.filter(s => s.cleared_at).length ?? 0;

  return (
    <>
      <ExpiryBanner me={me} onRenew={onUpgrade} />
      <InstallBanner />

      <section className="pp-hero">
        <div className="pp-hero-top">
          <div>
            <div className="pp-hero-lab">วันนี้ทำไปแล้ว</div>
            <div className="pp-big">{me.answered_today.toLocaleString()} <small>ข้อ</small></div>
          </div>
          {canCreate
            ? <button className="pp-btn pp-btn-gold" onClick={() => onCreate()}><IconPlus />สร้างชุดใหม่</button>
            : <button className="pp-btn pp-btn-gold" onClick={onUpgrade}><IconCrown size={20} />อัปเกรดเพื่อสร้างชุดใหม่</button>}
        </div>
        <div className="pp-hero-stats">
          <div><b>{sets?.length ?? "–"}</b><span>ชุดของฉัน</span></div>
          <div><b>{sets ? cleared : "–"}</b><span>เคลียร์แล้ว</span></div>
          <div><b>{me.plan === "paid" ? "∞" : freeLeft}</b><span>{me.plan === "paid" ? "สร้างได้" : "ชุดฟรีคงเหลือ"}</span></div>
        </div>
      </section>

      <div className="pp-h"><h2>ฝึกแบบอื่น</h2></div>
      <div className="pp-modes pp-modes-home">
        <button onClick={onDaily}>
          <b>ข้อสอบประจำวัน</b><span>10 ข้อ ทุกคนได้ชุดเดียวกัน · ฟรี</span>
        </button>
        <button disabled={!counts || counts.due === 0} onClick={() => onReview("due")}>
          <b>ทบทวนวันนี้{counts ? ` (${counts.due})` : ""}</b>
          <span>{counts && counts.due === 0 ? "ยังไม่มีข้อถึงรอบทวน" : "ข้อที่ผิดมา ถึงรอบทวนตามเวลา"}</span>
        </button>
        <button disabled={!counts || counts.wrong === 0} onClick={() => onReview("wrong")}>
          <b>ทวนข้อผิดทั้งหมด{counts ? ` (${counts.wrong})` : ""}</b>
          <span>{counts && counts.wrong === 0 ? "ไม่มีข้อที่ยังผิดอยู่" : "รวมข้อที่ยังตอบผิด จากทุกชุด"}</span>
        </button>
      </div>

      <div className="pp-h"><h2>เลือกฝึกตามภาค</h2><span className="pp-muted small">แตะหมวดเพื่อเริ่ม</span></div>
      <div className="pp-explore">
        {(["A", "B"] as const).map(sec => {
          const ts = dash?.topics.filter(t => t.section === sec) ?? [];
          const avail = ts.reduce((s, t) => s + t.available, 0);
          const n = ts.reduce((s, t) => s + t.n, 0), c = ts.reduce((s, t) => s + t.correct, 0);
          const seen = ts.reduce((s, t) => s + t.seen, 0);
          return (
            <section key={sec} className="pp-card pp-sec">
              <div className="pp-sec-head">
                <span className="pp-sec-badge">{SECTIONS[sec].short}</span>
                <div className="pp-sec-t"><b>{SECTIONS[sec].name}</b><span className="pp-muted small">{dash ? `${avail.toLocaleString()} ข้อ · เคยเห็น ${seen}` : "…"}</span></div>
                {n > 0 && <span className={`pp-pct ${Math.round(100 * c / n) >= PASS_PCT ? "ok" : "low"}`}>{Math.round(100 * c / n)}%</span>}
              </div>
              {SECTIONS[sec].groups.map(g => {
                if (g === "B3") {
                  // วิชาเอก: one row for the user's own major instead of listing every major.
                  const mt = ts.find(t => t.code === profile.major);
                  const avail = mt?.available ?? 0;
                  return (
                    <div key={g} className="pp-major-row">
                      <button className="pp-sec-grp" disabled={!!profile.major && (!canCreate || avail === 0)}
                        onClick={() => (profile.major ? onCreate({ section: "B", topics: [profile.major] }) : setPicking(true))}>
                        <span className="pp-sec-grp-t">
                          {profile.major ? `วิชาเอก${profile.major_name}` : "วิชาเอก"}
                          <small>{!profile.major ? "แตะเพื่อเลือกวิชาเอกของคุณ" : avail > 0 ? `${avail.toLocaleString()} ข้อ` : "กำลังเพิ่มข้อสอบวิชาเอกนี้"}</small>
                        </span>
                        {mt && mt.n > 0 ? <span className="pp-sec-grp-p">{Math.round(100 * mt.correct / mt.n)}%</span>
                          : <span className="pp-sec-grp-p new">{profile.major ? (avail ? "ใหม่" : "เร็วๆ นี้") : "เลือก"}</span>}
                      </button>
                      {profile.major && <button className="pp-link small" onClick={() => setPicking(true)}>เปลี่ยน</button>}
                    </div>
                  );
                }
                const gt = ts.filter(t => t.grp === g && t.available > 0);
                if (dash && !gt.length) return null;
                const gn = gt.reduce((s, t) => s + t.n, 0), gc = gt.reduce((s, t) => s + t.correct, 0);
                return (
                  <button key={g} className="pp-sec-grp" disabled={!canCreate} onClick={() => onCreate({ section: sec, topics: gt.map(t => t.code) })}>
                    <span className="pp-sec-grp-t">{GROUPS[g]}<small>{gt.length} หมวด · {gt.reduce((s, t) => s + t.available, 0)} ข้อ</small></span>
                    {gn > 0 ? <span className="pp-sec-grp-p">{Math.round(100 * gc / gn)}%</span> : <span className="pp-sec-grp-p new">ใหม่</span>}
                  </button>
                );
              })}
              <button className="pp-btn pp-btn-ghost pp-sec-all" disabled={!canCreate} onClick={() => onCreate({ section: sec })}>เลือกหมวดย่อยใน{SECTIONS[sec].short}</button>
            </section>
          );
        })}
      </div>
      {picking && <MajorPicker current={profile.major} onClose={() => setPicking(false)} onSaved={onMajor} />}
      {!canCreate && <p className="pp-note">ใช้ชุดฟรีครบแล้ว — ทำซ้ำชุดเดิมด้านล่างได้ไม่จำกัด หรืออัปเกรดเพื่อสร้างชุดใหม่</p>}

      {error && <div className="pp-error">{error}</div>}
      {sets === null && !error && <div className="pp-spinner" />}

      {sets && sets.length === 0 && (
        <div className="pp-card pp-empty">
          <div className="pp-empty-ico"><IconTarget size={30} /></div>
          <h3>เริ่มชุดแรกกันเลย</h3>
          <p className="pp-muted">เลือกหมวดที่อยากซ้อม ระบบจะจัดข้อสอบให้ ทำซ้ำได้ไม่จำกัดจนกว่าจะถูกครบ</p>
          <button className="pp-btn pp-btn-primary" onClick={() => onCreate()}><IconPlus />สร้างชุดแรก</button>
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
