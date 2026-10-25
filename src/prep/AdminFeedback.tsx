import { useCallback, useEffect, useState } from "react";
import { PACKAGE_LABEL, rpc, thaiError, type PackageKey } from "./api";
import { KIND, Stars } from "./Feedback";

type Item = { id: number; kind: keyof typeof KIND; rating: number | null; body: string; public_ok: boolean; page: string | null;
  status: "new" | "seen" | "done"; admin_note: string | null; created_at: string; replied_at: string | null; email: string | null; packages: PackageKey[] };
type Data = { counts: { new: number; all: number; reviews: number; avg: number | null }; items: Item[] };
const STATUS: Record<Item["status"], [string, string]> = { new: ["ใหม่", "warn"], seen: ["อ่านแล้ว", ""], done: ["เสร็จแล้ว", "ok"] };
const fmt = (s: string) => new Date(s).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });

// แอดมิน → ผู้ใช้ → ข้อเสนอแนะ: everything users sent from the account page. A reply is shown to the user and sent as a
// notification; "อ่านแล้ว" / "เสร็จแล้ว" only change the status they see.
export default function AdminFeedback({ onChanged }: { onChanged?: () => void }) {
  const [filter, setFilter] = useState<"new" | "all" | "review">("new");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(0);
  const load = useCallback(() => {
    rpc<Data>("prep_admin_feedback", { p_status: filter === "new" ? "new" : null, p_limit: 200 }).then(setData).catch(e => setError(thaiError(e)));
  }, [filter]);
  useEffect(load, [load]);

  const set = async (it: Item, status: Item["status"], note?: string) => {
    setBusy(it.id);
    try {
      await rpc("prep_admin_feedback_set", { p_id: it.id, p_status: status, p_note: note ?? null });
      setNotes(n => ({ ...n, [it.id]: "" })); load(); onChanged?.();
    } catch (e) { alert(thaiError(e)); }
    setBusy(0);
  };

  if (error) return <div className="pp-card"><div className="pp-error">{error}</div></div>;
  if (!data) return <div className="pp-spinner" />;
  const items = filter === "review" ? data.items.filter(i => i.kind === "review") : data.items;
  return (
    <div className="pp-card pp-fb-admin">
      <h3>รีวิว / ข้อเสนอแนะ</h3>
      <p className="pp-muted small">
        ใหม่ {data.counts.new} · ทั้งหมด {data.counts.all} · รีวิว {data.counts.reviews}
        {data.counts.avg != null && <> · เฉลี่ย <b>{data.counts.avg}</b> ★</>}
      </p>
      <div className="pp-seg pp-seg-sub">
        {([["new", "ยังไม่อ่าน"], ["all", "ทั้งหมด"], ["review", "เฉพาะรีวิว"]] as const).map(([k, l]) => (
          <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      {!items.length && <p className="pp-muted">{filter === "new" ? "อ่านครบแล้ว 🎉" : "ยังไม่มีข้อความ"}</p>}
      {items.map(it => (
        <div key={it.id} className="pp-fb-row">
          <div className="pp-fb-meta">
            <span>{KIND[it.kind].icon} {KIND[it.kind].label}</span>
            {it.rating != null && <Stars value={it.rating} size={15} />}
            <span className={`pp-badge ${STATUS[it.status][1]}`}>{STATUS[it.status][0]}</span>
            {it.kind === "review" && <span className={`pp-badge ${it.public_ok ? "ok" : ""}`}>{it.public_ok ? "ให้นำไปแสดงได้" : "ไม่ให้แสดง"}</span>}
          </div>
          <div className="pp-muted small">
            {it.email ?? "(ลบบัญชีแล้ว)"} · {it.packages.length ? it.packages.map(p => PACKAGE_LABEL[p]).join(", ") : "ฟรี"} · {fmt(it.created_at)}
          </div>
          {it.body ? <div className="pp-fb-body">{it.body}</div> : <div className="pp-muted small">(ให้ดาวอย่างเดียว)</div>}
          {it.admin_note && <div className="pp-myrep-note"><b>ตอบแล้ว{it.replied_at ? ` (${fmt(it.replied_at)})` : ""}:</b> {it.admin_note}</div>}
          <textarea className="pp-input" rows={2} maxLength={1000} placeholder="ตอบกลับ (ผู้ใช้จะได้รับแจ้งในหน้าบัญชี)"
            value={notes[it.id] ?? ""} onChange={e => setNotes(n => ({ ...n, [it.id]: e.target.value }))} />
          <div className="pp-fb-actions">
            <button className="pp-btn pp-btn-primary sm" disabled={busy === it.id || !(notes[it.id] ?? "").trim()}
              onClick={() => set(it, "done", notes[it.id])}>ส่งคำตอบ</button>
            {it.status === "new" && <button className="pp-btn pp-btn-ghost sm" disabled={busy === it.id} onClick={() => set(it, "seen")}>อ่านแล้ว</button>}
            {it.status !== "done" && <button className="pp-btn pp-btn-ghost sm" disabled={busy === it.id} onClick={() => set(it, "done")}>เสร็จแล้ว</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
