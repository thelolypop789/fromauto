import { useState } from "react";
import { supabase, thaiError } from "./api";
import { IconBook, IconChart, IconTarget } from "./icons";
import Mascot from "./Mascot";

// Set VITE_PREP_EMAIL_LOGIN=off (Vercel env) to hide email-code login until SMTP is configured.
const EMAIL_LOGIN = import.meta.env.VITE_PREP_EMAIL_LOGIN !== "off";

export default function Login() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const google = async () => {
    setError("");
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/prep` },
    });
    if (err) setError(thaiError(err));
  };

  const sendCode = async () => {
    if (busy || !/^\S+@\S+\.\S+$/.test(email.trim())) { setError("กรุณากรอกอีเมลให้ถูกต้อง"); return; }
    setBusy(true); setError("");
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/prep` },
    });
    setBusy(false);
    if (err) setError(thaiError(err)); else setSent(true);
  };

  const verify = async () => {
    if (busy || code.trim().length < 6) return;
    setBusy(true); setError("");
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (err) setError("รหัสไม่ถูกต้องหรือหมดอายุ ลองขอรหัสใหม่");
  };

  return (
    <div className="pp-center">
      <div className="pp-login-wrap">
        <section className="pp-login-hero">
          <Mascot mood="wave" size={132} className="pp-login-mascot" />
          <h1>ซ้อมสอบ SOBPREP</h1>
          <p>ซ้อมข้อสอบครูผู้ช่วย ซ้อมไม่ซ้ำ เฉลยทุกข้อ ทำซ้ำจนเคลียร์ พร้อมวิเคราะห์จุดอ่อน</p>
          <ul className="pp-feats">
            <li><IconTarget /><div><b>ฟรี 3 ชุด</b><span>เลือกหมวดเอง ระบบจัดข้อสอบให้</span></div></li>
            <li><IconBook /><div><b>เฉลยละเอียดทุกข้อ</b><span>เห็นคำอธิบายและอ้างอิงกฎหมายทันทีหลังตอบ</span></div></li>
            <li><IconChart /><div><b>วิเคราะห์จุดแข็งจุดอ่อน</b><span>รู้ว่าควรอ่านหมวดไหนเพิ่ม</span></div></li>
          </ul>
        </section>
        <section className="pp-login">
          <h2>เข้าสู่ระบบ</h2>
          <p className="pp-muted" style={{ margin: "0 0 20px" }}>ใช้บัญชี Google เริ่มซ้อมได้ทันที ไม่ต้องสมัคร</p>
          <button className="pp-btn pp-btn-google" onClick={google}>
            <svg className="pp-g" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            เข้าสู่ระบบด้วย Google
          </button>

          {EMAIL_LOGIN && <div className="pp-or">หรือใช้อีเมล</div>}

          {EMAIL_LOGIN && (!sent ? (
            <>
              <input className="pp-input" type="email" inputMode="email" autoComplete="email" placeholder="อีเมลของคุณ"
                value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && sendCode()} />
              <button className="pp-btn pp-btn-primary" onClick={sendCode} disabled={busy}>
                {busy ? "กำลังส่ง..." : "ส่งรหัสเข้าสู่ระบบ"}
              </button>
            </>
          ) : (
            <>
              <p className="pp-muted">ส่งรหัส 6 หลักไปที่ <b>{email}</b> แล้ว (ดูในกล่องจดหมายขยะด้วย)</p>
              <input className="pp-input pp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="รหัส 6 หลัก"
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} onKeyDown={e => e.key === "Enter" && verify()} />
              <button className="pp-btn pp-btn-primary" onClick={verify} disabled={busy || code.length < 6}>
                {busy ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
              </button>
              <button className="pp-link" onClick={() => { setSent(false); setCode(""); }}>เปลี่ยนอีเมล / ขอรหัสใหม่</button>
            </>
          ))}
          {error && <div className="pp-error">{error}</div>}
          <p className="pp-muted small"><a className="pp-link" href="/prep/guide">คู่มือการใช้งาน</a> · <a className="pp-link" href="/prep/sample/">ตัวอย่างข้อสอบ</a> · <a className="pp-link" href="/prep/privacy">ความเป็นส่วนตัวและข้อกำหนด</a></p>
        </section>
      </div>
    </div>
  );
}
