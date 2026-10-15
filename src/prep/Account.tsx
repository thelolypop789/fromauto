import { useState } from "react";
import { rpc, supabase, thaiError, type Me } from "./api";
import { SHOP } from "./config";

type Props = { me: Me; email: string; onChanged: () => void };

export default function Account({ me, email, onChanged }: Props) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const redeem = async () => {
    if (busy || !key.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const r = await rpc<{ ok: boolean; error?: string }>("prep_redeem_key", { p_key: key.trim() });
      if (r.ok) { setMsg({ ok: true, text: "เปิดใช้งานสำเร็จ! ใช้งานได้ไม่จำกัดแล้ว" }); setKey(""); onChanged(); }
      else setMsg({ ok: false, text: r.error === "too_many_attempts" ? "กรอกผิดหลายครั้ง กรุณารอ 15 นาที" : "คีย์ไม่ถูกต้องหรือถูกใช้ไปแล้ว" });
    } catch (e) { setMsg({ ok: false, text: thaiError(e) }); }
    setBusy(false);
  };

  return (
    <>
      <div className="pp-card">
        <h2>บัญชีของฉัน</h2>
        <p>{email}</p>
        <p>สถานะ: <b>{me.plan === "paid" ? "สมาชิก (ไม่จำกัด)" : `ฟรี — ใช้ไป ${me.free_sets_used}/${me.free_sets_limit} ชุด`}</b></p>
        <button className="pp-btn pp-btn-ghost" onClick={() => supabase.auth.signOut()}>ออกจากระบบ</button>
      </div>

      {me.plan !== "paid" && (
        <div className="pp-card">
          <h2>อัปเกรดเป็นสมาชิก</h2>
          <ul className="pp-list">
            <li>สร้างชุดใหม่ได้ไม่จำกัด (ชุดละสูงสุด 200 ข้อ)</li>
            <li>ดึงข้อใหม่จากคลังทั้งหมด พร้อมเฉลยและคำอธิบายทุกข้อ</li>
            <li>วิเคราะห์จุดแข็งจุดอ่อนจากข้อมูลที่มากขึ้น แม่นขึ้น</li>
            <li>จ่ายครั้งเดียว</li>
          </ul>
          {SHOP.priceText && <p className="pp-price">{SHOP.priceText}</p>}
          <ol className="pp-list">
            <li>โอนเงิน{SHOP.bankText ? `: ${SHOP.bankText}` : ""}</li>
            <li>ส่งสลิปพร้อมอีเมลที่ใช้สมัคร ({email}){SHOP.contactText ? ` — ${SHOP.contactText}` : ""}</li>
            <li>รับคีย์ แล้วกรอกด้านล่างเพื่อเปิดใช้งาน</li>
          </ol>
          {SHOP.contactUrl && <a className="pp-btn pp-btn-gold" href={SHOP.contactUrl} target="_blank" rel="noopener noreferrer">ติดต่อซื้อ</a>}
        </div>
      )}

      {me.plan !== "paid" && (
        <div className="pp-card">
          <h3>มีคีย์แล้ว? เปิดใช้งาน</h3>
          <input className="pp-input pp-code" placeholder="PREP-XXXX-XXXX-XXXX" value={key}
            onChange={e => setKey(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && redeem()} />
          <button className="pp-btn pp-btn-primary" disabled={busy || !key.trim()} onClick={redeem}>{busy ? "กำลังตรวจสอบ..." : "เปิดใช้งาน"}</button>
          {msg && <div className={msg.ok ? "pp-success" : "pp-error"}>{msg.text}</div>}
        </div>
      )}
    </>
  );
}
