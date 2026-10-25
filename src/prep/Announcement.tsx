import { useEffect, useState } from "react";
import Mascot from "./Mascot";
import { IconCheck, IconX } from "./icons";
import type { Track } from "./api";

// One-off notices on Home, each shown once per device until it expires. The first unseen one that applies opens;
// add a notice with a new id. `track` limits a notice to สพฐ. ("obec") or สอศ. ("vec") users.
type Notice = { id: string; until: string; track?: Track; title: string; intro: string; points: string[]; note: string };
const NOTICES: Notice[] = [
  {
    id: "2026-10-track-fix", until: "2026-11-15T00:00:00+07:00", track: "obec",
    title: "แก้ไขแล้ว: ข้อสอบ สอศ. ปนในชุดสาย สพฐ.",
    intro: "ขอบคุณผู้ใช้ที่แจ้งเข้ามา ทีมงานพบว่าปุ่ม \"เลือกฝึกตามภาค\" ในหน้าแรก ดึงหัวข้อของสาย สอศ. (หลักสูตรอาชีวะ ประกันคุณภาพอาชีวะ บริบทโลกและ SEP และ พ.ร.บ.การอาชีวศึกษา) มาปนในชุดวิชาชีพครูและกฎหมาย ตอนนี้แก้ไขแล้ว",
    points: [
      "ชุดที่สร้างใหม่ตั้งแต่วันนี้ มีเฉพาะข้อสอบของสาย สพฐ.",
      "หน้าแนวข้อสอบเก่า แสดงเฉพาะของสายที่คุณเลือก",
      "จำลองสอบจริงและความพร้อมสอบ (ERI) ไม่ได้รับผลกระทบ",
    ],
    note: "ชุดที่สร้างไว้ก่อนหน้านี้อาจยังมีข้อ สอศ. ปนอยู่ แนะนำให้สร้างชุดใหม่ ขออภัยในความไม่สะดวกครับ",
  },
  {
    id: "2026-10-question-cleanup", until: "2026-11-08T00:00:00+07:00",
    title: "ปรับปรุงคลังข้อสอบแล้ว",
    intro: "ขอบคุณทุกท่านที่ช่วยกดรายงานข้อสอบเข้ามา ทีมงานได้ตรวจคลังข้อสอบทั้งหมดอีกครั้ง และดำเนินการดังนี้",
    points: [
      "นำข้อที่โจทย์ซ้ำกันออก คงไว้เฉพาะข้อที่เฉลยถูกต้อง",
      "แก้ไขกรณีโจทย์เดียวกันแต่เฉลยไม่ตรงกัน โดยตรวจกับตำราและตัวบทกฎหมาย",
      "ตรวจเฉลยวิชาเอกอุตสาหกรรมศิลป์และภาษาไทยซ้ำอีกรอบ",
    ],
    note: "ชุดที่สร้างใหม่จะไม่พบข้อซ้ำแล้ว ส่วนชุดเดิม เมื่อเริ่มรอบถัดไประบบจะนำข้อดังกล่าวออกให้อัตโนมัติ หากยังพบข้อที่น่าสงสัย กดปุ่ม “รายงาน” ในข้อนั้นได้เลย ทีมงานจะตรวจสอบและแจ้งผลกลับในแอป",
  },
];
const key = (id: string) => `pp-notice-${id}`;
const seen = (id: string) => { try { return localStorage.getItem(key(id)) === "1"; } catch { return true; } };

export default function Announcement({ track }: { track?: Track }) {
  const [n, setN] = useState<Notice | null>(null);
  useEffect(() => {
    const next = NOTICES.find(x => !seen(x.id) && Date.now() <= new Date(x.until).getTime() && (!x.track || x.track === (track ?? "obec")));
    if (!next) return;
    // Wait for the track/major pickers to close; never stack on another dialog.
    let id = 0;
    const tryOpen = () => { if (document.querySelector(".pp-modal")) id = window.setTimeout(tryOpen, 1500); else setN(next); };
    id = window.setTimeout(tryOpen, 800);
    return () => window.clearTimeout(id);
  }, [track]);
  if (!n) return null;
  const close = () => { try { localStorage.setItem(key(n.id), "1"); } catch { /* private mode */ } setN(null); };
  return (
    <div className="pp-modal" role="dialog" aria-modal="true" aria-labelledby="pp-notice-h" onClick={close}>
      <div className="pp-modal-box pp-notice" onClick={e => e.stopPropagation()}>
        <button className="pp-x pp-inst-x" onClick={close} aria-label="ปิด"><IconX /></button>
        <div className="pp-notice-hero"><Mascot costume="teacher" mood="happy" size={96} motion="pop" /></div>
        <span className="pp-notice-tag">ประกาศจากทีมงาน</span>
        <h3 id="pp-notice-h">{n.title}</h3>
        <p>{n.intro}</p>
        <ul>{n.points.map(t => <li key={t}><IconCheck size={16} /><span>{t}</span></li>)}</ul>
        <p className="pp-muted small">{n.note}</p>
        <button className="pp-btn pp-inst-go" onClick={close}>รับทราบ</button>
      </div>
    </div>
  );
}
