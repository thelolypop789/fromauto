import { useCallback, useEffect, useState } from "react";
import { PACKAGE_LABEL, inboxTerm, rpc, thaiError, type AdminInboxRow, type PackageKey } from "./api";

const STATUS: Record<AdminInboxRow["status"], [string, string]> = {
  pending: ["รอลูกค้าเปิดใช้", "warn"], claimed: ["เปิดใช้แล้ว", "ok"], revoked: ["ยกเลิกแล้ว", ""], expired: ["หมดเขต", ""],
};
const fmt = (s: string) => new Date(s).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });

// Send a package to a customer's e-mail from inside the app; they activate it with one tap after signing in.
export default function AdminSendKey() {
  const [rows, setRows] = useState<AdminInboxRow[] | null>(null);
  const [email, setEmail] = useState("");
  const [pkg, setPkg] = useState<PackageKey>("ALL");
  const [term, setTerm] = useState<"days" | "lifetime">("days");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => { rpc<AdminInboxRow[]>("prep_admin_key_inbox").then(setRows).catch(e => setMsg({ ok: false, text: thaiError(e) })); }, []);
  useEffect(load, [load]);

  const send = async () => {
    if (busy) return;
    if (!note.trim() && !confirm("ไม่ได้ใส่หมายเหตุ (ยอดโอน/เวลาโอน) ส่งต่อไหม?")) return;
    if (!confirm(`ส่ง ${PACKAGE_LABEL[pkg]} · ${term === "lifetime" ? "ซื้อขาด" : "รายรอบ 3 เดือน"} ให้ ${email.trim()}?\nตรวจเงินเข้าบัญชีแล้วใช่ไหม`)) return;
    setBusy(true); setMsg(null);
    try {
      const r = await rpc<{ registered: boolean; email: string }>("prep_admin_send_key", {
        p_email: email, p_package: pkg, p_duration_days: term === "days" ? 90 : null, p_expires_on: null,
        p_note: note.trim() || null, p_message: message.trim() || null,
      });
      setMsg({ ok: true, text: r.registered
        ? `ส่งให้ ${r.email} แล้ว ลูกค้าเปิดแอปจะเห็นปุ่ม "เปิดใช้งาน" ที่หน้าแรกและหน้าบัญชี`
        : `ส่งให้ ${r.email} แล้ว แต่อีเมลนี้ยังไม่เคยเข้าแอป ให้ลูกค้าล็อกอินด้วย Google อีเมลนี้ แล้วจะเห็นปุ่มเปิดใช้งาน` });
      setEmail(""); setNote(""); setMessage(""); load();
    } catch (e) { setMsg({ ok: false, text: thaiError(e) }); }
    setBusy(false);
  };
  const cancel = async (r: AdminInboxRow) => {
    if (!confirm(`ยกเลิกแพ็กที่ส่งให้ ${r.email}?`)) return;
    try { await rpc("prep_admin_revoke_key", { p_id: r.key_id }); load(); } catch (e) { setMsg({ ok: false, text: thaiError(e) }); }
  };

  return (
    <div className="pp-card">
      <h3>ส่งแพ็กให้ลูกค้าในระบบ</h3>
      <p className="pp-note">ใช้เมื่อลูกค้าโอนเงินนอกแอป (แชตเพจ/LINE) พิมพ์อีเมล Google ของลูกค้า ระบบส่งแพ็กเข้ากล่องของเขา ไม่ต้องคัดลอกคีย์ เช็กเงินเข้าบัญชีก่อนทุกครั้ง</p>
      <input className="pp-input" type="email" inputMode="email" placeholder="อีเมลของลูกค้า (บัญชี Google ที่จะใช้ล็อกอิน)" value={email} onChange={e => setEmail(e.target.value)} />
      <div className="pp-seg">
        {(["A", "B", "ALL"] as const).map(k => <button key={k} className={pkg === k ? "on" : ""} onClick={() => setPkg(k)}>{PACKAGE_LABEL[k]}</button>)}
      </div>
      <div className="pp-seg">
        <button className={term === "days" ? "on" : ""} onClick={() => setTerm("days")}>รายรอบ 3 เดือน</button>
        <button className={term === "lifetime" ? "on" : ""} onClick={() => setTerm("lifetime")}>ซื้อขาด</button>
      </div>
      <input className="pp-input" maxLength={200} placeholder="หมายเหตุสำหรับแอดมิน: ยอดโอน / เวลาโอน / ช่องทาง" value={note} onChange={e => setNote(e.target.value)} />
      <input className="pp-input" maxLength={300} placeholder="ข้อความถึงลูกค้า (ไม่บังคับ) เช่น ขอบคุณที่ซื้อครับ" value={message} onChange={e => setMessage(e.target.value)} />
      <button className="pp-btn pp-btn-primary" disabled={busy || !email.trim()} onClick={send}>{busy ? "กำลังส่ง..." : "ส่งแพ็กให้ลูกค้า"}</button>
      {msg && <div className={msg.ok ? "pp-success" : "pp-error"}>{msg.text}</div>}
      {rows && rows.length > 0 && (
        <div className="pp-inbox-list">
          <b>ที่ส่งไปแล้ว</b>
          {rows.map(r => (
            <div key={r.id} className="pp-keyrow">
              <div>
                <div>{r.email} <span className={`pp-chip ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span></div>
                <div className="pp-muted small">{PACKAGE_LABEL[r.package]} · {inboxTerm(r)} · ส่ง {fmt(r.created_at)}{r.claimed_at ? ` · เปิดใช้ ${fmt(r.claimed_at)}` : ""}{r.status === "pending" && !r.registered ? " · ยังไม่เคยเข้าแอป" : ""}</div>
              </div>
              {r.status === "pending" && <button className="pp-link small" onClick={() => cancel(r)}>ยกเลิก</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
