import { useCallback, useEffect, useState } from "react";
import { PACKAGE_LABEL, TERM_LABEL, fmtUntil, rpc, thaiError, type PackageKey } from "./api";
import { ColumnChart, CompareList } from "./ChartParts";
import { nf } from "./chartFormat";

type Hit = { id: string; email: string; created_at: string; packages: PackageKey[]; last_active: string | null; orders: number };
type Row = Hit & { major_name: string | null; src: string | null; answered: number; sets: number };
type ListPage = { total: number; items: Row[] };
const FILTERS: [string, string][] = [["all", "ทั้งหมด"], ["paid", "จ่ายแล้ว"], ["free", "ยังฟรี"], ["nomajor", "ยังไม่เลือกเอก"]];
const PAGE = 50;
type Detail = {
  user: { id: string; email: string; created_at: string; plan: string; major_name: string | null; free_sets_used: number; free_mock_used: boolean };
  entitlements: { id: number; package: PackageKey; starts_at: string; expires_at: string | null; revoked_at: string | null; source: string; active: boolean }[];
  orders: { id: number; package: PackageKey; term: "round" | "lifetime"; amount: number | null; credit: number; status: "pending" | "approved" | "rejected"; created_at: string; reviewed_at: string | null; admin_note: string | null }[];
  activity: { answered_total: number; last_active: string | null; sets: number; mock_done: number };
  actions: { action: string; detail: { package?: string; days?: number | null; note?: string | null }; created_at: string }[];
};
type UserStats = {
  days: { day: string; answered: number; correct: number }[];
  overall: { user_n: number; user_correct: number; all_n: number; all_correct: number };
  topics: { topic: string; n: number; pct: number; avg_pct: number | null }[];
  mock: { name: string; pct: number; avg_pct: number | null; at: string }[];
};
const pc = (a: number, b: number) => (b > 0 ? Math.round((100 * a) / b) : null);
const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "-");
const ORDER_STATUS = { pending: "รอตรวจ", approved: "อนุมัติ", rejected: "ไม่ผ่าน" } as const;

// Look a customer up by e-mail: what they own, what they paid, and support actions (give / take back a package).
export default function AdminUsers() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [d, setD] = useState<Detail | null>(null);
  const [st, setSt] = useState<UserStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pkg, setPkg] = useState<PackageKey>("ALL");
  const [term, setTerm] = useState<"days" | "lifetime">("days");
  const [days, setDays] = useState(90);
  const [note, setNote] = useState("");

  const [filter, setFilter] = useState("all");
  const [list, setList] = useState<ListPage | null>(null);
  const [listError, setListError] = useState("");
  const [more, setMore] = useState(false);
  const loadList = useCallback(() => rpc<ListPage>("prep_admin_list_users", { p_filter: filter, p_offset: 0, p_limit: PAGE }), [filter]);
  useEffect(() => {
    let alive = true;
    loadList().then(r => { if (alive) { setList(r); setListError(""); } }).catch(e => { if (alive) setListError(thaiError(e)); });
    return () => { alive = false; };
  }, [loadList]);
  const loadMore = async () => {
    if (!list || more) return;
    setMore(true);
    try {
      const r = await rpc<ListPage>("prep_admin_list_users", { p_filter: filter, p_offset: list.items.length, p_limit: PAGE });
      setList({ total: r.total, items: [...list.items, ...r.items] });
    } catch (e) { setListError(thaiError(e)); }
    setMore(false);
  };
  const pickFilter = (k: string) => { setFilter(k); setList(null); };

  const search = async () => {
    if (busy) return;
    setBusy(true); setMsg(null); setD(null);
    try { setHits(await rpc<Hit[]>("prep_admin_find_user", { p_query: q })); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error && e.message === "query_too_short" ? "พิมพ์อย่างน้อย 3 ตัวอักษรของอีเมล" : thaiError(e) }); }
    setBusy(false);
  };
  const open = async (id: string) => {
    setMsg(null);
    setSt(null);
    rpc<UserStats>("prep_admin_user_stats", { p_user: id }).then(setSt).catch(() => { /* stats are secondary */ });
    try { setD(await rpc<Detail>("prep_admin_user_detail", { p_user: id })); }
    catch (e) { setMsg({ ok: false, text: thaiError(e) }); }
  };
  const reload = () => d && open(d.user.id);

  const grant = async () => {
    if (!d || busy) return;
    const what = `${PACKAGE_LABEL[pkg]} · ${term === "lifetime" ? "ซื้อขาด" : `${days} วัน`}`;
    if (!confirm(`ให้สิทธิ์ ${what}\nแก่ ${d.user.email}?\n(บันทึกไว้ในประวัติของบัญชีนี้)`)) return;
    setBusy(true); setMsg(null);
    try {
      await rpc("prep_admin_grant", { p_user: d.user.id, p_package: pkg, p_duration_days: term === "days" ? days : null, p_note: note.trim() || null });
      setNote(""); setMsg({ ok: true, text: `ให้สิทธิ์ ${what} แล้ว` }); await reload();
    } catch (e) { setMsg({ ok: false, text: thaiError(e) }); }
    setBusy(false);
  };
  const revoke = async (id: number, label: string) => {
    if (!d || busy) return;
    if (!confirm(`ถอนสิทธิ์ ${label} ของ ${d.user.email}?\nลูกค้าจะเสียสิทธิ์ทันที (ชุดที่สร้างจากแพ็กนี้จะทำต่อไม่ได้)`)) return;
    setBusy(true); setMsg(null);
    try {
      await rpc("prep_admin_revoke_entitlement", { p_id: id, p_note: note.trim() || null });
      setNote(""); setMsg({ ok: true, text: `ถอนสิทธิ์ ${label} แล้ว` }); await reload();
    } catch (e) { setMsg({ ok: false, text: thaiError(e) }); }
    setBusy(false);
  };

  return (
    <>
      <div className="pp-card">
        <h3>ค้นหาผู้ใช้</h3>
        <div className="pp-row">
          <input className="pp-input" type="search" placeholder="พิมพ์ส่วนหนึ่งของอีเมล (อย่างน้อย 3 ตัว)" value={q}
            onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} />
          <button className="pp-btn pp-btn-primary" disabled={busy || q.trim().length < 3} onClick={search}>ค้นหา</button>
        </div>
        {msg && !d && <div className={msg.ok ? "pp-success" : "pp-error"}>{msg.text}</div>}
        {hits && hits.length === 0 && <p className="pp-muted">ไม่พบผู้ใช้ (ค้นเฉพาะคนที่เคยเข้าแอปซ้อมสอบ)</p>}
        {hits?.map(h => (
          <button key={h.id} className="pp-user-hit" onClick={() => open(h.id)}>
            <b>{h.email}</b>
            <span className="pp-muted small">
              {h.packages.length ? h.packages.map(p => PACKAGE_LABEL[p]).join(", ") : "ไม่มีแพ็ก"} · คำสั่งซื้อ {h.orders} · ใช้ล่าสุด {h.last_active ? new Date(h.last_active).toLocaleDateString("th-TH", { day: "numeric", month: "short" }) : "ยังไม่เคย"}
            </span>
          </button>
        ))}
      </div>

      {!d && (
        <div className="pp-card">
          <h3>ผู้ใช้ทั้งหมด{list ? ` (${nf(list.total)})` : ""}</h3>
          <p className="pp-muted small">เรียงตามคนที่ใช้งานล่าสุดก่อน แตะชื่อเพื่อดูรายละเอียดและให้/ถอนสิทธิ์</p>
          <div className="pp-seg" role="group" aria-label="กรอง">
            {FILTERS.map(([k, l]) => <button key={k} className={filter === k ? "on" : ""} onClick={() => pickFilter(k)}>{l}</button>)}
          </div>
          {listError && <div className="pp-error">{listError}</div>}
          {!list && !listError && <div className="pp-spinner" />}
          {list && list.items.length === 0 && <p className="pp-muted">ไม่มีผู้ใช้ในหมวดนี้</p>}
          {list?.items.map(h => (
            <button key={h.id} className="pp-user-hit" onClick={() => open(h.id)}>
              <b>{h.email}</b>
              <span className="pp-muted small">
                {h.major_name ?? "ยังไม่เลือกเอก"} · {h.packages.length ? h.packages.map(p => PACKAGE_LABEL[p]).join(", ") : "ไม่มีแพ็ก"} · ตอบ {nf(h.answered)} ข้อ · {h.sets} ชุด · ซื้อ {h.orders} ครั้ง
              </span>
              <span className="pp-muted small">
                สมัคร {new Date(h.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })} · ใช้ล่าสุด {h.last_active ? new Date(h.last_active).toLocaleDateString("th-TH", { day: "numeric", month: "short" }) : "ยังไม่เคย"}{h.src ? ` · มาจาก ${h.src}` : ""}
              </span>
            </button>
          ))}
          {list && list.items.length < list.total && <button className="pp-btn pp-btn-ghost" disabled={more} onClick={loadMore}>{more ? "กำลังโหลด…" : `โหลดเพิ่ม (เหลือ ${nf(list.total - list.items.length)})`}</button>}
        </div>
      )}

      {d && (
        <div className="pp-card">
          <button className="pp-link small" onClick={() => setD(null)}>← กลับไปรายชื่อ</button>
          <h3>{d.user.email}</h3>
          <p className="pp-muted small">
            สมัคร {fmt(d.user.created_at)} · วิชาเอก {d.user.major_name ?? "ยังไม่เลือก"} · ชุดฟรีใช้ไป {d.user.free_sets_used}/3 · ทดลองจำลองสอบฟรี {d.user.free_mock_used ? "ใช้แล้ว" : "ยังไม่ใช้"}
          </p>
          <p className="pp-muted small">ตอบแล้ว {Number(d.activity.answered_total).toLocaleString("th-TH")} ข้อ · {d.activity.sets} ชุด · จำลองสอบจบ {d.activity.mock_done} ครั้ง · ใช้ล่าสุด {d.activity.last_active ?? "ยังไม่เคย"}</p>
          {msg && <div className={msg.ok ? "pp-success" : "pp-error"}>{msg.text}</div>}

          {st && <UserStatsView st={st} />}

          <label className="small pp-muted">เหตุผล/หมายเหตุ (ใช้บันทึกในประวัติของการให้หรือถอนสิทธิ์ครั้งต่อไป)</label>
          <input className="pp-input" maxLength={200} placeholder="เช่น ชดเชยระบบล่ม / โอนทางแชต / คืนเงิน" value={note} onChange={e => setNote(e.target.value)} />
          <h4>สิทธิ์</h4>
          {d.entitlements.length === 0 && <p className="pp-muted small">ไม่เคยมีแพ็ก</p>}
          {d.entitlements.map(e => (
            <div key={e.id} className="pp-keyrow">
              <div>
                <span className={`pp-chip ${e.active ? "ok" : ""}`}>{e.active ? "ใช้อยู่" : e.revoked_at ? "ถอนแล้ว" : "หมดอายุ"}</span> {PACKAGE_LABEL[e.package]}
                <div className="pp-muted small">{e.source} · เริ่ม {fmt(e.starts_at)} · {fmtUntil(e.expires_at)}</div>
              </div>
              {e.active && <button className="pp-link small" disabled={busy} onClick={() => revoke(e.id, PACKAGE_LABEL[e.package])}>ถอนสิทธิ์</button>}
            </div>
          ))}

          <h4>คำสั่งซื้อ</h4>
          {d.orders.length === 0 && <p className="pp-muted small">ไม่มีคำสั่งซื้อ</p>}
          {d.orders.map(o => (
            <div key={o.id} className="pp-keyrow"><div>#{o.id} {PACKAGE_LABEL[o.package]} · {TERM_LABEL[o.term]} · {o.amount ?? "-"} บาท{o.credit ? ` (หัก ${o.credit})` : ""}
              <div className="pp-muted small">{ORDER_STATUS[o.status]} · ส่ง {fmt(o.created_at)}{o.admin_note ? ` · ${o.admin_note}` : ""}</div></div></div>
          ))}

          <h4>ให้สิทธิ์ด้วยมือ</h4>
          <p className="pp-muted small">ใช้เมื่อชดเชยหรือรับเงินนอกแอป ตรวจเงินเข้าก่อนทุกครั้ง การให้สิทธิ์และถอนสิทธิ์ถูกบันทึกไว้ด้านล่าง</p>
          <div className="pp-seg">{(["A", "B", "ALL"] as const).map(k => <button key={k} className={pkg === k ? "on" : ""} onClick={() => setPkg(k)}>{PACKAGE_LABEL[k]}</button>)}</div>
          <div className="pp-seg">
            <button className={term === "days" ? "on" : ""} onClick={() => setTerm("days")}>จำนวนวัน</button>
            <button className={term === "lifetime" ? "on" : ""} onClick={() => setTerm("lifetime")}>ซื้อขาด</button>
          </div>
          {term === "days" && <input className="pp-input" type="number" min={1} max={3650} value={days} onChange={e => setDays(Number(e.target.value) || 1)} aria-label="จำนวนวัน" />}
          <button className="pp-btn pp-btn-primary" disabled={busy} onClick={grant}>ให้สิทธิ์</button>

          {d.actions.length > 0 && (
            <>
              <h4>ประวัติการให้/ถอนสิทธิ์</h4>
              {d.actions.map((a, i) => (
                <div key={i} className="pp-muted small">{fmt(a.created_at)} · {a.action === "grant" ? "ให้" : "ถอน"} {a.detail.package ? PACKAGE_LABEL[a.detail.package as PackageKey] : ""}{a.detail.note ? ` · ${a.detail.note}` : ""}</div>
              ))}
            </>
          )}
        </div>
      )}
    </>
  );
}

// How this person practises, next to everyone's average: last 30 days, accuracy by topic, mock exams.
function UserStatsView({ st }: { st: UserStats }) {
  const me = pc(st.overall.user_correct, st.overall.user_n);
  const all = pc(st.overall.all_correct, st.overall.all_n);
  const active = st.days.filter(x => x.answered > 0).length;
  const total = st.days.reduce((a, x) => a + x.answered, 0);
  return (
    <>
      <h4>การทำข้อสอบ</h4>
      {st.overall.user_n === 0 ? <p className="pp-muted small">ยังไม่เคยตอบข้อสอบ</p> : (
        <>
          <CompareList avgLabel="ค่าเฉลี่ยของทุกคน" rows={[{ label: `ตอบถูกรวม (${nf(st.overall.user_n)} ข้อ)`, value: me ?? 0, avg: all, note: `${me}%${all != null ? ` · เฉลี่ย ${all}%` : ""}` }]} />
          <ColumnChart title="ข้อที่ทำต่อวัน (30 วัน)" unit="ข้อ" days={st.days.map(x => x.day)} values={st.days.map(x => x.answered)} />
          <p className="pp-muted small">เข้ามาทำ {active} จาก 30 วัน · รวม {nf(total)} ข้อ</p>
          {st.topics.length > 0 && (
            <>
              <h4>ถูกกี่เปอร์เซ็นต์ แยกตามหมวด</h4>
              <CompareList avgLabel="ค่าเฉลี่ยของทุกคนในหมวดนั้น" rows={st.topics.map(t => ({ label: t.topic, value: t.pct, avg: t.avg_pct, note: `${t.pct}% · ${nf(t.n)} ข้อ${t.avg_pct != null ? ` · เฉลี่ย ${t.avg_pct}%` : ""}` }))} />
            </>
          )}
        </>
      )}
      {st.mock.length > 0 && (
        <>
          <h4>จำลองสอบล่าสุด</h4>
          <CompareList avgLabel="ค่าเฉลี่ยของทุกคนในวิชานั้น" rows={st.mock.map(m => ({
            label: `${m.name} · ${new Date(m.at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}`, value: m.pct, avg: m.avg_pct,
            note: `${m.pct}%${m.avg_pct != null ? ` · เฉลี่ย ${m.avg_pct}%` : ""}` }))} />
        </>
      )}
    </>
  );
}
