import { useEffect, useState } from "react";
import { PACKAGE_LABEL, TERM_LABEL, rpc, thaiError, type Price } from "./api";
import { SHOP } from "./config";

// Price list (prep.prices). Buyers who already hold part of a package get the difference automatically.
export default function AdminPrices() {
  const [rows, setRows] = useState<Price[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState("");
  useEffect(() => { rpc<Price[]>("prep_prices").then(setRows).catch(e => setMsg({ ok: false, text: thaiError(e) })); }, []);

  const key = (p: Price) => `${p.package}/${p.term}`;
  const save = async (p: Price) => {
    const amount = Number(draft[key(p)]);
    if (!Number.isInteger(amount) || amount < 1) { setMsg({ ok: false, text: "ใส่ราคาเป็นจำนวนเต็มบาท" }); return; }
    setBusy(key(p)); setMsg(null);
    try {
      await rpc("prep_admin_set_price", { p_package: p.package, p_term: p.term, p_amount: amount });
      setRows(prev => prev?.map(x => (key(x) === key(p) ? { ...x, amount } : x)) ?? null);
      setDraft(d => { const n = { ...d }; delete n[key(p)]; return n; });
      setMsg({ ok: true, text: SHOP.qrByAmount[amount] ? "บันทึกแล้ว" : `บันทึกแล้ว · ยังไม่มีรูป QR ล็อกยอด ${amount} บาท ผู้ซื้อจะเห็น QR ไม่ล็อกยอด (สร้างรูปด้วย scripts/prep/make_qr.py)` });
    } catch (e) { setMsg({ ok: false, text: thaiError(e) }); }
    setBusy("");
  };

  return (
    <details className="pp-card">
      <summary><b>ราคาแพ็ก</b> <span className="pp-muted small">แก้ได้โดยไม่ต้อง deploy · ส่วนต่างอัปเกรดคิดให้อัตโนมัติ</span></summary>
      {rows?.map(p => (
        <div key={key(p)} className="pp-row">
          <span style={{ flex: 1 }}>{PACKAGE_LABEL[p.package]} · {TERM_LABEL[p.term]}</span>
          <input className="pp-input" style={{ width: 90 }} inputMode="numeric" aria-label={`ราคา ${PACKAGE_LABEL[p.package]} ${TERM_LABEL[p.term]}`}
            value={draft[key(p)] ?? String(p.amount)} onChange={e => setDraft({ ...draft, [key(p)]: e.target.value.replace(/\D/g, "") })} />
          <button className="pp-btn pp-btn-ghost" disabled={busy === key(p) || draft[key(p)] === undefined} onClick={() => save(p)}>บันทึก</button>
        </div>
      ))}
      {msg && <div className={msg.ok ? "pp-success" : "pp-error"}>{msg.text}</div>}
      <p className="pp-muted small">ราคาใหม่ใช้กับคำสั่งซื้อที่ส่งหลังจากนี้ คำสั่งซื้อที่รอตรวจอยู่ยังใช้ยอดเดิมตอนที่ผู้ซื้อส่ง</p>
    </details>
  );
}
