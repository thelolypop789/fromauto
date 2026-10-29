import { useEffect, useState } from "react";
import { rpc, track, type Quote, type Readiness } from "./api";
import { IconCheck, IconCrown } from "./icons";
import { navigate } from "./router";

type Plan = { exam_title: string | null; days_left: number | null };

// Shown instead of the create form once a free account has used its 3 sets. Nearly half of the people who reached the old
// "ดูแพ็ก" card never opened the buy screen, and it said neither the price nor how close the exam is. This one shows both,
// the topic that would raise their score most, and opens the buy screen with the package already picked.
export default function FreeWall() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [focus, setFocus] = useState<Readiness["focus"][number] | null>(null);
  useEffect(() => {
    rpc<Quote[]>("prep_quotes").then(setQuotes).catch(() => { /* buttons fall back to "ดูแพ็ก" */ });
    rpc<Plan>("prep_plan").then(setPlan).catch(() => { /* no countdown */ });
    rpc<Readiness>("prep_readiness").then(r => setFocus(r.focus?.[0] ?? null)).catch(() => { /* no hint */ });
  }, []);
  const price = (t: "round" | "lifetime") => {
    const q = quotes.find(x => x.package === "ALL" && x.term === t && !x.error);
    return q?.amount ?? null;
  };
  const buy = (term?: "round" | "lifetime") => {
    track("paywall_click");
    navigate(term ? `/prep/buy?pkg=ALL&term=${term}` : "/prep/buy");
  };
  const round = price("round"), life = price("lifetime");
  const days = plan?.days_left;

  return (
    <div className="pp-card pp-wall">
      <div className="pp-empty-ico"><IconCrown size={30} /></div>
      <h3>ใช้ชุดฟรีครบ 3 ชุดแล้ว</h3>
      {days != null && days >= 0 && (
        <p className="pp-wall-count">{days === 0 ? "วันนี้วันสอบ" : <>อีก <b>{days}</b> วัน</>}{plan?.exam_title ? ` ถึง${plan.exam_title}` : " ถึงวันสอบ"}</p>
      )}
      {focus && (
        <p className="pp-note">หมวดที่ฝึกแล้วได้คะแนนเพิ่มมากที่สุดของคุณ: <b>{focus.name}</b> ({focus.n ? `ถูก ${focus.pct}%` : "ยังไม่เคยทำ"} · ออกราว {focus.w} ข้อ)</p>
      )}
      <ul className="pp-perks">
        <li><IconCheck />สร้างชุดใหม่ได้ไม่จำกัด ทุกหมวดทั้งภาค ก ภาค ข และวิชาเอก</li>
        <li><IconCheck />ข้อสอบจำลองเสมือนจริงจับเวลา และสรุปเนื้อหาแบบแผนผังครบทุกเรื่อง</li>
        <li><IconCheck />จ่ายผ่าน QR แล้วเปิดสิทธิ์ให้ ปกติภายในไม่กี่นาที</li>
      </ul>
      {round || life ? (
        <div className="pp-wall-buy">
          {round && <button className="pp-btn pp-btn-outline" onClick={() => buy("round")}><span>ครบทุกภาค · รายรอบ 3 เดือน</span><b>{round} บาท</b></button>}
          {life && <button className="pp-btn pp-btn-gold" onClick={() => buy("lifetime")}><span>ครบทุกภาค · ซื้อขาด ใช้ได้ทุกรอบ</span><b>{life} บาท</b></button>}
        </div>
      ) : (
        <button className="pp-btn pp-btn-gold" onClick={() => buy()}><IconCrown size={20} />ดูแพ็ก</button>
      )}
      <p className="pp-muted small">ชุดเดิมยังทำซ้ำได้ไม่จำกัด · <button className="pp-link small" onClick={() => buy()}>ดูแพ็กอื่น</button></p>
    </div>
  );
}
