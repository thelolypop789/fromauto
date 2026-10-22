import { useEffect, useState } from "react";
import { PACKAGE_LABEL, fmtUntil, rpc, supabase, thaiError, type Me, type PackageKey, type Price, type Profile } from "./api";
import MajorPicker from "./MajorPicker";
import { PACKAGES, SHOP } from "./config";
import { IconCheck, IconCrown, IconLogout } from "./icons";
import InstallBanner from "./InstallBanner";
import MyReports from "./MyReports";
import Notifications from "./Notifications";
import PayForm from "./PayForm";
import GroupKeys from "./GroupKeys";

const noop = () => { /* nothing to refresh */ };
type Props = { me: Me; email: string; profile: Profile; onMajor: (code: string, name: string) => void; onChanged: () => void; onNotifRead?: () => void };

export default function Account({ me, email, profile, onMajor, onChanged, onNotifRead }: Props) {
  const [picking, setPicking] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  useEffect(() => { rpc<Price[]>("prep_prices").then(setPrices).catch(() => { /* falls back to config */ }); }, []);
  const priceOf = (k: PackageKey, t: "round" | "lifetime", fallback: string) => {
    const x = prices.find(y => y.package === k && y.term === t);
    return x ? `${x.amount} บาท` : fallback;
  };
  const pkgs = me.packages ?? [];
  const owned = new Set(pkgs.map(p => p.package));
  const lifetimeAll = pkgs.some(p => p.package === "ALL" && !p.expires_at);
  const [now] = useState(() => Date.now());
  const daysLeft = (iso: string | null) => {
    if (!iso) return "";
    const d = Math.ceil((new Date(iso).getTime() - now) / 86_400_000);
    return d <= 30 ? ` · เหลือ ${d} วัน` : "";
  };

  const redeem = async () => {
    if (busy || !key.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const r = await rpc<{ ok: boolean; error?: string; package?: PackageKey; expires_at?: string | null }>("prep_redeem_key", { p_key: key.trim() });
      if (r.ok) {
        const what = r.package ? `${PACKAGE_LABEL[r.package]} · ${fmtUntil(r.expires_at ?? null)}` : "สมาชิก";
        setMsg({ ok: true, text: `เปิดใช้งานสำเร็จ! ${what}` }); setKey(""); onChanged();
      }
      else setMsg({ ok: false, text: r.error === "too_many_attempts" ? "กรอกผิดหลายครั้ง กรุณารอ 15 นาที" : "คีย์ไม่ถูกต้องหรือถูกใช้ไปแล้ว" });
    } catch (e) { setMsg({ ok: false, text: thaiError(e) }); }
    setBusy(false);
  };

  return (
    <>
      <div className="pp-card">
        <div className="pp-profile">
          <div className="pp-avatar">{(email[0] ?? "?").toUpperCase()}</div>
          <div className="pp-profile-t">
            <b>{email}</b>
            <span className="pp-muted small">{me.plan === "paid" ? "สมาชิก" : `บัญชีฟรี · ใช้ไป ${me.free_sets_used}/${me.free_sets_limit} ชุด`}</span>
          </div>
          <button className="pp-btn pp-btn-ghost" onClick={() => supabase.auth.signOut()} aria-label="ออกจากระบบ"><IconLogout />ออก</button>
        </div>
      </div>

      <div className="pp-card"><a className="pp-btn pp-btn-ghost pp-wide" href="/prep/guide">คู่มือการใช้งาน</a></div>

      <div className="pp-card pp-major-card">
        <div>
          <div className="pp-muted small">วิชาเอกของฉัน</div>
          <b>{profile.major_name ?? "ยังไม่ได้เลือก"}</b>
        </div>
        <button className="pp-btn pp-btn-outline" onClick={() => setPicking(true)}>{profile.major ? "เปลี่ยน" : "เลือกวิชาเอก"}</button>
      </div>
      {picking && <MajorPicker current={profile.major} onClose={() => setPicking(false)} onSaved={onMajor} />}

      <InstallBanner always />
      <Notifications onRead={onNotifRead ?? noop} />
      <MyReports />

      {pkgs.length > 0 && (
        <div className="pp-card">
          <h3>แพ็กของฉัน</h3>
          {pkgs.map(p => (
            <div key={p.package} className="pp-pkg-own">
              <span className="pp-pkg-badge">{PACKAGE_LABEL[p.package]}</span>
              <span className="pp-muted">{fmtUntil(p.expires_at)}{daysLeft(p.expires_at)}</span>
            </div>
          ))}
          <p className="pp-muted small">ชุดที่มีเฉพาะหมวดในแพ็กสร้างได้ไม่จำกัด ชุดละสูงสุด 200 ข้อ · หมวดนอกแพ็กใช้สิทธิ์ฟรี 3 ชุด</p>
        </div>
      )}

      {!lifetimeAll && (
        <div className="pp-card pp-upgrade">
          <h2><IconCrown size={22} /> {pkgs.length ? "ซื้อแพ็กเพิ่ม / ต่ออายุ" : "อัปเกรดเป็นสมาชิก"}</h2>
          <ul className="pp-perks">
            <li><IconCheck />สร้างชุดใหม่ได้ไม่จำกัดในหมวดของแพ็ก (ชุดละสูงสุด 200 ข้อ)</li>
            <li><IconCheck />ดึงข้อใหม่จากคลังทั้งหมด พร้อมเฉลยและคำอธิบายทุกข้อ</li>
            <li><IconCheck /><span>เลือกได้ทั้ง <b>รายรอบ</b>{SHOP.roundText ? ` (${SHOP.roundText})` : ""} หรือ <b>ซื้อขาด</b> ใช้ได้ตลอด · ซื้อรายรอบซ้ำจะต่อเวลาจากวันหมดอายุเดิม</span></li>
          </ul>
          <div className="pp-pkgs">
            {PACKAGES.filter(p => p.key !== "A" || !owned.has("A")).map(p => (
              <div key={p.key} className={`pp-pkg ${p.best ? "best" : ""}`}>
                {p.best && <span className="pp-pkg-ribbon">คุ้มที่สุด</span>}
                <b>{p.name}</b>
                <span className="pp-muted small">{p.desc}</span>
                <div className="pp-pkg-prices">
                  <div><span>รายรอบ 3 เดือน</span><b>{priceOf(p.key, "round", p.round) || "สอบถาม"}</b></div>
                  <div><span>ซื้อขาด</span><b>{priceOf(p.key, "lifetime", p.lifetime) || "สอบถาม"}</b></div>
                </div>
                {owned.has(p.key) && <span className="pp-mine">มีแล้ว · ซื้อซ้ำเพื่อต่ออายุ</span>}
              </div>
            ))}
          </div>
          <h3>วิธีซื้อ</h3>
          <ol className="pp-list">
            <li>เลือกแพ็กและแบบ (รายรอบ / ซื้อขาด) ด้านล่าง · มีแพ็กอยู่แล้วและอยากได้เพิ่ม ระบบคิดให้จ่ายแค่ส่วนต่าง</li>
            <li>สแกน QR ที่ขึ้นมา (ยอดเงินตรงตามแพ็กแล้ว ไม่ต้องพิมพ์เอง){SHOP.bankText ? ` · ${SHOP.bankText}` : ""}</li>
            <li>แนบรูปสลิปแล้วกดส่ง</li>
            <li>ทีมงานตรวจยอดแล้วเปิดสิทธิ์ให้บัญชีนี้ ({email}) ไม่ต้องกรอกคีย์{SHOP.contactText ? ` · สอบถาม: ${SHOP.contactText}` : ""}</li>
          </ol>
          <PayForm email={email} onApproved={onChanged} />
          {SHOP.contactUrl && <a className="pp-btn pp-btn-gold" href={SHOP.contactUrl} target="_blank" rel="noopener noreferrer">ติดต่อซื้อ</a>}
        </div>
      )}

      <GroupKeys onChanged={onChanged} />

      <div className="pp-card">
        <h3>มีคีย์แล้ว? เปิดใช้งาน</h3>
        <input className="pp-input pp-code" placeholder="PREP-XXXX-XXXX-XXXX" value={key}
          onChange={e => setKey(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && redeem()} />
        <button className="pp-btn pp-btn-primary" disabled={busy || !key.trim()} onClick={redeem}>{busy ? "กำลังตรวจสอบ..." : "เปิดใช้งาน"}</button>
        {msg && <div className={msg.ok ? "pp-success" : "pp-error"}>{msg.text}</div>}
      </div>

      <DeletionCard />
    </>
  );
}

type Deletion = { id: number; status: "pending" | "done" | "rejected"; created_at: string; handled_at?: string | null } | null;

// Asks the team to delete the account's data. Handled by hand, so the card says so and shows the request's state.
function DeletionCard() {
  const [d, setD] = useState<Deletion | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { rpc<Deletion>("prep_my_deletion").then(setD).catch(() => setD(null)); }, []);
  const ask = async () => {
    if (busy || !confirm("ขอให้ทีมงานลบบัญชีและข้อมูลทั้งหมดของคุณ (รวมถึงสิทธิ์แพ็กที่ซื้อไว้) ยืนยันไหม?")) return;
    setBusy(true); setErr("");
    try { setD(await rpc<Deletion>("prep_request_deletion")); } catch (e) { setErr(thaiError(e)); }
    setBusy(false);
  };
  return (
    <div className="pp-card">
      <h3>ข้อมูลของฉัน</h3>
      {d?.status === "pending"
        ? <p className="pp-muted">ส่งคำขอลบข้อมูลแล้วเมื่อ {new Date(d.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })} ทีมงานจะดำเนินการให้</p>
        : <>
            <p className="pp-muted small">ต้องการเลิกใช้และให้ลบข้อมูล? ทีมงานจะลบให้ด้วยตนเอง ลบแล้วกู้คืนไม่ได้ และสิทธิ์แพ็กที่ซื้อไว้จะหายไปด้วย{d?.status === "done" ? " (คำขอครั้งก่อนดำเนินการแล้ว)" : ""}</p>
            <button className="pp-btn pp-btn-ghost" disabled={busy || d === undefined} onClick={ask}>{busy ? "กำลังส่ง..." : "ขอลบข้อมูลของฉัน"}</button>
          </>}
      {err && <div className="pp-error">{err}</div>}
      <p className="pp-muted small"><a className="pp-link" href="/prep/privacy">ความเป็นส่วนตัวและข้อกำหนด</a></p>
    </div>
  );
}
