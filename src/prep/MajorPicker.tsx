import { useEffect, useMemo, useState } from "react";
import { TRACK_LABEL, rpc, thaiError, type Profile, type Topic, type Track } from "./api";
import { IconCheck, IconX } from "./icons";

// forced = first visit / no major yet: it cannot be dismissed by a stray tap, only by choosing a major or the explicit skip.
// track/onTrack: the exam (สพฐ. or สอศ.) decides which majors are listed; switching it saves at once and may clear the major.
type Props = {
  current: string | null; onClose: () => void; onSaved: (code: string, name: string) => void; forced?: boolean; onSkip?: () => void; skipsLeft?: number;
  track?: Track; onTrack?: (p: Profile) => void;
};

export default function MajorPicker({ current, onClose, onSaved, forced, onSkip, skipsLeft = 1, track = "obec", onTrack }: Props) {
  const [majors, setMajors] = useState<Topic[] | null>(null);
  const [exam, setExam] = useState<Track>(track);
  const [chosen, setChosen] = useState(current);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // prep_topics lists the caller's track only, so it is reloaded after a switch.
  useEffect(() => {
    rpc<Topic[]>("prep_topics").then(t => setMajors(t.filter(x => x.grp === "B3"))).catch(e => setError(thaiError(e)));
  }, [exam]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !forced) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, forced]);

  const list = useMemo(() => (majors ?? []).filter(m => m.name.includes(q.trim())), [majors, q]);

  const switchExam = async (t: Track) => {
    if (busy || t === exam) return;
    setBusy(true); setError("");
    try {
      const p = await rpc<Profile>("prep_set_track", { p_track: t });
      setMajors(null); setExam(t); setChosen(p.major); onTrack?.(p);
    } catch (e) { setError(thaiError(e)); }
    setBusy(false);
  };

  const pick = async (m: Topic) => {
    if (busy) return;
    setBusy(true); setError("");
    try { await rpc("prep_set_major", { p_code: m.code }); onSaved(m.code, m.name); onClose(); }
    catch (e) { setError(thaiError(e)); setBusy(false); }
  };

  return (
    <div className="pp-modal" role="dialog" aria-modal="true" aria-labelledby="pp-major-h" onClick={forced ? undefined : onClose}>
      <div className="pp-modal-box" onClick={e => e.stopPropagation()}>
        <div className="pp-modal-h">
          <h3 id="pp-major-h">{forced ? "สอบวิชาเอกอะไร?" : "เลือกวิชาเอกของคุณ"}</h3>
          {!forced && <button className="pp-x" onClick={onClose} aria-label="ปิด"><IconX /></button>}
        </div>
        <p className="pp-muted small">{forced ? "เลือกวิชาเอกที่คุณจะสอบ เราจะจัดข้อสอบภาค ข ให้ตรงสาย " : "ใช้จัดข้อสอบภาค ข ส่วนวิชาเอกให้ตรงกับตำแหน่งที่สมัคร "}เปลี่ยนได้ทุกเมื่อที่หน้าบัญชี</p>
        <div className="pp-seg pp-track" role="radiogroup" aria-label="สอบครูผู้ช่วยสังกัด">
          {(["obec", "vec"] as Track[]).map(t => (
            <button key={t} role="radio" aria-checked={exam === t} className={exam === t ? "on" : ""} disabled={busy} onClick={() => switchExam(t)}>
              ครูผู้ช่วย {TRACK_LABEL[t]}
            </button>
          ))}
        </div>
        {exam === "vec" && <p className="pp-muted small">ภาค ก ใช้ร่วมกับ สพฐ. · ภาค ข ใช้หัวข้อของ สอศ. (หลักสูตร ปวช./ปวส. ประกันคุณภาพ พ.ร.บ.การอาชีวศึกษา) · วิชาเอกสายอาชีพกำลังทยอยเพิ่มข้อสอบ</p>}
        <input className="pp-input" type="search" placeholder="ค้นหาวิชาเอก" value={q} onChange={e => setQ(e.target.value)} />
        {!majors && !error && <div className="pp-spinner" />}
        <div className="pp-majors">
          {list.map(m => (
            <button key={m.code} className={m.code === chosen ? "on" : ""} disabled={busy} onClick={() => pick(m)}>
              <b>{m.name}</b>
              <span>{m.available > 0 ? `${m.available.toLocaleString()} ข้อ` : "เร็วๆ นี้"}</span>
              {m.code === chosen && <IconCheck size={16} />}
            </button>
          ))}
        </div>
        {error && <div className="pp-error">{error}</div>}
        {forced && onSkip && skipsLeft > 0 && <button className="pp-link small pp-major-skip" onClick={onSkip}>ข้ามไปก่อน (เราจะถามอีกครั้งตอนเข้าครั้งหน้า · ข้ามได้อีก {skipsLeft} ครั้ง)</button>}
        {forced && skipsLeft <= 0 && <p className="pp-muted small pp-major-skip">เลือกวิชาเอกเพื่อเริ่มใช้งาน ใช้จัดข้อสอบภาค ข และวัดความพร้อมให้ตรงสายของคุณ</p>}
      </div>
    </div>
  );
}
