import { useEffect, useState } from "react";
import { PACKAGE_LABEL, TRACK_LABEL, fmtUntil, rpc, supabase, thaiError, type Me, type PackageKey, type Profile } from "./api";
import MajorPicker from "./MajorPicker";
import { IconCrown, IconLogout } from "./icons";
import InstallBanner from "./InstallBanner";
import MyReports from "./MyReports";
import Notifications from "./Notifications";
import Feedback from "./Feedback";
import GroupKeys from "./GroupKeys";
import { ask as confirmDialog } from "./dialog";

const noop = () => { /* nothing to refresh */ };
type Props = {
  me: Me; email: string; profile: Profile; onMajor: (code: string, name: string) => void; onProfile?: (p: Profile) => void;
  onChanged: () => void; onNotifRead?: () => void; onBuy: () => void;
};

// "ฉัน" (/prep/me): the account, packages, major, notices, keys, feedback and data deletion. Buying lives on /prep/buy.
export default function Account({ me, email, profile, onMajor, onProfile, onChanged, onNotifRead, onBuy }: Props) {
  const [picking, setPicking] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const pkgs = me.packages ?? [];
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
          <div className="pp-muted small">สอบครูผู้ช่วย {TRACK_LABEL[profile.track ?? "obec"]} · วิชาเอกของฉัน</div>
          <b>{profile.major_name ?? "ยังไม่ได้เลือก"}</b>
        </div>
        <button className="pp-btn pp-btn-outline" onClick={() => setPicking(true)}>{profile.major ? "เปลี่ยน" : "เลือกวิชาเอก"}</button>
      </div>
      {picking && <MajorPicker current={profile.major} track={profile.track} onTrack={onProfile} onClose={() => setPicking(false)} onSaved={onMajor} />}

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
        <div className="pp-card pp-buy-cta">
          <div><b>{pkgs.length ? "ซื้อแพ็กเพิ่ม / ต่ออายุ" : "อัปเกรดเป็นสมาชิก"}</b><span className="pp-muted small">สร้างชุดได้ไม่จำกัดในหมวดของแพ็ก</span></div>
          <button className="pp-btn pp-btn-gold" onClick={onBuy}><IconCrown size={18} />ดูแพ็ก</button>
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

      <Feedback page="me" />

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
    if (busy || !(await confirmDialog({ title: "ขอลบบัญชีและข้อมูลทั้งหมด?", body: "ทีมงานจะลบบัญชีและข้อมูลทั้งหมดของคุณ รวมถึงสิทธิ์แพ็กที่ซื้อไว้ ลบแล้วกู้คืนไม่ได้", ok: "ขอลบข้อมูล", danger: true }))) return;
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
