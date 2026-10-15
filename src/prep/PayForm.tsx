import { useCallback, useEffect, useState } from "react";
import { PACKAGE_LABEL, TERM_LABEL, fmtUntil, rpc, supabase, thaiError, type Order, type PackageKey } from "./api";
import { PACKAGES } from "./config";
import { IconCheck } from "./icons";

const ORDER_STATUS: Record<Order["status"], [string, string]> = {
  pending: ["รอตรวจสอบ", "warn"], approved: ["อนุมัติแล้ว", "ok"], rejected: ["ไม่ผ่าน", "bad"],
};
const fmt = (s: string) => new Date(s).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const baht = (s: string) => Number(s.replace(/[^\d]/g, "")) || null;

// Phone photos are large: re-encode to a JPEG of at most 1600px. Formats the browser cannot
// decode (HEIC outside Safari) are uploaded as they are.
async function shrink(file: File): Promise<{ blob: Blob; type: string; ext: string }> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    const blob = await new Promise<Blob>((ok, bad) => c.toBlob(b => (b ? ok(b) : bad(new Error("encode"))), "image/jpeg", 0.85));
    return { blob, type: "image/jpeg", ext: "jpg" };
  } catch {
    const heic = /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
    return { blob: file, type: heic ? "image/heic" : file.type || "image/jpeg", ext: heic ? "heic" : "jpg" };
  }
}

export default function PayForm({ email, onApproved }: { email: string; onApproved: () => void }) {
  const [pkg, setPkg] = useState<PackageKey>("ALL");
  const [term, setTerm] = useState<"round" | "lifetime">("round");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  // Refresh the account when an order was approved since the page loaded data last.
  const load = useCallback(() => rpc<Order[]>("prep_my_orders").then(o => {
    setOrders(o);
    if (o.some(x => x.status === "approved" && x.reviewed_at && Date.now() - new Date(x.reviewed_at).getTime() < 600_000)) onApproved();
  }).catch(() => { /* list is optional */ }), [onApproved]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const info = PACKAGES.find(p => p.key === pkg)!;
  const price = term === "round" ? info.round : info.lifetime;

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) { setMsg({ ok: false, text: "ไฟล์ใหญ่เกินไป" }); return; }
    setFile(f); setMsg(null);
    setPreview(URL.createObjectURL(f));
  };

  const send = async () => {
    if (!file || busy) return;
    setBusy(true); setMsg(null);
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) throw new Error("not_authenticated");
      const img = await shrink(file);
      const path = `${uid}/${Date.now()}.${img.ext}`;
      const up = await supabase.storage.from("prep-slips").upload(path, img.blob, { contentType: img.type, upsert: false });
      if (up.error) throw up.error;
      await rpc("prep_submit_order", { p_package: pkg, p_term: term, p_amount: baht(price), p_slip_path: path, p_note: note.trim() || null });
      setMsg({ ok: true, text: "ส่งสลิปแล้ว ทีมงานจะตรวจและเปิดสิทธิ์ให้โดยเร็ว ดูสถานะได้ด้านล่าง" });
      setFile(null); setPreview(""); setNote("");
      load();
    } catch (e) { setMsg({ ok: false, text: thaiError(e) }); }
    setBusy(false);
  };

  return (
    <div className="pp-payform">
      <h3>แจ้งชำระเงิน (ส่งสลิปในแอป)</h3>
      <label className="small pp-muted">แพ็กที่ซื้อ</label>
      <div className="pp-seg">
        {PACKAGES.map(p => <button key={p.key} className={pkg === p.key ? "on" : ""} onClick={() => setPkg(p.key)}>{PACKAGE_LABEL[p.key]}</button>)}
      </div>
      <div className="pp-seg">
        {(["round", "lifetime"] as const).map(t => (
          <button key={t} className={term === t ? "on" : ""} onClick={() => setTerm(t)}>
            {TERM_LABEL[t]} · {(t === "round" ? info.round : info.lifetime) || "สอบถาม"}
          </button>
        ))}
      </div>
      <label className={`pp-drop small-drop ${busy ? "off" : ""}`}>
        <input type="file" accept="image/*" disabled={busy} onChange={e => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        {preview ? <img src={preview} alt="สลิปที่เลือก" className="pp-slip-prev" /> : <>
          <b>แตะเพื่อแนบรูปสลิป</b>
          <span className="pp-muted small">ภาพหน้าจอสลิปจากแอปธนาคาร</span>
        </>}
      </label>
      <input className="pp-input" maxLength={300} placeholder="หมายเหตุ (ไม่บังคับ) เช่น เวลาโอน" value={note} onChange={e => setNote(e.target.value)} />
      <button className="pp-btn pp-btn-gold pp-wide" disabled={!file || busy} onClick={send}>
        {busy ? "กำลังส่ง..." : `ส่งสลิป · ${PACKAGE_LABEL[pkg]} ${TERM_LABEL[term]}${price ? ` · ${price}` : ""}`}
      </button>
      <p className="pp-muted small">บัญชีที่จะได้รับสิทธิ์: {email} · ปกติตรวจภายในวันเดียวกัน</p>
      {msg && <div className={msg.ok ? "pp-success" : "pp-error"}>{msg.text}</div>}

      {orders.length > 0 && (
        <div className="pp-orders">
          <b>รายการแจ้งชำระของฉัน</b>
          {orders.map(o => (
            <div key={o.id} className="pp-myrep">
              <div className="pp-myrep-h">
                <span className={`pp-badge ${ORDER_STATUS[o.status][1]}`}>{o.status === "approved" && <IconCheck size={13} />}{ORDER_STATUS[o.status][0]}</span>
                <span>{PACKAGE_LABEL[o.package]} · {TERM_LABEL[o.term]}{o.amount ? ` · ${o.amount} บาท` : ""}</span>
              </div>
              <div className="pp-muted small">ส่งเมื่อ {fmt(o.created_at)}{o.status === "approved" ? ` · สิทธิ์${fmtUntil(o.access_until ?? null)}` : ""}</div>
              {o.admin_note && <div className="pp-myrep-note"><b>ทีมงาน:</b> {o.admin_note}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
