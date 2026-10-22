import { useState } from "react";
import { rpc, thaiError, type Profile, type Track } from "./api";
import Mascot from "./Mascot";

// Set from ?track= by api.ts (landing page buttons link to /prep?track=vec).
const readTrackPreset = (): Track | null => {
  try { const v = localStorage.getItem("pp-track"); return v === "obec" || v === "vec" ? v : null; } catch { return null; }
};

const OPTIONS: { key: Track; title: string; desc: string; costume: "teacher" | "vocational" }[] = [
  { key: "obec", title: "ครูผู้ช่วย สพฐ.", desc: "โรงเรียนระดับประถม/มัธยม · ภาค ข วิชาเอกสายสามัญ ปฐมวัย ประถมศึกษา ฯลฯ", costume: "teacher" },
  { key: "vec", title: "ครูผู้ช่วย อาชีวศึกษา (สอศ.)", desc: "วิทยาลัยเทคนิค อาชีวศึกษา การอาชีพ · ภาค ข หลักสูตร ปวช./ปวส. และวิชาเอกสายอาชีพ", costume: "vocational" },
];

// Which exam the user sits. variant "first": the first screen after signing in; "popup": shown once to people who
// used the app before the สอศ. track existed. The choice is saved at once (prep_set_track) and can be changed later
// in the major picker or the account page.
export default function TrackPicker({ variant, current, onDone }: { variant: "first" | "popup"; current?: Track; onDone: (p: Profile) => void }) {
  const [picked, setPicked] = useState<Track | null>(readTrackPreset() ?? (variant === "popup" ? current ?? null : null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!picked || busy) return;
    setBusy(true); setError("");
    try {
      const p = await rpc<Profile>("prep_set_track", { p_track: picked });
      onDone(p);
    } catch (e) { setError(thaiError(e)); setBusy(false); }
  };

  return (
    <div className="pp-modal" role="dialog" aria-modal="true" aria-labelledby="pp-track-h">
      <div className="pp-modal-box">
        <div className="pp-modal-h">
          <h3 id="pp-track-h">{variant === "popup" ? "ตอนนี้มีโหมดครูอาชีวะแล้ว คุณสอบสังกัดไหน?" : "คุณจะสอบครูผู้ช่วยสังกัดไหน?"}</h3>
        </div>
        <p className="pp-muted small">ใช้เลือกวิชาเอก หัวข้อภาค ข และข้อสอบจำลองให้ตรงกับสนามที่คุณสอบ · ภาค ก ใช้ร่วมกัน · เปลี่ยนได้ทุกเมื่อที่หน้าบัญชี</p>
        <div className="pp-track-pick" role="radiogroup" aria-label="สังกัดที่สอบ">
          {OPTIONS.map(o => (
            <button key={o.key} role="radio" aria-checked={picked === o.key} className={picked === o.key ? "on" : ""} disabled={busy} onClick={() => setPicked(o.key)}>
              <Mascot costume={o.costume} mood="happy" size={56} />
              <span><b>{o.title}</b><small>{o.desc}</small></span>
            </button>
          ))}
        </div>
        {error && <div className="pp-error">{error}</div>}
        <button className="pp-btn pp-btn-primary pp-wide" disabled={!picked || busy} onClick={save}>{busy ? "กำลังบันทึก..." : "ยืนยัน"}</button>
      </div>
    </div>
  );
}
