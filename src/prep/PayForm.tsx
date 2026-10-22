import { useCallback, useEffect, useState } from "react";
import { PACKAGE_LABEL, TERM_LABEL, fmtUntil, rpc, supabase, thaiError, track, type Order, type GroupQuote, type PackageKey, type PromoQuote, type Quote } from "./api";
import { PACKAGES, SHOP } from "./config";
import { IconCheck } from "./icons";

const ORDER_STATUS: Record<Order["status"], [string, string]> = {
  pending: ["รอตรวจสอบ", "warn"], approved: ["อนุมัติแล้ว", "ok"], rejected: ["ไม่ผ่าน", "bad"],
};
const fmt = (s: string) => new Date(s).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

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
  const [choice, setChoice] = useState<{ pkg: PackageKey; term: "round" | "lifetime" } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  // Promo code: the typed text, the code applied, and the server's price for (code, package, term).
  // A code from a campaign link (?promo=) is applied as soon as the buy screen opens.
  const [linkPromo] = useState(() => { try { return localStorage.getItem("pp-promo") ?? ""; } catch { return ""; } });
  const [promoText, setPromoText] = useState(linkPromo);
  const [applied, setApplied] = useState(linkPromo);
  const [pq, setPq] = useState<{ key: string; res: PromoQuote | null; err: string } | null>(null);
  // Group packs: pay once for N seats, get N keys to use or share.
  const [deals, setDeals] = useState<GroupQuote[]>([]);
  const [seats, setSeats] = useState(1);
  useEffect(() => { rpc<GroupQuote[]>("prep_group_quotes").then(setDeals).catch(() => setDeals([])); }, []);

  // Refresh the account when an order was approved since the page loaded data last.
  const load = useCallback(() => { rpc<Quote[]>("prep_quotes").then(setQuotes).catch(() => {
      // Server pricing not available (older database): fall back to the list prices in config.
      setQuotes(PACKAGES.flatMap(k => (["round", "lifetime"] as const).map(t => {
        const amount = Number((t === "round" ? k.round : k.lifetime).replace(/\D/g, "")) || undefined;
        return { package: k.key, term: t, base: amount, credit: 0, amount, kind: "new" as const, expires_at: undefined };
      })));
    }); return rpc<Order[]>("prep_my_orders").then(o => {
    setOrders(o);
    if (o.some(x => x.status === "approved" && x.reviewed_at && Date.now() - new Date(x.reviewed_at).getTime() < 600_000)) onApproved();
  }).catch(() => { /* list is optional */ }); }, [onApproved]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { track("buy_view"); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  // The server prices every choice for this account (full price, or the difference when upgrading).
  const quoteOf = (k: PackageKey, t: "round" | "lifetime") => quotes?.find(x => x.package === k && x.term === t);
  // Until the buyer picks, show the first choice that can actually be bought (e.g. the upgrade offer).
  const firstOpen = (["ALL", "B", "A"] as const).flatMap(k => (["round", "lifetime"] as const).map(t => ({ pkg: k as PackageKey, term: t })))
    .find(c => { const x = quoteOf(c.pkg, c.term); return !!x && !x.error; });
  const { pkg, term } = choice ?? firstOpen ?? { pkg: "ALL" as PackageKey, term: "round" as const };
  const q = quoteOf(pkg, term);
  const promoKey = applied ? `${applied}|${pkg}|${term}` : "";
  const promo = pq && pq.key === promoKey ? pq : null;      // only a result for the current choice counts
  const promoOk = promo?.res && !promo.res.error ? promo.res : null;
  useEffect(() => { if (promoOk) track("promo_apply"); }, [promoOk]);
  const deal = seats > 1 ? deals.find(x => x.seats === seats && x.package === pkg && x.term === term) : undefined;
  const group = !!deal;
  const amount = deal ? deal.total : promoOk ? promoOk.amount ?? null : q && !q.error ? q.amount ?? null : null;
  const price = amount ? `${amount} บาท` : "";
  const qr = amount ? SHOP.qrByAmount[amount] || SHOP.qrImage : "";
  const fixed = !!(amount && SHOP.qrByAmount[amount]);
  const offers = (quotes ?? []).filter(x => x.kind === "upgrade" && !x.error && x.package === "ALL");

  useEffect(() => {
    if (!promoKey) return;
    let alive = true;
    rpc<PromoQuote>("prep_check_promo", { p_code: applied, p_package: pkg, p_term: term })
      .then(r => { if (alive) setPq({ key: promoKey, res: r, err: r.error ? thaiError(r.error) : "" }); })
      .catch(e => { if (alive) setPq({ key: promoKey, res: null, err: thaiError(e) }); });
    return () => { alive = false; };
  }, [promoKey, applied, pkg, term]);

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
      const path = `${uid}/${crypto.randomUUID()}.${img.ext}`;
      const up = await supabase.storage.from("prep-slips").upload(path, img.blob, { contentType: img.type, upsert: false });
      if (up.error) throw up.error;
      await rpc("prep_submit_order", { p_package: pkg, p_term: term, p_amount: amount, p_slip_path: path, p_note: note.trim() || null, p_promo: !group && promoOk ? applied : null, p_seats: group ? seats : 1 });
      setMsg({ ok: true, text: "ส่งสลิปแล้ว ทีมงานจะตรวจและเปิดสิทธิ์ให้โดยเร็ว ดูสถานะได้ด้านล่าง" });
      setFile(null); setPreview(""); setNote(""); setSeats(1); setApplied(""); setPromoText("");
      try { localStorage.removeItem("pp-promo"); } catch { /* ignore */ }
      load();
    } catch (e) { setMsg({ ok: false, text: thaiError(e) }); }
    setBusy(false);
  };

  return (
    <div className="pp-payform">
      <h3>ซื้อแพ็ก</h3>
      {offers.length > 0 && (
        <div className="pp-note pp-offer">
          <b>มีแพ็กอยู่แล้ว? อัปเกรดเป็นครบทุกภาค จ่ายแค่ส่วนต่าง</b>
          <div className="pp-row">
            {offers.map(o => (
              <button key={o.term} className="pp-btn pp-btn-gold" onClick={() => setChoice({ pkg: "ALL", term: o.term })}>
                {TERM_LABEL[o.term]} · จ่ายเพิ่ม {o.amount} บาท
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="small pp-muted"><span className="pp-step">1</span>เลือกแพ็ก</label>
      <div className="pp-seg">
        {PACKAGES.map(p => <button key={p.key} className={pkg === p.key ? "on" : ""} onClick={() => setChoice({ pkg: p.key, term })}>{PACKAGE_LABEL[p.key]}</button>)}
      </div>
      <div className="pp-seg">
        {(["round", "lifetime"] as const).map(t => (
          <button key={t} className={term === t ? "on" : ""} onClick={() => setChoice({ pkg, term: t })}>
            {TERM_LABEL[t]} · {(() => {
              const x = quoteOf(pkg, t);
              if (!x) return "…";
              if (x.error) return "ไม่ต้องซื้อ";
              return x.credit ? <><s>{x.base}</s> {x.amount} บาท</> : `${x.amount} บาท`;
            })()}
          </button>
        ))}
      </div>
      {deals.length > 0 && (
        <div className="pp-seats">
          <label className="small pp-muted">ซื้อกี่คน? ซื้อหลายคนถูกกว่า</label>
          <div className="pp-seats-row">
            <button className={seats === 1 ? "on" : ""} onClick={() => setSeats(1)}><b>คนเดียว</b><span>ราคาปกติ</span></button>
            {[...new Set(deals.map(x => x.seats))].map(n => {
              const d = deals.find(x => x.seats === n && x.package === pkg && x.term === term);
              if (!d) return null;
              return (
                <button key={n} className={seats === n ? "on" : ""} onClick={() => setSeats(n)}>
                  <b>{d.emoji} {d.name}</b>
                  <span>{n} คน · คนละ {d.per_seat} บาท</span>
                  <em>ลด {d.pct_off}% · ประหยัด {d.save} บาท</em>
                </button>
              );
            })}
          </div>
          {group && deal && (
            <p className="pp-note">จ่ายครั้งเดียว <b>{deal.total} บาท</b> ได้คีย์ <b>{deal.seats} ชุด</b> ({PACKAGE_LABEL[pkg]} · {TERM_LABEL[term]}) ใช้เองหรือส่งให้เพื่อน แต่ละคนเริ่มนับอายุเมื่อกรอกคีย์ของตัวเอง
              {term === "round" ? " (รายรอบ 3 เดือน)" : ""} · คีย์จะขึ้นในหน้านี้หลังทีมงานตรวจสลิปแล้ว · ใช้ร่วมกับโค้ดส่วนลดไม่ได้</p>
          )}
        </div>
      )}
      {!group && (
      <div className="pp-promo">
        <label className="small pp-muted" htmlFor="pp-promo-in">โค้ดส่วนลด (ถ้ามี)</label>
        <div className="pp-row">
          <input id="pp-promo-in" className="pp-input" placeholder="กรอกโค้ดส่วนลด" maxLength={30} value={promoText} disabled={!!applied}
            autoCapitalize="characters" autoComplete="off" onChange={e => setPromoText(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === "Enter" && promoText.trim()) setApplied(promoText.trim()); }} />
          {applied
            ? <button className="pp-btn pp-btn-ghost" onClick={() => { setApplied(""); setPromoText(""); setPq(null); }}>ยกเลิกโค้ด</button>
            : <button className="pp-btn pp-btn-primary" disabled={!promoText.trim()} onClick={() => setApplied(promoText.trim())}>ใช้โค้ด</button>}
        </div>
        {applied && !promo && <span className="pp-muted small">กำลังตรวจโค้ด…</span>}
        {promo?.err && <div className="pp-error">{promo.err}</div>}
        {promoOk && <div className="pp-success">ใช้โค้ด <b>{promoOk.code}</b> แล้ว: {promoOk.before} − ส่วนลด {promoOk.discount} = <b>{promoOk.amount} บาท</b></div>}
      </div>
      )}
      <label className="small pp-muted"><span className="pp-step">2</span>สแกนจ่าย {price && <b className="pp-paysum">{price}</b>}</label>
      {!group && q?.error && <div className="pp-note">{thaiError(q.error)}</div>}
      {group ? null : q && !q.error && q.credit ? (
        <p className="pp-note">อัปเกรด: ราคาเต็ม {q.base} − หักแพ็กเดิมที่จ่ายแล้ว {q.credit} = <b>{q.amount} บาท</b> · สิทธิ์ที่ได้ {PACKAGE_LABEL[pkg]} {fmtUntil(q.expires_at ?? null)}</p>
      ) : q && !q.error && q.expires_at ? (
        <p className="pp-muted small">สิทธิ์ที่ได้ {PACKAGE_LABEL[pkg]} {fmtUntil(q.expires_at)}</p>
      ) : null}
      {qr && (
        <div className="pp-payqr">
          <img key={qr} src={qr} alt={`QR ชำระเงิน ${price}`} width={337} height={438} />
          <div className="pp-payqr-t">
            <b>{PACKAGE_LABEL[pkg]} · {TERM_LABEL[term]}</b>
            <span>{fixed ? `QR นี้ล็อกยอด ${price} ไว้แล้ว สแกนแล้วกดยืนยันได้เลย` : `ใส่ยอด ${price || "ตามแพ็ก"} เอง`}</span>
            <span className="pp-muted small">เปิดบนมือถือ? กดบันทึกรูป QR แล้วเลือก "สแกนจากรูป" ในแอปธนาคาร</span>
            <a className="pp-btn pp-btn-outline" href={qr} download={`QR-${PACKAGE_LABEL[pkg]}-${TERM_LABEL[term]}.png`}>บันทึกรูป QR</a>
          </div>
        </div>
      )}
      <label className="small pp-muted"><span className="pp-step">3</span>แนบสลิปแล้วกดส่ง</label>
      <label className={`pp-drop small-drop ${busy ? "off" : ""}`}>
        <input type="file" accept="image/*" disabled={busy} onChange={e => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        {preview ? <img src={preview} alt="สลิปที่เลือก" className="pp-slip-prev" /> : <>
          <b>แตะเพื่อแนบรูปสลิป</b>
          <span className="pp-muted small">ภาพหน้าจอสลิปจากแอปธนาคาร</span>
        </>}
      </label>
      <input className="pp-input" maxLength={300} placeholder="หมายเหตุ (ไม่บังคับ) เช่น เวลาโอน" value={note} onChange={e => setNote(e.target.value)} />
      <button className="pp-btn pp-btn-gold pp-wide" disabled={!file || busy || !amount} onClick={send}>
        {busy ? "กำลังส่ง..." : `ส่งสลิป · ${group && deal ? `${deal.name} ${deal.seats} คน · ` : ""}${PACKAGE_LABEL[pkg]} ${TERM_LABEL[term]}${price ? ` · ${price}` : ""}`}
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
                <span>{(o.seats ?? 1) > 1 ? `${o.group_name ?? "แพ็กกลุ่ม"} ${o.seats} คน · ` : ""}{PACKAGE_LABEL[o.package]} · {TERM_LABEL[o.term]}{o.amount ? ` · ${o.amount} บาท` : ""}</span>
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
