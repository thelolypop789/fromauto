import { useEffect, useRef, useState } from "react";
import { REPORT_CATEGORIES, rpc, thaiError } from "./api";
import { IconCheck, IconFlag, IconX } from "./icons";
import { useBackClose } from "./router";

type Props = { questionId: number; stem: string; onClose: () => void; onSent: () => void };

export default function ReportDialog({ questionId, stem, onClose, onSent }: Props) {
  const [cat, setCat] = useState("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useBackClose(onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    box.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const send = async () => {
    if (!cat || busy) return;
    if (cat === "other" && !detail.trim()) { setError("กรุณาระบุรายละเอียดของปัญหา"); return; }
    setBusy(true); setError("");
    try {
      await rpc("prep_submit_report", { p_question: questionId, p_category: cat, p_detail: detail.trim() });
      setSent(true); onSent();
    } catch (e) { setError(thaiError(e)); }
    setBusy(false);
  };

  return (
    <div className="pp-modal" role="dialog" aria-modal="true" aria-labelledby="pp-report-h" onClick={onClose}>
      <div className="pp-modal-box" ref={box} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className="pp-modal-h">
          <h3 id="pp-report-h"><IconFlag size={18} /> รายงานข้อสอบ</h3>
          <button className="pp-x" onClick={onClose} aria-label="ปิด"><IconX /></button>
        </div>
        {sent ? (
          <div className="pp-empty">
            <div className="pp-empty-ico"><IconCheck size={30} /></div>
            <h3>ได้รับรายงานแล้ว ขอบคุณครับ</h3>
            <p className="pp-muted">ทีมงานจะตรวจสอบข้อนี้ ดูผลได้ที่หน้า "บัญชี" → รายงานของฉัน</p>
            <button className="pp-btn pp-btn-primary" onClick={onClose}>กลับไปทำข้อสอบ</button>
          </div>
        ) : (
          <>
            <p className="pp-modal-q">{stem}</p>
            <div className="pp-cats" role="radiogroup" aria-label="ประเภทปัญหา">
              {REPORT_CATEGORIES.map(([k, l, h]) => (
                <button key={k} role="radio" aria-checked={cat === k} className={cat === k ? "on" : ""} onClick={() => setCat(k)}>
                  <b>{l}</b><span>{h}</span>
                </button>
              ))}
            </div>
            <textarea className="pp-input" rows={3} maxLength={500} value={detail} onChange={e => setDetail(e.target.value)}
              placeholder={cat === "wrong_answer" ? "คำตอบที่ถูกควรเป็นข้อใด เพราะอะไร (ถ้ามีแหล่งอ้างอิงยิ่งดี)" : "รายละเอียดเพิ่มเติม (ไม่บังคับ)"} />
            {error && <div className="pp-error">{error}</div>}
            <div className="pp-row">
              <button className="pp-btn pp-btn-ghost" onClick={onClose}>ยกเลิก</button>
              <button className="pp-btn pp-btn-primary" disabled={!cat || busy} onClick={send}>{busy ? "กำลังส่ง..." : "ส่งรายงาน"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
