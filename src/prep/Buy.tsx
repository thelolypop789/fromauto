import { useRef, useState, useEffect } from "react";
import { TERM_LABEL, rpc, type Me, type PackageKey, type Price, type Term } from "./api";
import { LIFETIME_LAST_DAY, PACKAGES, SHOP, lifetimeOpen } from "./config";
import { IconCheck, IconCrown } from "./icons";
import PayForm from "./PayForm";

const TERM_ORDER: Term[] = ["year", "round", "lifetime"];
const isTerm = (t: string | null): t is Term => t === "round" || t === "year" || t === "lifetime";

// /prep/buy: packages, how to pay and the payment form. Tapping a price on a card picks that package and term in the
// form below (the form is remounted with it), so the buyer does not choose twice.
export default function Buy({ me, email, onChanged }: { me: Me; email: string; onChanged: () => void }) {
  const [prices, setPrices] = useState<Price[]>([]);
  // A link can pick the package and term (/prep/buy?pkg=ALL&term=lifetime, from the free-limit card or a campaign).
  const [pick, setPick] = useState<{ pkg: PackageKey; term: Term; n: number } | null>(() => {
    const q = new URLSearchParams(window.location.search);
    const pkg = q.get("pkg"), term = q.get("term");
    if (!PACKAGES.some(p => p.key === pkg) || !isTerm(term)) return null;
    // ลิงก์เก่าที่ชี้ซื้อขาด (ปิดขายหลัง 15 พ.ย. 69) → รายปี
    return { pkg: pkg as PackageKey, term: term === "lifetime" && !lifetimeOpen() ? "year" : term, n: 1 };
  });
  const form = useRef<HTMLDivElement>(null);
  useEffect(() => { if (pick?.n === 1) window.setTimeout(() => form.current?.scrollIntoView({ block: "start" }), 300); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { rpc<Price[]>("prep_prices").then(setPrices).catch(() => { /* falls back to config */ }); }, []);
  // Days to the next exam on the calendar: most buyers decide within hours of signing up, close to an exam date.
  const [exam, setExam] = useState<{ exam_title: string | null; days_left: number | null } | null>(null);
  useEffect(() => { rpc<typeof exam>("prep_plan").then(setExam).catch(() => { /* no countdown */ }); }, []);
  const priceOf = (k: PackageKey, t: Term, fallback: string) => {
    const x = prices.find(y => y.package === k && y.term === t);
    return x ? `${x.amount} บาท` : fallback;
  };
  const pkgs = me.packages ?? [];
  // แบบที่เปิดขาย: ตามราคาในฐานข้อมูล (เฉพาะที่ active) · ก่อนโหลดเสร็จ/โหลดไม่ได้ ใช้ตามวันที่
  // (ถึง 15 พ.ย. 69: รายรอบ + ซื้อขาด · ตั้งแต่ 16 พ.ย.: รายปี + รายรอบ)
  const [lifeOpen] = useState(lifetimeOpen);
  const termsOf = (k: PackageKey): Term[] => {
    const db = TERM_ORDER.filter(t => prices.some(x => x.package === k && x.term === t));
    return db.length ? db : lifeOpen ? ["round", "lifetime"] : ["year", "round"];
  };
  const owned = new Set(pkgs.map(p => p.package));
  const lifetimeAll = pkgs.some(p => p.package === "ALL" && !p.expires_at);
  const choose = (pkg: PackageKey, term: Term) => {
    setPick(p => ({ pkg, term, n: (p?.n ?? 0) + 1 }));
    window.setTimeout(() => form.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const others = PACKAGES.filter(p => !p.best);
  const card = (p: (typeof PACKAGES)[number]) => (
    <div key={p.key} className={`pp-pkg ${p.best ? "best" : ""}`}>
      {p.best && <span className="pp-pkg-ribbon">คุ้มที่สุด</span>}
      <b>{p.name}</b>
      <span className="pp-muted small">{p.desc}</span>
      <div className="pp-pkg-prices">
        {termsOf(p.key).map(t => (
          <button key={t} className={pick?.pkg === p.key && pick.term === t ? "on" : ""} onClick={() => choose(p.key, t)}>
            <span>{TERM_LABEL[t]}</span>
            <b>{priceOf(p.key, t, p[t]) || "สอบถาม"}</b>
            {t === "lifetime" && <em>{p.best ? "ใช้ได้ทุกรอบสอบ · " : ""}ขายถึง {LIFETIME_LAST_DAY} เท่านั้น</em>}
            {t === "year" && <em>ถูกกว่าซื้อ 3 เดือน 4 ครั้ง</em>}
          </button>
        ))}
      </div>
      {owned.has(p.key) && <span className="pp-mine">มีแล้ว · ซื้อซ้ำเพื่อต่ออายุ</span>}
    </div>
  );

  if (lifetimeAll) {
    return <div className="pp-card"><h3>คุณมีแพ็กครบทุกภาคแบบซื้อขาดแล้ว</h3><p className="pp-muted">ใช้งานได้ทุกหมวดตลอด ไม่ต้องซื้อเพิ่ม</p></div>;
  }
  return (
    <div className="pp-card pp-upgrade">
      <h2><IconCrown size={22} /> {pkgs.length ? "ซื้อแพ็กเพิ่ม / ต่ออายุ" : "อัปเกรดเป็นสมาชิก"}</h2>
      {exam?.days_left != null && exam.days_left >= 0 && exam.days_left <= 60 && (
        <p className="pp-wall-count">{exam.days_left === 0 ? "วันนี้วันสอบ" : <>อีก <b>{exam.days_left}</b> วัน</>}{exam.exam_title ? ` ถึง${exam.exam_title}` : " ถึงวันสอบ"}</p>
      )}
      {lifeOpen && (
        <div className="pp-life-last">
          <b>⏰ แพ็กซื้อขาด ขายถึง {LIFETIME_LAST_DAY} (23:59 น.) เท่านั้น</b>
          <span>ซื้อไว้ก่อนใช้ได้ทุกรอบสอบตลอดไป ไม่ต้องจ่ายเพิ่ม · ตั้งแต่ 16 พ.ย. แพ็กครบทุกภาคจะเป็น <b>รายปี 219 บาท</b> / 3 เดือน 129 บาท{pkgs.length ? " · มีแพ็กรายรอบอยู่แล้ว อัปเกรดเป็นซื้อขาดจ่ายแค่ส่วนต่าง" : ""}</span>
        </div>
      )}
      <ul className="pp-perks">
        <li><IconCheck />สร้างชุดใหม่ได้ไม่จำกัดในหมวดของแพ็ก (ชุดละสูงสุด 200 ข้อ)</li>
        <li><IconCheck />ดึงข้อใหม่จากคลังทั้งหมด พร้อมเฉลยและคำอธิบายทุกข้อ</li>
        <li><IconCheck /><span>{lifeOpen
          ? <>เลือกได้ทั้ง <b>รายรอบ</b>{SHOP.roundText ? ` (${SHOP.roundText})` : ""} หรือ <b>ซื้อขาด</b> ใช้ได้ตลอด</>
          : <><b>รายปี</b> ใช้ได้ 12 เดือน หรือ <b>รายรอบ</b>{SHOP.roundText ? ` (${SHOP.roundText})` : ""}</>} · ซื้อซ้ำจะต่อเวลาจากวันหมดอายุเดิม</span></li>
      </ul>
      {/* 97% of orders are the full pack: it leads, the single-part packs sit behind "แพ็กแยกภาค". */}
      <div className="pp-pkgs">{PACKAGES.filter(p => p.best).map(card)}</div>
      {others.length > 0 && (
        <details className="pp-pkg-more" open={!!pick && !PACKAGES.find(p => p.key === pick.pkg)?.best}>
          <summary>แพ็กภาค ข + วิชาเอก</summary>
          <div className="pp-pkgs">{others.map(card)}</div>
        </details>
      )}
      <p className="pp-muted small">แตะราคาเพื่อเลือกแพ็กนั้นในขั้นตอนด้านล่าง</p>
      <h3>วิธีซื้อ</h3>
      <ol className="pp-list">
        <li>เลือกแพ็กและแบบ ({termsOf("ALL").map(t => TERM_LABEL[t]).join(" / ")}) · มีแพ็กอยู่แล้วและอยากได้เพิ่ม ระบบคิดให้จ่ายแค่ส่วนต่าง</li>
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
