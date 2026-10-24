import { useEffect, useState } from "react";
import Mascot from "./Mascot";
import { IconCheck, IconX } from "./icons";

// One-off notice shown once per device on Home, until it expires. Change ID for a new notice.
const ID = "2026-10-question-cleanup";
const UNTIL = new Date("2026-11-08T00:00:00+07:00").getTime();
const KEY = `pp-notice-${ID}`;

const seen = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return true; } };

export default function Announcement() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (seen() || Date.now() > UNTIL) return;
    // Wait for the track/major pickers to close; never stack on another dialog.
    let id = 0;
    const tryOpen = () => { if (document.querySelector(".pp-modal")) id = window.setTimeout(tryOpen, 1500); else setOpen(true); };
    id = window.setTimeout(tryOpen, 800);
    return () => window.clearTimeout(id);
  }, []);
  if (!open) return null;
  const close = () => { try { localStorage.setItem(KEY, "1"); } catch { /* private mode */ } setOpen(false); };
  return (
    <div className="pp-modal" role="dialog" aria-modal="true" aria-labelledby="pp-notice-h" onClick={close}>
      <div className="pp-modal-box pp-notice" onClick={e => e.stopPropagation()}>
        <button className="pp-x pp-inst-x" onClick={close} aria-label="ปิด"><IconX /></button>
        <div className="pp-notice-hero"><Mascot costume="teacher" mood="happy" size={96} motion="pop" /></div>
        <span className="pp-notice-tag">ประกาศจากทีมงาน</span>
        <h3 id="pp-notice-h">ปรับปรุงคลังข้อสอบแล้ว</h3>
        <p>ขอบคุณทุกท่านที่ช่วยกดรายงานข้อสอบเข้ามา ทีมงานได้ตรวจคลังข้อสอบทั้งหมดอีกครั้ง และดำเนินการดังนี้</p>
        <ul>
          <li><IconCheck size={16} /><span>นำข้อที่โจทย์ซ้ำกันออก คงไว้เฉพาะข้อที่เฉลยถูกต้อง</span></li>
          <li><IconCheck size={16} /><span>แก้ไขกรณีโจทย์เดียวกันแต่เฉลยไม่ตรงกัน โดยตรวจกับตำราและตัวบทกฎหมาย</span></li>
          <li><IconCheck size={16} /><span>ตรวจเฉลยวิชาเอกอุตสาหกรรมศิลป์และภาษาไทยซ้ำอีกรอบ</span></li>
        </ul>
        <p className="pp-muted small">ชุดที่สร้างใหม่จะไม่พบข้อซ้ำแล้ว ส่วนชุดเดิม เมื่อเริ่มรอบถัดไประบบจะนำข้อดังกล่าวออกให้อัตโนมัติ หากยังพบข้อที่น่าสงสัย กดปุ่ม “รายงาน” ในข้อนั้นได้เลย ทีมงานจะตรวจสอบและแจ้งผลกลับในแอป</p>
        <button className="pp-btn pp-inst-go" onClick={close}>รับทราบ</button>
      </div>
    </div>
  );
}
