import { useCallback, useEffect, useState } from "react";
import { useAdminTrack } from "./adminTrack";
import AdminOverview from "./AdminOverview";
import { PACKAGE_LABEL, TERM_LABEL, rpc, thaiError, type PackageKey } from "./api";

type Dash = {
  todo: { pending_orders: number; oldest_pending_at: string | null; open_reports: number; review_queue: number; expiring_7d: number };
  revenue: {
    today: number; last7: number; last30: number; month: number; submitted_30d: number; approved_30d: number; rejected_30d: number;
    avg_review_minutes_30d: number | null; upgrade_orders_30d: number; upgrade_amount_30d: number;
    by_package: { package: PackageKey; term: "round" | "lifetime"; orders: number; amount: number }[];
  };
  keys?: { today: number; last7: number; last30: number; month: number; unpriced_30d: number };
  expiring: { email: string | null; package: PackageKey; expires_at: string }[];
};
type Stats = { users: number; paid: number; free_members?: number; answered_today: number; active_today: number; questions: Record<string, number> | null; open_reports: number; keys_unused: number };

const baht = (n: number) => `${n.toLocaleString("th-TH")} บาท`;
const age = (iso: string | null, now: number) => {
  if (!iso) return "";
  const h = Math.floor((now - new Date(iso).getTime()) / 3_600_000);
  return h >= 24 ? `${Math.floor(h / 24)} วัน ${h % 24} ชม.` : `${Math.max(h, 0)} ชม.`;
};
const date = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short" });

type DelReq = { id: number; email: string | null; note: string | null; created_at: string };

// Pending "delete my data" requests. Deleting is done by hand (Supabase dashboard); this only records that it was handled.
function DeletionRequests() {
  const [rows, setRows] = useState<DelReq[]>([]);
  const load = useCallback(() => { rpc<DelReq[]>("prep_admin_deletion_requests", { p_status: "pending" }).then(setRows).catch(() => { /* secondary */ }); }, []);
  useEffect(load, [load]);
  if (!rows.length) return null;
  const resolve = async (r: DelReq, status: "done" | "rejected") => {
    const word = status === "done" ? "ลบข้อมูลของผู้ใช้นี้เรียบร้อยแล้ว" : "ปฏิเสธคำขอนี้";
    if (!confirm(`${r.email ?? "ผู้ใช้"}: ยืนยันว่า${word}?`)) return;
    try { await rpc("prep_admin_resolve_deletion", { p_id: r.id, p_status: status }); load(); } catch (e) { alert(thaiError(e)); }
  };
  return (
    <div className="pp-card">
      <h3>คำขอลบข้อมูล ({rows.length})</h3>
      <p className="pp-muted small">ลบผู้ใช้ออกจาก Supabase (Authentication → Users) ก่อน แล้วค่อยกด “ลบแล้ว” ที่นี่เพื่อบันทึกว่าจัดการเสร็จ</p>
      {rows.map(r => (
        <div key={r.id} className="pp-keyrow">
          <div>{r.email ?? "?"}<div className="pp-muted small">ขอเมื่อ {date(r.created_at)}{r.note ? ` · ${r.note}` : ""}</div></div>
          <div className="pp-row">
            <button className="pp-link small" onClick={() => resolve(r, "rejected")}>ปฏิเสธ</button>
            <button className="pp-btn pp-btn-ghost" onClick={() => resolve(r, "done")}>ลบแล้ว</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// First tab of the admin area: what needs doing today, money, who is about to lose access, and the old counters.
export default function AdminDashboard({ onGo }: { onGo: (tab: "orders" | "reports" | "review" | "users") => void }) {
  const track = useAdminTrack();
  const [d, setD] = useState<Dash | null>(null);
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [now] = useState(() => Date.now());
  useEffect(() => {
    rpc<Dash>("prep_admin_dashboard", { p_track: track }).then(setD).catch(e => setError(thaiError(e)));
    rpc<Stats>("prep_admin_stats", { p_track: track }).then(setS).catch(() => { /* counters are secondary */ });
  }, [track]);
  if (error) return <div className="pp-error">{error}</div>;
  if (!d) return <div className="pp-spinner" />;
  const t = d.todo, r = d.revenue, k = d.keys;
  // Orders plus keys sold by hand (LINE), when the server reports them.
  const sum = (x: "today" | "last7" | "last30" | "month") => r[x] + (k?.[x] ?? 0);
  const oldHours = t.oldest_pending_at ? (now - new Date(t.oldest_pending_at).getTime()) / 3_600_000 : 0;
  const allClear = !t.pending_orders && !t.open_reports && !t.review_queue && !t.expiring_7d;

  return (
    <>
      {/* Work waiting: only what is non-zero, so a clear day is one quiet line. */}
      <div className="pp-card pp-todo-card">
        <h3>ต้องทำวันนี้{allClear && <span className="pp-muted small"> · ไม่มีงานค้าง 🎉</span>}</h3>
        {!allClear && <div className="pp-todo">
          {t.pending_orders > 0 && <button className={`pp-todo-item ${t.pending_orders ? (oldHours > 12 ? "bad" : "warn") : ""}`} onClick={() => onGo("orders")}>
            <b>{t.pending_orders}</b><span>คำสั่งซื้อรอตรวจ</span>
            <small>ค้างนานสุด {age(t.oldest_pending_at, now)}</small>
          </button>}
          {t.open_reports > 0 && <button className="pp-todo-item warn" onClick={() => onGo("reports")}>
            <b>{t.open_reports}</b><span>รายงานข้อสอบผิด</span>
          </button>}
          {t.review_queue > 0 && <button className="pp-todo-item warn" onClick={() => onGo("review")}>
            <b>{t.review_queue.toLocaleString("th-TH")}</b><span>ข้อสอบรอตรวจ</span>
          </button>}
          {t.expiring_7d > 0 && <div className="pp-todo-item warn">
            <b>{t.expiring_7d}</b><span>แพ็กจะหมดใน 7 วัน</span>
          </div>}
        </div>}
        {d.expiring.length > 0 && (
          <div className="pp-expiring">
            <b>ควรทักไปต่ออายุ</b>
            {d.expiring.map((x, i) => (
              <div key={i} className="pp-keyrow"><div>{x.email ?? "?"} <span className="pp-chip">{PACKAGE_LABEL[x.package]}</span></div><div className="pp-muted small">หมด {date(x.expires_at)}</div></div>
            ))}
            <button className="pp-link small" onClick={() => onGo("users")}>ค้นหาผู้ใช้เพื่อดูรายละเอียด</button>
          </div>
        )}
      </div>

      <DeletionRequests />

      <AdminOverview />

      <details className="pp-card pp-more">
        <summary><h3>รายได้แยกแพ็ก & การตรวจสลิป</h3></summary>
        <div className="pp-kpis">
          <div className="pp-kpi"><b>{sum("today").toLocaleString("th-TH")}</b><span>วันนี้ (บาท)</span></div>
          <div className="pp-kpi"><b>{sum("last7").toLocaleString("th-TH")}</b><span>7 วัน</span></div>
          <div className="pp-kpi"><b>{sum("last30").toLocaleString("th-TH")}</b><span>30 วัน</span></div>
          <div className="pp-kpi"><b>{sum("month").toLocaleString("th-TH")}</b><span>เดือนนี้</span></div>
        </div>
        <p className="pp-muted small">
          คำสั่งซื้อ 30 วัน: ส่งมา {r.submitted_30d} · อนุมัติ {r.approved_30d} · ปฏิเสธ {r.rejected_30d}
          {r.avg_review_minutes_30d != null ? ` · ตรวจเฉลี่ย ${r.avg_review_minutes_30d >= 60 ? `${(r.avg_review_minutes_30d / 60).toFixed(1)} ชม.` : `${r.avg_review_minutes_30d} นาที`}` : ""}
          {r.upgrade_orders_30d > 0 ? ` · อัปเกรดจ่ายส่วนต่าง ${r.upgrade_orders_30d} รายการ (${baht(r.upgrade_amount_30d)})` : ""}
        </p>
        {r.by_package.length > 0 && (
          <div className="pp-guide-table">
            {r.by_package.map(x => (
              <div key={`${x.package}${x.term}`}><b>{PACKAGE_LABEL[x.package]} · {TERM_LABEL[x.term]}</b><span>{x.orders} รายการ · {baht(x.amount)}</span></div>
            ))}
          </div>
        )}
        {k
          ? <p className="pp-muted small">รวมคำสั่งซื้อในแอปที่อนุมัติแล้ว (ตามวันที่อนุมัติ) กับคีย์ที่ขายทาง LINE (ตามวันที่สร้าง จากราคาที่ใส่ตอนสร้าง) · คีย์ 30 วัน {k.last30.toLocaleString("th-TH")} บาท{k.unpriced_30d ? ` · คีย์ไม่มีราคา ${k.unpriced_30d} ใบ ไม่ได้นับ` : ""} · คีย์แจกฟรีไม่นับ</p>
          : <p className="pp-muted small">นับเฉพาะคำสั่งซื้อที่ซื้อในแอปและอนุมัติแล้ว (นับตามวันที่อนุมัติ เวลาไทย) แพ็กที่ให้ด้วยมือหรือขายด้วยคีย์ไม่มียอดเงินในระบบ จึงไม่นับ</p>}
      </details>

      {s && (
        <details className="pp-card pp-more">
          <summary><h3>ตัวนับทั้งระบบ</h3></summary>
          <div className="pp-kpis">
            <div className="pp-kpi"><b>{s.users}</b><span>ผู้ใช้ทั้งหมด</span></div>
            <div className="pp-kpi"><b>{s.paid}</b><span>สมาชิกเสียเงิน</span></div>
            <div className="pp-kpi"><b>{s.free_members ?? 0}</b><span>สมาชิกที่ได้ฟรี</span></div>
            <div className="pp-kpi"><b>{s.active_today}</b><span>ใช้งานวันนี้</span></div>
            <div className="pp-kpi"><b>{s.answered_today}</b><span>ข้อที่ทำวันนี้</span></div>
            <div className="pp-kpi"><b>{(s.questions?.approved ?? 0).toLocaleString("th-TH")}</b><span>ข้อสอบเผยแพร่</span></div>
            <div className="pp-kpi"><b>{s.keys_unused}</b><span>คีย์ที่ยังไม่ใช้</span></div>
          </div>
        </details>
      )}
    </>
  );
}
