import { useEffect, useState } from "react";
import Mascot from "./Mascot";
import { IconX } from "./icons";
import { rpc } from "./api";
import { useBackClose } from "./router";

// โพลสั้นแบบ pop up บนหน้าแรก ขึ้นครั้งเดียวต่อเครื่องในช่วงเวลาที่กำหนด ไม่เรียก server จนกว่าจะกดตอบ
// (หลังสอบภาค ข 15–16 พ.ย. 2569: ถามคนที่สอบแล้วว่าข้อสอบในแอปช่วยได้แค่ไหน — ผลอยู่ใน prep.poll_answers)
const POLL = {
  id: "2026-11-b-after",
  from: "2026-11-15T11:00:00+07:00",
  until: "2026-11-17T00:00:00+07:00",
  title: "สอบแล้ว ข้อสอบใน SOBPREP ช่วยได้แค่ไหน",
  intro: "ใครสอบไปแล้ว ขอถามสั้น ๆ ครับ เจอข้อที่เคยซ้อม หรือพอทำได้บ้างไหม 🙏",
  choices: [["much", "ช่วยได้มาก เจอข้อที่เคยซ้อมเยอะ"], ["some", "ช่วยได้บ้าง พอทำได้"], ["little", "ไม่ค่อยช่วย ไม่ค่อยตรง"], ["none", "ยังไม่ได้สอบ / ยังไม่ได้ใช้แอป"]] as [string, string][],
};
type Result = { total: number; counts: Record<string, number> };
const key = `pp-poll-${POLL.id}`;
const done = () => { try { return localStorage.getItem(key) === "1"; } catch { return true; } };

export default function QuickPoll() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [mine, setMine] = useState("");
  useEffect(() => {
    const now = Date.now();
    if (done() || now < new Date(POLL.from).getTime() || now > new Date(POLL.until).getTime()) return;
    // ไม่ซ้อนกับ pop up อื่น (ประกาศ, เลือกเอก): รอจนอันอื่นปิดก่อน
    let id = 0;
    const tryOpen = () => { if (document.querySelector(".pp-modal")) id = window.setTimeout(tryOpen, 1500); else setOpen(true); };
    id = window.setTimeout(tryOpen, 2500);
    return () => window.clearTimeout(id);
  }, []);
  const close = () => { try { localStorage.setItem(key, "1"); } catch { /* private mode */ } setOpen(false); };
  useBackClose(close, open);
  const answer = async (c: string) => {
    setBusy(true); setMine(c);
    try { setRes(await rpc<Result>("prep_poll_answer", { p_poll: POLL.id, p_choice: c })); }
    catch { setRes({ total: 0, counts: {} }); }
    try { localStorage.setItem(key, "1"); } catch { /* private mode */ }
    setBusy(false);
  };
  if (!open) return null;
  return (
    <div className="pp-modal" role="dialog" aria-modal="true" aria-labelledby="pp-poll-h" onClick={close}>
      <div className="pp-modal-box pp-notice" onClick={e => e.stopPropagation()}>
        <button className="pp-x pp-inst-x" onClick={close} aria-label="ปิด"><IconX /></button>
        <div className="pp-notice-hero"><Mascot costume="teacher" mood={res ? "cheer" : "happy"} size={88} motion="pop" /></div>
        <span className="pp-notice-tag">โพลสั้น ๆ 10 วินาที</span>
        <h3 id="pp-poll-h">{POLL.title}</h3>
        {!res ? (
          <>
            <p>{POLL.intro}</p>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {POLL.choices.map(([v, label]) => (
                <button key={v} className="pp-btn pp-btn-ghost pp-wide" disabled={busy} onClick={() => answer(v)}>{busy && mine === v ? "กำลังส่ง…" : label}</button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p>ขอบคุณครับ ขอให้ได้ผลดีนะครับ 🤍</p>
            {res.total >= 5 && (
              <ul style={{ textAlign: "left" }}>
                {POLL.choices.map(([v, label]) => (
                  <li key={v}><span>{label}: <b>{Math.round(100 * (res.counts[v] ?? 0) / res.total)}%</b>{v === mine ? " (คุณ)" : ""}</span></li>
                ))}
              </ul>
            )}
            {res.total >= 5 && <p className="pp-muted small">จากคุณครูที่ตอบแล้ว {res.total.toLocaleString("th-TH")} คน</p>}
            <button className="pp-btn pp-inst-go" onClick={close}>ปิด</button>
          </>
        )}
      </div>
    </div>
  );
}
