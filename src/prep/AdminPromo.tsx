import { useCallback, useEffect, useState } from "react";
import { PACKAGE_LABEL, rpc, thaiError, type PackageKey } from "./api";

type Promo = {
  code: string; kind: "percent" | "amount"; value: number; packages: PackageKey[] | null; max_uses: number | null;
  expires_at: string | null; active: boolean; note: string | null; created_at: string;
  pending: number; approved: number; revenue: number; discount: number;
};
const ALL_PKGS: PackageKey[] = ["A", "B", "ALL"];
const day = (s: string) => new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
const off = (p: Pick<Promo, "kind" | "value">) => (p.kind === "percent" ? `ลด ${p.value}%` : `ลด ${p.value} บาท`);
const post = (p: Promo) => `ใช้โค้ด ${p.code} ${off(p)} ตอนซื้อแพ็กที่ sobprep.com/prep → อัปเกรด → ช่อง "โค้ดส่วนลด"${p.expires_at ? ` · ใช้ได้ถึง ${day(new Date(new Date(p.expires_at).getTime() - 1).toISOString())}` : ""}${p.max_uses ? ` · ${p.max_uses} สิทธิ์แรกเท่านั้น` : ""}`;

// Codes customers type themselves at checkout (for posts, campaigns, groups). Hand-given discounts stay in the list below.
export default function AdminPromo() {
  const [list, setList] = useState<Promo[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const [f, setF] = useState({ code: "", kind: "percent" as Promo["kind"], value: "20", pkgs: [] as PackageKey[], max: "", until: "", note: "" });

  const load = useCallback(() => rpc<Promo[]>("prep_admin_promo_list").then(setList).catch(e => setError(thaiError(e))), []);
  useEffect(() => {
    let alive = true;
    rpc<Promo[]>("prep_admin_promo_list").then(l => { if (alive) setList(l); }).catch(e => { if (alive) setError(thaiError(e)); });
    return () => { alive = false; };
  }, []);

  const create = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await rpc("prep_admin_promo_create", {
        p_code: f.code, p_kind: f.kind, p_value: Number(f.value),
        p_packages: f.pkgs.length ? f.pkgs : null, p_max_uses: f.max ? Number(f.max) : null,
        p_expires_on: f.until || null, p_note: f.note || null,
      });
      setF({ ...f, code: "", note: "" });
      await load();
    } catch (e) { setError(thaiError(e)); }
    setBusy(false);
  };
  const toggle = async (p: Promo) => {
    if (p.active && !confirm(`ปิดโค้ด ${p.code}? ลูกค้าจะใช้โค้ดนี้ไม่ได้ (คำสั่งซื้อที่ส่งแล้วไม่กระทบ)`)) return;
    try { await rpc("prep_admin_promo_set_active", { p_code: p.code, p_active: !p.active }); await load(); } catch (e) { setError(thaiError(e)); }
  };
  const copy = async (p: Promo) => { try { await navigator.clipboard.writeText(post(p)); setCopied(p.code); setTimeout(() => setCopied(""), 1500); } catch { /* no clipboard */ } };

  return (
    <div className="pp-card">
      <h3>โค้ดส่วนลด (ลูกค้ากรอกเอง)</h3>
      <p className="pp-muted small">ใช้กับโพสต์/แคมเปญ ลูกค้าพิมพ์โค้ดตอนซื้อ ระบบคิดราคาใหม่ให้เอง 1 บัญชีใช้ได้ 1 ครั้ง · ถ้าจะให้ฟรี ใช้ฟอร์ม "ให้ส่วนลด" ด้านบนแทน</p>
      <div className="pp-promo-form">
        <input className="pp-input" placeholder="โค้ด เช่น KRU20" maxLength={30} value={f.code}
          onChange={e => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} />
        <div className="pp-seg">
          <button className={f.kind === "percent" ? "on" : ""} onClick={() => setF({ ...f, kind: "percent" })}>ลดเป็น %</button>
          <button className={f.kind === "amount" ? "on" : ""} onClick={() => setF({ ...f, kind: "amount" })}>ลดเป็นบาท</button>
        </div>
        <label className="small">ส่วนลด<input className="pp-input" type="number" min={1} max={f.kind === "percent" ? 90 : undefined} value={f.value}
          onChange={e => setF({ ...f, value: e.target.value })} /></label>
        <label className="small">จำกัดจำนวนครั้ง (ว่าง = ไม่จำกัด)<input className="pp-input" type="number" min={1} value={f.max} onChange={e => setF({ ...f, max: e.target.value })} /></label>
        <label className="small">ใช้ได้ถึงวันที่ (ว่าง = ไม่หมดอายุ)<input className="pp-input" type="date" value={f.until} onChange={e => setF({ ...f, until: e.target.value })} /></label>
        <div className="small">ใช้กับแพ็ก (ไม่เลือก = ทุกแพ็ก)
          <div className="pp-row" style={{ gap: 6, flexWrap: "wrap" }}>
            {ALL_PKGS.map(k => (
              <button key={k} className={`pp-chip-btn ${f.pkgs.includes(k) ? "on" : ""}`}
                onClick={() => setF({ ...f, pkgs: f.pkgs.includes(k) ? f.pkgs.filter(x => x !== k) : [...f.pkgs, k] })}>{PACKAGE_LABEL[k]}</button>
            ))}
          </div>
        </div>
        <input className="pp-input" placeholder="บันทึก (ไม่บังคับ) เช่น แคมเปญกลุ่ม FB" maxLength={200} value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
        <button className="pp-btn pp-btn-gold" disabled={busy || f.code.length < 3 || !Number(f.value)} onClick={create}>สร้างโค้ด</button>
      </div>
      {error && <div className="pp-error">{error}</div>}

      {list === null && !error && <div className="pp-spinner" />}
      {list?.length === 0 && <p className="pp-muted">ยังไม่มีโค้ด</p>}
      {list?.map(p => (
        <div key={p.code} className={`pp-keyrow ${p.active ? "" : "off"}`}>
          <div>
            <b className="pp-promo-code">{p.code}</b> <span>{off(p)}</span>
            <div className="pp-muted small">
              {p.packages ? p.packages.map(k => PACKAGE_LABEL[k]).join(", ") : "ทุกแพ็ก"}
              {p.max_uses ? ` · ใช้แล้ว ${p.pending + p.approved}/${p.max_uses}` : ` · ใช้แล้ว ${p.pending + p.approved}`}
              {p.pending ? ` (รอตรวจ ${p.pending})` : ""}
              {p.expires_at ? ` · หมดอายุ ${day(new Date(new Date(p.expires_at).getTime() - 1).toISOString())}` : ""}
              {p.note ? ` · ${p.note}` : ""}
            </div>
            {p.approved > 0 && <div className="small">ขายได้ {p.approved} รายการ · รับ {p.revenue.toLocaleString("th-TH")} บาท · ส่วนลดรวม {p.discount.toLocaleString("th-TH")} บาท</div>}
          </div>
          <div className="pp-row" style={{ flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            {!p.active ? <span className="pp-chip">ปิดแล้ว</span> : null}
            {p.active && <button className="pp-link small" onClick={() => copy(p)}>{copied === p.code ? "คัดลอกแล้ว" : "คัดลอกข้อความโพสต์"}</button>}
            <button className="pp-link small" onClick={() => toggle(p)}>{p.active ? "ปิดโค้ด" : "เปิดอีกครั้ง"}</button>
          </div>
        </div>
      ))}
    </div>
  );
}
