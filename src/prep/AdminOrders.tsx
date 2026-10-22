import { useEffect, useState } from "react";
import { PACKAGE_LABEL, TERM_LABEL, fmtUntil, rpc, supabase, thaiError, type PackageKey } from "./api";
import AdminPrices from "./AdminPrices";
import { IconCheck, IconX } from "./icons";

type Row = {
  id: number; email: string | null; package: PackageKey; term: "round" | "lifetime"; amount: number | null; credit: number; list_price: number | null; promo_code?: string | null; discount?: number; seats?: number; group_name?: string | null;
  slip_path: string; note: string | null; status: "pending" | "approved" | "rejected"; admin_note: string | null;
  created_at: string; reviewed_at: string | null; active_packages: PackageKey[];
};
const fmt = (s: string) => new Date(s).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });

export default function AdminOrders({ onChanged }: { onChanged?: () => void }) {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    rpc<Row[]>("prep_admin_orders", { p_status: status, p_limit: 100 })
      .then(r => { if (live) { setRows(r); setError(""); } })
      .catch(e => { if (live) setError(thaiError(e)); });
    return () => { live = false; };
  }, [status]);

  const done = (id: number) => { setRows(prev => prev?.filter(r => r.id !== id) ?? null); onChanged?.(); };

  return (
    <>
      <p className="pp-note">เปิดแอปธนาคารเช็กว่ามีเงินเข้าจริงและยอดตรงแพ็กก่อนกดอนุมัติทุกครั้ง · อนุมัติแล้วสิทธิ์เปิดให้ผู้ซื้อทันที (รายรอบต่อจากวันหมดอายุเดิม)</p>
      <div className="pp-seg">
        {([["pending", "รอตรวจ"], ["approved", "อนุมัติแล้ว"], ["rejected", "ไม่ผ่าน"]] as const).map(([k, l]) => (
          <button key={k} className={status === k ? "on" : ""} onClick={() => setStatus(k)}>{l}</button>
        ))}
      </div>
      {error && <div className="pp-error">{error}</div>}
      {!rows && !error && <div className="pp-spinner" />}
      {rows?.length === 0 && <div className="pp-card pp-empty"><p className="pp-muted">ไม่มีรายการ</p></div>}
      {rows?.map(r => <OrderCard key={r.id} r={r} onDone={done} />)}
      <AdminPrices />
    </>
  );
}

function OrderCard({ r, onDone }: { r: Row; onDone: (id: number) => void }) {
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Slips are private: a signed link valid for 10 minutes.
  useEffect(() => {
    let live = true;
    supabase.storage.from("prep-slips").createSignedUrl(r.slip_path, 600).then(({ data, error }) => {
      if (!live) return;
      if (error) setErr("เปิดรูปสลิปไม่ได้: " + error.message); else setUrl(data.signedUrl);
    });
    return () => { live = false; };
  }, [r.slip_path]);

  const review = async (approve: boolean) => {
    if (busy) return;
    if (!approve && !note.trim() && !confirm("ปฏิเสธโดยไม่ระบุเหตุผล? (ผู้ซื้อจะเห็นข้อความนี้)")) return;
    if (approve && !confirm(`อนุมัติ ${PACKAGE_LABEL[r.package]} · ${TERM_LABEL[r.term]} ให้ ${r.email ?? "ผู้ใช้"}?`)) return;
    setBusy(true); setErr("");
    try { await rpc("prep_admin_review_order", { p_id: r.id, p_approve: approve, p_note: note.trim() || null }); onDone(r.id); }
    catch (e) { setErr(thaiError(e)); setBusy(false); }
  };

  return (
    <div className={`pp-card pp-order st-${r.status}`}>
      <div className="pp-order-grid">
        <a className="pp-order-slip" href={url || undefined} target="_blank" rel="noopener noreferrer">
          {url ? <img src={url} alt={`สลิปคำสั่งซื้อ #${r.id}`} /> : <div className="pp-spinner" />}
        </a>
        <div className="pp-order-info">
          <div className="pp-order-h">
            <span className="pp-pkg-badge">{PACKAGE_LABEL[r.package]}</span>
            <b>{TERM_LABEL[r.term]}{r.amount ? ` · ${r.amount} บาท` : ""}</b>
          </div>
          <div>{r.email ?? "-"}</div>
          <div className={r.credit ? "pp-note" : "pp-muted small"}>
            {r.credit ? `อัปเกรด: ราคาเต็ม ${r.list_price ?? "-"} − หักแพ็กเดิม ${r.credit} = ${r.amount} บาท` : `ราคาแพ็ก ${r.list_price ?? "-"} บาท`} · ยอดในสลิปต้องเป็น {r.amount} บาท
          </div>
          {(r.seats ?? 1) > 1 && <div className="pp-note">แพ็กกลุ่ม <b>{r.group_name}</b> {r.seats} คน · ยอดในสลิปต้องเป็น {r.amount} บาท · เมื่ออนุมัติ ระบบสร้างคีย์ {r.seats} ชุดให้ผู้ซื้อในแอปเอง (ไม่ต้องส่งคีย์ให้)</div>}
          {r.promo_code && <div className="pp-note">โค้ด <b>{r.promo_code}</b> ลด {r.discount} บาท · ยอดในสลิปต้องเป็น {r.amount} บาท</div>}
          <div className="pp-muted small">#{r.id} · ส่งเมื่อ {fmt(r.created_at)}{r.reviewed_at ? ` · ตรวจเมื่อ ${fmt(r.reviewed_at)}` : ""}</div>
          {r.note && <div className="small">หมายเหตุผู้ซื้อ: {r.note}</div>}
          <div className="pp-muted small">แพ็กที่มีอยู่ตอนนี้: {r.active_packages.length ? r.active_packages.map(k => PACKAGE_LABEL[k]).join(", ") : "ไม่มี"}</div>
          {r.admin_note && <div className="pp-myrep-note"><b>ตอบกลับ:</b> {r.admin_note}</div>}
          {r.status === "pending" && (
            <>
              <input className="pp-input" maxLength={300} placeholder="ข้อความถึงผู้ซื้อ (ไม่บังคับ) เช่น ยอดไม่ตรง กรุณาโอนเพิ่ม 30 บาท" value={note} onChange={e => setNote(e.target.value)} />
              <div className="pp-row">
                <button className="pp-btn pp-btn-ghost" disabled={busy} onClick={() => review(false)}><IconX />ไม่ผ่าน</button>
                <button className="pp-btn pp-btn-gold" disabled={busy} onClick={() => review(true)}><IconCheck />อนุมัติ เปิดสิทธิ์</button>
              </div>
            </>
          )}
          {r.status === "approved" && <div className="pp-muted small">เปิดสิทธิ์แล้ว ({r.term === "round" ? "90 วัน" : fmtUntil(null)})</div>}
          {err && <div className="pp-error">{err}</div>}
        </div>
      </div>
    </div>
  );
}
