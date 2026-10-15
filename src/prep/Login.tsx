import { useState } from "react";
import { supabase, thaiError } from "./api";

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
      <div className="pp-card pp-login">
        <div className="pp-logo">📝</div>
        <h1>ซ้อมข้อสอบครูผู้ช่วย</h1>
        <p className="pp-muted">ซ้อมไม่ซ้ำ เฉลยทุกข้อ ทำซ้ำจนเคลียร์ พร้อมวิเคราะห์จุดอ่อน</p>
        <div className="pp-chips">
          <span>✅ ฟรี 3 ชุด</span><span>📖 เฉลยละเอียด</span><span>📊 วิเคราะห์จุดแข็งจุดอ่อน</span>
        </div>

        <button className="pp-btn pp-btn-google" onClick={google}>
          <span className="pp-g">G</span> เข้าสู่ระบบด้วย Google
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
      </div>
    </div>
  );
}
