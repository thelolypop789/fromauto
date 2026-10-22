import { useEffect, useState } from "react";
import { rpc, type Progress } from "./api";
import { levelOf } from "./levels";
import Mascot from "./Mascot";
import Confetti from "./Confetti";

const SEEN_KEY = "pp-level-seen";
const readSeen = () => { try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch { return 0; } };
const writeSeen = (n: number) => { try { localStorage.setItem(SEEN_KEY, String(n)); } catch { /* private mode */ } };

// Level (fire-themed, from XP) and the day streak. Celebrates once when the level went up since the last visit.
export default function LevelCard() {
  const [p, setP] = useState<Progress | null>(null);
  const [up, setUp] = useState(false);

  useEffect(() => {
    rpc<Progress>("prep_progress").then(x => {
      setP(x);
      const no = levelOf(x.xp).no, seen = readSeen();
      if (seen && no > seen) setUp(true);
      writeSeen(no);
    }).catch(() => { /* card hides itself */ });
  }, []);

  if (!p) return null;
  const lv = levelOf(p.xp);
  const into = p.xp - lv.from, span = lv.to - lv.from;
  const atRisk = p.streak > 0 && !p.practiced_today;

  return (
    <div className="pp-card pp-lv">
      {up && <Confetti />}
      <div className="pp-lv-top">
        <div className="pp-lv-badge" aria-label={`เลเวล ${lv.no}`}><small>Lv.</small>{lv.no}</div>
        <div className="pp-lv-t">
          <b>{lv.name}</b>
          <span className="pp-muted small">{p.xp.toLocaleString("th-TH")} XP · อีก {(lv.to - p.xp).toLocaleString("th-TH")} XP ถึงเลเวล {lv.no + 1}</span>
        </div>
        <div className={`pp-lv-streak ${p.streak ? "" : "off"}`} title={`สถิติสูงสุด ${p.best_streak} วัน`}>
          <span aria-hidden>🔥</span><b>{p.streak}</b><small>วันติด</small>
        </div>
      </div>
      <div className="pp-bar thin pp-lv-bar" role="progressbar" aria-valuemin={0} aria-valuemax={span} aria-valuenow={into}>
        <div style={{ width: `${Math.min(100, (100 * into) / span)}%` }} />
      </div>
      {up ? (
        <div className="pp-lv-up"><Mascot mood="cheer" motion="cheer" size={44} /><span>เลเวลอัป! ตอนนี้เป็น <b>{lv.name}</b> แล้ว</span>
          <button className="pp-link small" onClick={() => setUp(false)}>ปิด</button></div>
      ) : atRisk ? (
        <p className="pp-lv-hint">ทำวันนี้อย่างน้อย 1 ข้อ เพื่อรักษาสถิติ 🔥 {p.streak} วัน</p>
      ) : (
        <p className="pp-muted small pp-lv-how">ตอบ 1 ข้อ = 1 XP · ตอบถูก +1 · ข้อสอบประจำวันครบ +20 · ส่งจำลองสอบ +50{p.best_streak > p.streak ? ` · สถิติวันติดสูงสุด ${p.best_streak} วัน` : ""}</p>
      )}
    </div>
  );
}
