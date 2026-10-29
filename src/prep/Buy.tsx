import { useRef, useState, useEffect } from "react";
import { rpc, type Me, type PackageKey, type Price } from "./api";
import { PACKAGES, SHOP } from "./config";
import { IconCheck, IconCrown } from "./icons";
import PayForm from "./PayForm";

type Term = "round" | "lifetime";

// /prep/buy: packages, how to pay and the payment form. Tapping a price on a card picks that package and term in the
// form below (the form is remounted with it), so the buyer does not choose twice.
export default function Buy({ me, email, onChanged }: { me: Me; email: string; onChanged: () => void }) {
  const [prices, setPrices] = useState<Price[]>([]);
  const [pick, setPick] = useState<{ pkg: PackageKey; term: Term; n: number } | null>(null);
  const form = useRef<HTMLDivElement>(null);
  useEffect(() => { rpc<Price[]>("prep_prices").then(setPrices).catch(() => { /* falls back to config */ }); }, []);
  const priceOf = (k: PackageKey, t: Term, fallback: string) => {
    const x = prices.find(y => y.package === k && y.term === t);
    return x ? `${x.amount} บาท` : fallback;
  };
  const pkgs = me.packages ?? [];
  const owned = new Set(pkgs.map(p => p.package));
  const lifetimeAll = pkgs.some(p => p.package === "ALL" && !p.expires_at);
  const choose = (pkg: PackageKey, term: Term) => {
    setPick(p => ({ pkg, term, n: (p?.n ?? 0) + 1 }));
    window.setTimeout(() => form.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  if (lifetimeAll) {
    return <div className="pp-card"><h3>คุณมีแพ็กครบทุกภาคแบบซื้อขาดแล้ว</h3><p className="pp-muted">ใช้งานได้ทุกหมวดตลอด ไม่ต้องซื้อเพิ่ม</p></div>;
  }
  return (
    <div className="pp-card pp-upgrade">
      <h2><IconCrown size={22} /> {pkgs.length ? "ซื้อแพ็กเพิ่ม / ต่ออายุ" : "อัปเกรดเป็นสมาชิก"}</h2>
      <ul className="pp-perks">
        <li><IconCheck />สร้างชุดใหม่ได้ไม่จำกัดในหมวดของแพ็ก (ชุดละสูงสุด 200 ข้อ)</li>
        <li><IconCheck />ดึงข้อใหม่จากคลังทั้งหมด พร้อมเฉลยและคำอธิบายทุกข้อ</li>
        <li><IconCheck /><span>เลือกได้ทั้ง <b>รายรอบ</b>{SHOP.roundText ? ` (${SHOP.roundText})` : ""} หรือ <b>ซื้อขาด</b> ใช้ได้ตลอด · ซื้อรายรอบซ้ำจะต่อเวลาจากวันหมดอายุเดิม</span></li>
      </ul>
      <div className="pp-pkgs">
        {PACKAGES.filter(p => p.key !== "A" || !owned.has("A")).map(p => (
          <div key={p.key} className={`pp-pkg ${p.best ? "best" : ""}`}>
            {p.best && <span className="pp-pkg-ribbon">คุ้มที่สุด</span>}
            <b>{p.name}</b>
            <span className="pp-muted small">{p.desc}</span>
            <div className="pp-pkg-prices">
              {(["round", "lifetime"] as const).map(t => (
                <button key={t} className={pick?.pkg === p.key && pick.term === t ? "on" : ""} onClick={() => choose(p.key, t)}>
                  <span>{t === "round" ? "รายรอบ 3 เดือน" : "ซื้อขาด"}</span>
                  <b>{priceOf(p.key, t, t === "round" ? p.round : p.lifetime) || "สอบถาม"}</b>
                </button>
              ))}
            </div>
            {owned.has(p.key) && <span className="pp-mine">มีแล้ว · ซื้อซ้ำเพื่อต่ออายุ</span>}
          </div>
        ))}
      </div>
      <p className="pp-muted small">แตะราคาเพื่อเลือกแพ็กนั้นในขั้นตอนด้านล่าง</p>
      <h3>วิธีซื้อ</h3>
      <ol className="pp-list">
        <li>เลือกแพ็กและแบบ (รายรอบ / ซื้อขาด) · มีแพ็กอยู่แล้วและอยากได้เพิ่ม ระบบคิดให้จ่ายแค่ส่วนต่าง</li>
        <li>สแกน QR ที่ขึ้นมา (ยอดเงินตรงตามแพ็กแล้ว ไม่ต้องพิมพ์เอง){SHOP.bankText ? ` · ${SHOP.bankText}` : ""}</li>
        <li>แนบรูปสลิปแล้วกดส่ง</li>
        <li>ทีมงานตรวจยอดแล้วเปิดสิทธิ์ให้บัญชีนี้ ({email}) ไม่ต้องกรอกคีย์ สถานะการตรวจแสดงในฟอร์มด้านล่าง{SHOP.contactText ? ` · สอบถาม: ${SHOP.contactText}` : ""}</li>
      </ol>
      <div ref={form} className="pp-buy-form">
        <PayForm key={pick?.n ?? 0} email={email} onApproved={onChanged} initial={pick && { pkg: pick.pkg, term: pick.term }} />
      </div>
      {SHOP.contactUrl && <a className="pp-btn pp-btn-gold" href={SHOP.contactUrl} target="_blank" rel="noopener noreferrer">ติดต่อซื้อ</a>}
    </div>
  );
}
