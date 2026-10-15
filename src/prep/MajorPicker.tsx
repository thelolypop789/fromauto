import { useEffect, useMemo, useState } from "react";
import { rpc, thaiError, type Topic } from "./api";
import { IconCheck, IconX } from "./icons";

type Props = { current: string | null; onClose: () => void; onSaved: (code: string, name: string) => void };

export default function MajorPicker({ current, onClose, onSaved }: Props) {
  const [majors, setMajors] = useState<Topic[] | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    rpc<Topic[]>("prep_topics").then(t => setMajors(t.filter(x => x.grp === "B3"))).catch(e => setError(thaiError(e)));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const list = useMemo(() => (majors ?? []).filter(m => m.name.includes(q.trim())), [majors, q]);

  const pick = async (m: Topic) => {
    if (busy) return;
    setBusy(true); setError("");
    try { await rpc("prep_set_major", { p_code: m.code }); onSaved(m.code, m.name); onClose(); }
    catch (e) { setError(thaiError(e)); setBusy(false); }
  };

  return (
    <div className="pp-modal" role="dialog" aria-modal="true" aria-labelledby="pp-major-h" onClick={onClose}>
      <div className="pp-modal-box" onClick={e => e.stopPropagation()}>
        <div className="pp-modal-h">
          <h3 id="pp-major-h">เลือกวิชาเอกของคุณ</h3>
          <button className="pp-x" onClick={onClose} aria-label="ปิด"><IconX /></button>
        </div>
        <p className="pp-muted small">ใช้จัดข้อสอบภาค ข ส่วนวิชาเอกให้ตรงกับตำแหน่งที่สมัคร เปลี่ยนได้ทุกเมื่อที่หน้าบัญชี</p>
        <input className="pp-input" type="search" placeholder="ค้นหาวิชาเอก" value={q} onChange={e => setQ(e.target.value)} />
        {!majors && !error && <div className="pp-spinner" />}
        <div className="pp-majors">
          {list.map(m => (
            <button key={m.code} className={m.code === current ? "on" : ""} disabled={busy} onClick={() => pick(m)}>
              <b>{m.name}</b>
              <span>{m.available > 0 ? `${m.available.toLocaleString()} ข้อ` : "เร็วๆ นี้"}</span>
              {m.code === current && <IconCheck size={16} />}
            </button>
          ))}
        </div>
        {error && <div className="pp-error">{error}</div>}
      </div>
    </div>
  );
}
