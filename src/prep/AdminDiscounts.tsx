import { useCallback, useEffect, useMemo, useState } from "react";
import { PACKAGE_LABEL, TERM_LABEL, rpc, thaiError, type PackageKey, type Price } from "./api";

type Term = "round" | "lifetime";
type Item = {
  id: number; recipient: string; contact: string | null; reason: string | null; package: PackageKey; term: Term;
  list_price: number; price: number; created_at: string; paid_at: string | null; cancelled_at: string | null;
  redeemed_at: string | null; redeemed_email: string | null;
};
type Data = { totals: { count: number; discount_given: number; received: number; awaiting_payment: number; unused: number }; items: Item[] };
type Made = { key: string; recipient: string; package: PackageKey; term: Term; price: number; list_price: number };

const baht = (n: number) => `${n.toLocaleString("th-TH")} บาท`;
const day = (s: string) => new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
const message = (m: Made) => [
  `รหัสเปิดใช้งาน ซ้อมสอบ SOBPREP: ${m.key}`,
  `แพ็ก: ${PACKAGE_LABEL[m.package]} · ${TERM_LABEL[m.term]}`,
  m.price === 0 ? `ราคา: ฟรี (ปกติ ${baht(m.list_price)})` : `ราคาพิเศษ: ${baht(m.price)} (ปกติ ${baht(m.list_price)})`,
  "วิธีใช้: เข้า sobprep.com/prep → เข้าสู่ระบบ → หน้าบัญชี → กรอกรหัส",
  "รหัสใช้ได้ 1 ครั้ง",
].join("\n");

// Discounts given by hand: issue a package key at a special price and keep the record (who, how much, used yet, paid yet).
export default function AdminDiscounts() {
  const [prices, setPrices] = useState<Price[]>([]);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<Made | null>(null);
  const [copied, setCopied] = useState(false);
  const [f, setF] = useState({ recipient: "", contact: "", reason: "", package: "ALL" as PackageKey, term: "lifetime" as Term, price: "" });

  const fetchAll = useCallback(() => Promise.all([rpc<Data>("prep_admin_discounts"), rpc<Price[]>("prep_prices")]), []);
  const load = useCallback(async () => {
    try { const [d, p] = await fetchAll(); setData(d); setPrices(p); } catch (e) { setError(thaiError(e)); }
  }, [fetchAll]);
  useEffect(() => {
    let alive = true;
    fetchAll().then(([d, p]) => { if (alive) { setData(d); setPrices(p); } }).catch(e => { if (alive) setError(thaiError(e)); });
    return () => { alive = false; };
  }, [fetchAll]);

  const list = useMemo(() => prices.find(p => p.package === f.package && p.term === f.term)?.amount ?? null, [prices, f.package, f.term]);
  const price = f.price === "" ? null : Number(f.price);
  const valid = !!f.recipient.trim() && list !== null && price !== null && Number.isInteger(price) && price >= 0 && price <= list;

  const create = async () => {
    if (!valid || list === null || price === null) return;
    if (!window.confirm(`ออกส่วนลดให้ ${f.recipient.trim()}\n${PACKAGE_LABEL[f.package]} · ${TERM_LABEL[f.term]}\nราคา ${price === 0 ? "ฟรี" : baht(price)} (ปกติ ${baht(list)})?`)) return;
    setBusy(true); setError(""); setCopied(false);
    try {
      const r = await rpc<{ key: string; price: number; list_price: number }>("prep_admin_discount_create", {
        p_recipient: f.recipient, p_contact: f.contact || null, p_reason: f.reason || null, p_package: f.package, p_term: f.term, p_price: price,
      });
      setMade({ key: r.key, recipient: f.recipient.trim(), package: f.package, term: f.term, price: r.price, list_price: r.list_price });
      setF(x => ({ ...x, recipient: "", contact: "", reason: "", price: "" }));
      await load();
    } catch (e) { setError(thaiError(e)); }
    setBusy(false);
  };
  const act = async (fn: string, args: Record<string, unknown>, ask?: string) => {
    if (ask && !window.confirm(ask)) return;
    setError("");
    try { await rpc(fn, args); await load(); } catch (e) { setError(thaiError(e)); }
  };
  const copy = async () => {
    if (!made) return;
    try { await navigator.clipboard.writeText(message(made)); setCopied(true); } catch { setCopied(false); }
  };
  const t = data?.totals;

  return (
    <>
      <div className="pp-card">
        <h3>ให้ส่วนลด</h3>
        <p className="pp-muted small">ออกรหัสแพ็กในราคาพิเศษหรือฟรี ผู้รับกรอกรหัสในหน้าบัญชีเหมือนคีย์ปกติ ระบบบันทึกว่าให้ใคร ลดเท่าไร ใช้แล้วหรือยัง และรับเงินแล้วหรือยัง</p>
        <div className="pp-ai-edit">
          <label><span className="pp-muted small">ให้ใคร (ชื่อ)</span>
            <input className="pp-input" maxLength={120} value={f.recipient} onChange={e => setF({ ...f, recipient: e.target.value })} placeholder="เช่น ครูเต้ รร.วังหลวง" /></label>
          <label><span className="pp-muted small">ช่องทางติดต่อ (ไม่บังคับ)</span>
            <input className="pp-input" maxLength={120} value={f.contact} onChange={e => setF({ ...f, contact: e.target.value })} placeholder="LINE / เบอร์ / เฟซบุ๊ก" /></label>
          <label><span className="pp-muted small">เหตุผล (ไม่บังคับ)</span>
            <input className="pp-input" maxLength={300} value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} placeholder="เช่น เพื่อนครู / ชดเชยระบบล่ม / แจกในกลุ่ม" /></label>
          <div className="pp-seg pp-seg-sub" role="group" aria-label="แพ็ก">
            {(["ALL", "A", "B"] as PackageKey[]).map(p => <button key={p} type="button" className={f.package === p ? "on" : ""} onClick={() => setF({ ...f, package: p })}>{PACKAGE_LABEL[p]}</button>)}
          </div>
          <div className="pp-seg pp-seg-sub" role="group" aria-label="ระยะเวลา">
            {(["lifetime", "round"] as Term[]).map(x => <button key={x} type="button" className={f.term === x ? "on" : ""} onClick={() => setF({ ...f, term: x })}>{TERM_LABEL[x]}</button>)}
          </div>
          <label><span className="pp-muted small">ราคาที่เก็บ (บาท) · ราคาปกติ {list !== null ? baht(list) : "-"}</span>
            <input className="pp-input" type="number" min={0} max={list ?? undefined} inputMode="numeric" value={f.price} onChange={e => setF({ ...f, price: e.target.value })} /></label>
          {list !== null && (
            <div className="pp-ai-presets">
              <span className="pp-muted small">เลือกเร็ว:</span>
              <button type="button" className="pp-chipbtn" onClick={() => setF({ ...f, price: "0" })}>ฟรี</button>
              <button type="button" className="pp-chipbtn" onClick={() => setF({ ...f, price: String(Math.round(list / 2)) })}>ลด 50%</button>
              <button type="button" className="pp-chipbtn" onClick={() => setF({ ...f, price: String(Math.max(0, list - 50)) })}>ลด 50 บาท</button>
              <button type="button" className="pp-chipbtn" onClick={() => setF({ ...f, price: String(Math.max(0, list - 100)) })}>ลด 100 บาท</button>
            </div>
          )}
          {list !== null && price !== null && price <= list && price >= 0 && (
            <p className="small"><b>ลด {baht(list - price)}</b> <span className="pp-muted">({list > 0 ? Math.round((100 * (list - price)) / list) : 0}%){price === 0 ? " · ฟรี" : ""}</span></p>
          )}
          {price !== null && list !== null && price > list && <div className="pp-error">ราคาที่เก็บต้องไม่เกินราคาปกติ</div>}
        </div>
        {error && <div className="pp-error">{error}</div>}
        <div className="pp-ai-act"><button className="pp-btn pp-btn-primary" disabled={!valid || busy} onClick={create}>{busy ? "กำลังสร้าง…" : "ออกรหัสส่วนลด"}</button></div>
        {made && (
          <div className="pp-ai-human">
            <p><b>ออกรหัสให้ {made.recipient} แล้ว</b> <span className="pp-muted small">(รหัสแสดงครั้งเดียว คัดลอกเก็บไว้)</span></p>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", background: "#fff", padding: 10, borderRadius: 10, fontSize: 14, margin: "8px 0" }}>{message(made)}</pre>
            <div className="pp-ai-act"><button className="pp-btn pp-btn-ghost" onClick={copy}>{copied ? "คัดลอกแล้ว ✓" : "คัดลอกข้อความส่งให้ผู้รับ"}</button></div>
          </div>
        )}
      </div>

      <div className="pp-card">
        <h3>ส่วนลดที่ให้ไป{t ? ` (${t.count})` : ""}</h3>
        {t && (
          <div className="pp-mj-funnel">
            <div><b>{t.discount_given.toLocaleString("th-TH")}</b><span>ส่วนลดรวม (บาท)</span></div>
            <div><b>{t.received.toLocaleString("th-TH")}</b><span>รับเงินแล้ว (บาท)</span></div>
            <div><b>{t.awaiting_payment.toLocaleString("th-TH")}</b><span>รอรับเงิน (บาท)</span></div>
            <div><b>{t.unused}</b><span>รหัสที่ยังไม่ถูกใช้</span></div>
          </div>
        )}
        {!data && !error && <div className="pp-spinner" />}
        {data && data.items.length === 0 && <p className="pp-muted">ยังไม่มีส่วนลด ส่วนลดที่ให้ก่อนหน้านี้ผ่านแท็บ "คีย์" จะไม่อยู่ในรายการนี้</p>}
        {data?.items.map(i => (
          <div key={i.id} className="pp-keyrow">
            <div>
              <b>{i.recipient}</b>{i.contact && <span className="pp-muted small"> · {i.contact}</span>}
              <div className="pp-muted small">{PACKAGE_LABEL[i.package]} · {TERM_LABEL[i.term]} · {i.price === 0 ? "ฟรี" : baht(i.price)} (ปกติ {baht(i.list_price)}) · ให้เมื่อ {day(i.created_at)}{i.reason ? ` · ${i.reason}` : ""}</div>
              <div className="pp-row" style={{ gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                {i.cancelled_at ? <span className="pp-chip">ยกเลิกแล้ว</span>
                  : i.redeemed_at ? <span className="pp-chip ok">ใช้แล้ว {day(i.redeemed_at)}{i.redeemed_email ? ` · ${i.redeemed_email}` : ""}</span>
                    : <span className="pp-chip warn">ยังไม่ใช้</span>}
                {!i.cancelled_at && i.price > 0 && (i.paid_at ? <span className="pp-chip ok">รับเงินแล้ว</span> : <span className="pp-chip bad">รอรับเงิน</span>)}
              </div>
            </div>
            {!i.cancelled_at && (
              <div className="pp-row" style={{ flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                {i.price > 0 && <button className="pp-link small" onClick={() => act("prep_admin_discount_mark_paid", { p_id: i.id, p_paid: !i.paid_at })}>{i.paid_at ? "ยกเลิกรับเงิน" : "รับเงินแล้ว"}</button>}
                {!i.redeemed_at && <button className="pp-link small" onClick={() => act("prep_admin_discount_cancel", { p_id: i.id }, `ยกเลิกรหัสส่วนลดของ ${i.recipient}? รหัสนี้จะใช้ไม่ได้อีก`)}>ยกเลิก</button>}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
