import { useCallback, useEffect, useState } from "react";
import { PACKAGE_LABEL, fmtUntil, rpc, thaiError, type PackageKey } from "./api";
import ImportAI from "./ImportAI";
import AdminBank from "./AdminBank";
import AdminReportAI from "./AdminReportAI";
import { AiBox } from "./AiReview";
import { AI_BATCH, fixPatch, loadVerdicts, reviewWithAi, type AiVerdict } from "./aiVerdicts";
import AdminOrders from "./AdminOrders";
import AdminGuide from "./AdminGuide";
import AdminDashboard from "./AdminDashboard";
import AdminUsers from "./AdminUsers";
import AdminHealth from "./AdminHealth";
import AdminCharts from "./AdminCharts";
import AdminLive from "./AdminLive";
import AdminCalendar from "./AdminCalendar";
import AdminFacebook from "./AdminFacebook";
import AdminMajors from "./AdminMajors";
import AdminDiscounts from "./AdminDiscounts";
import AdminSubtopics from "./AdminSubtopics";
import { AdminTrackContext, type AdminTrack } from "./adminTrack";
import AdminTimes from "./AdminTimes";
import { AdminSummaries } from "./Summary";
import { MAPS } from "./summaries";

type Stats = { users: number; paid: number; answered_today: number; active_today: number;
  questions: Record<string, number> | null; open_reports: number; keys_unused: number };
type KeyRow = { id: number; note: string | null; created_at: string; redeemed_at: string | null; redeemed_email: string | null; revoked_at: string | null;
  package?: PackageKey; free?: boolean; duration_days?: number | null; expires_on?: string | null; access_until?: string | null };
const keyTerm = (r: { duration_days?: number | null; expires_on?: string | null }) =>
  r.expires_on ? `ถึง ${new Date(r.expires_on + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}`
    : r.duration_days ? (r.duration_days === 90 ? "รายรอบ 3 เดือน" : `${r.duration_days} วัน`) : "ซื้อขาด";
type QItem = { id: number; topic: string; stem: string; choices: string[]; answer: number; explanation: string;
  law_ref: string | null; status: string; source: string | null; reports: string[] };

const LABELS = ["ก", "ข", "ค", "ง"];
const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "");

type Tab = "stats" | "live" | "charts" | "users" | "majors" | "times" | "orders" | "keys" | "discounts" | "bank" | "reports" | "review" | "health" | "subtopics" | "import" | "facebook" | "calendar" | "summaries";
// Screens in 5 groups: pick a group, then one of its few tabs.
const GROUPS: { id: string; icon: string; label: string; tabs: [Tab, string][] }[] = [
  { id: "overview", icon: "📊", label: "ภาพรวม", tabs: [["stats", "สรุปวันนี้"], ["live", "ตอนนี้"], ["charts", "เปรียบเทียบ"]] },
  { id: "people", icon: "👥", label: "ผู้ใช้", tabs: [["users", "รายชื่อ"], ["majors", "วิเคราะห์เอก"], ["times", "ช่วงเวลา"]] },
  { id: "sales", icon: "💰", label: "ขาย", tabs: [["orders", "คำสั่งซื้อ"], ["discounts", "ส่วนลด"], ["keys", "คีย์"]] },
  { id: "content", icon: "📚", label: "ข้อสอบ", tabs: [["bank", "คลังข้อสอบ"], ["reports", "รายงาน+AI"], ["review", "ข้อสอบรอตรวจ"], ["health", "คุณภาพคลัง"], ["subtopics", "หมวดย่อยเอก"], ["import", "นำเข้า"], ["summaries", "สรุปแผนผัง"]] },
  { id: "page", icon: "📣", label: "เพจ·ปฏิทิน", tabs: [["facebook", "Facebook"], ["calendar", "ปฏิทินสอบ"]] },
];
const groupOf = (t: Tab) => GROUPS.find(g => g.tabs.some(([k]) => k === t)) ?? GROUPS[0];

export default function Admin() {
  const [tab, setTab] = useState<Tab>("stats");
  const [last, setLast] = useState<Record<string, Tab>>({});
  const go = useCallback((t: Tab) => { setTab(t); setLast(l => ({ ...l, [groupOf(t).id]: t })); window.scrollTo(0, 0); }, []);
  const [pending, setPending] = useState<number | null>(null);
  const loadPending = useCallback(() => { rpc<unknown[]>("prep_admin_orders", { p_status: "pending", p_limit: 200 }).then(r => setPending(r.length)).catch(() => { /* badge only */ }); }, []);
  useEffect(loadPending, [loadPending]);
  const [open, setOpen] = useState<number | null>(null);
  const loadCount = useCallback(() => { rpc<Stats>("prep_admin_stats").then(s => setOpen(s.open_reports)).catch(() => { /* badge only */ }); }, []);
  useEffect(loadCount, [loadCount]);
  const [drafts, setDrafts] = useState(0);
  const loadDrafts = useCallback(() => { rpc<string[]>("prep_summary_approved").then(ids => setDrafts(MAPS.filter(m => !ids.includes(m.id)).length)).catch(() => { /* badge only */ }); }, []);
  useEffect(loadDrafts, [loadDrafts]);
  const badge: Partial<Record<Tab, number>> = { orders: pending ?? 0, reports: open ?? 0, summaries: drafts };
  const groupBadge = (id: string) => GROUPS.find(g => g.id === id)!.tabs.reduce((n, [k]) => n + (badge[k] ?? 0), 0);
  const g = groupOf(tab);
  const [track, setTrackState] = useState<AdminTrack>(() => {
    try { const v = localStorage.getItem("pp-admin-track"); return v === "obec" || v === "vec" ? v : null; } catch { return null; }
  });
  const setTrack = (t: AdminTrack) => {
    setTrackState(t);
    try { if (t) localStorage.setItem("pp-admin-track", t); else localStorage.removeItem("pp-admin-track"); } catch { /* per-device only */ }
  };
  const trackScoped = g.id === "overview" || g.id === "people";
  return (
    <AdminTrackContext.Provider value={trackScoped ? track : null}>
      <AdminGuide />
      <div className="pp-agroups" role="tablist" aria-label="หมวดของแอดมิน">
        {GROUPS.map(x => (
          <button key={x.id} role="tab" aria-selected={x.id === g.id} className={x.id === g.id ? "on" : ""} onClick={() => go(last[x.id] ?? x.tabs[0][0])}>
            <span className="pp-agroup-ic" aria-hidden="true">{x.icon}</span>
            <span>{x.label}</span>
            {groupBadge(x.id) > 0 && <i className="pp-agroup-badge">{groupBadge(x.id)}</i>}
          </button>
        ))}
      </div>
      <div className="pp-seg pp-seg-sub">
        {g.tabs.map(([k, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => go(k)}>{badge[k] ? `${l} (${badge[k]})` : l}</button>
        ))}
      </div>
      {trackScoped && (
        <div className="pp-seg pp-seg-sub pp-track-filter" role="radiogroup" aria-label="แสดงข้อมูลของผู้สอบสายใด">
          {([[null, "ทุกสาย"], ["obec", "สพฐ."], ["vec", "สอศ. (อาชีวะ)"]] as [AdminTrack, string][]).map(([k, l]) => (
            <button key={l} role="radio" aria-checked={track === k} className={track === k ? "on" : ""} onClick={() => setTrack(k)}>{l}</button>
          ))}
        </div>
      )}
      {tab === "stats" && <AdminDashboard onGo={go} />}
      {tab === "live" && <AdminLive />}
      {tab === "charts" && <AdminCharts />}
      {tab === "users" && <AdminUsers />}
      {tab === "majors" && <AdminMajors />}
      {tab === "times" && <AdminTimes />}
      {tab === "orders" && <AdminOrders onChanged={loadPending} />}
      {tab === "discounts" && <AdminDiscounts />}
      {tab === "subtopics" && <AdminSubtopics />}
      {tab === "keys" && <KeysTab />}
      {tab === "bank" && <AdminBank onChanged={loadCount} />}
      {tab === "reports" && <><AdminReportAI onChanged={loadCount} /><AdminBank reportsOnly onChanged={loadCount} /></>}
      {tab === "review" && <ReviewTab />}
      {tab === "health" && <AdminHealth />}
      {tab === "import" && <ImportHub />}
      {tab === "facebook" && <AdminFacebook />}
      {tab === "calendar" && <AdminCalendar />}
      {tab === "summaries" && <AdminSummaries onChanged={loadDrafts} />}
    </AdminTrackContext.Provider>
  );
}

// Two ways to bring questions in, one tab: let AI read an exam file, or paste ready-made JSON.
function ImportHub() {
  const [mode, setMode] = useState<"ai" | "json">("ai");
  return (
    <>
      <div className="pp-seg pp-seg-sub" role="group" aria-label="วิธีนำเข้า">
        <button className={mode === "ai" ? "on" : ""} onClick={() => setMode("ai")}>ให้ AI อ่านไฟล์ข้อสอบ</button>
        <button className={mode === "json" ? "on" : ""} onClick={() => setMode("json")}>วาง JSON</button>
      </div>
      {mode === "ai" ? <ImportAI /> : <ImportTab />}
    </>
  );
}

function ReviewTab() {
  const [items, setItems] = useState<QItem[] | null>(null);
  const [error, setError] = useState("");
  const [size, setSize] = useState(30);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const [msg, setMsg] = useState("");
  const [verdicts, setVerdicts] = useState<Record<string, AiVerdict>>({});
  const [ai, setAi] = useState<{ done: number; total: number; cost: number } | null>(null);
  const load = useCallback(() => {
    rpc<QItem[]>("prep_admin_review_queue", { p_limit: size })
      .then(r => { setItems(r); setPicked(new Set()); return loadVerdicts(r.map(q => q.id)); })
      .then(setVerdicts)
      .catch(e => setError(thaiError(e)));
  }, [size]);

  // DeepSeek reviews the questions on screen that have no verdict yet, AI_BATCH per call.
  const runAi = async () => {
    const todo = (items ?? []).filter(q => !verdicts[q.id]).map(q => q.id);
    if (!todo.length || ai || bulk) return;
    let cost = 0;
    setAi({ done: 0, total: todo.length, cost }); setMsg("");
    try {
      for (let i = 0; i < todo.length; i += AI_BATCH) {
        const got = await reviewWithAi(todo.slice(i, i + AI_BATCH));
        cost += got.cost;
        setVerdicts(prev => ({ ...prev, ...got.verdicts }));
        setAi({ done: Math.min(i + AI_BATCH, todo.length), total: todo.length, cost });
      }
      setMsg(`AI ตรวจเสร็จแล้ว · ค่าใช้จ่ายโดยประมาณ $${cost.toFixed(3)}`);
    } catch (e) { setMsg(`AI ตรวจไม่สำเร็จ: ${(e as Error).message}`); }
    setAi(null);
  };
  const aiOk = (items ?? []).filter(q => verdicts[q.id]?.verdict === "ok" && verdicts[q.id]?.confidence !== "low").map(q => q.id);
  const unreviewed = (items ?? []).filter(q => !verdicts[q.id]).length;
  useEffect(load, [load]);

  // Saves the (possibly edited) question with a new status.
  const update = (q: QItem, status: "approved" | "hidden") => rpc("prep_admin_update_question", {
    p_id: q.id, p_status: status, p_stem: q.stem, p_choices: q.choices, p_answer: q.answer, p_explanation: q.explanation,
  });

  const save = async (q: QItem, status: "approved" | "hidden") => {
    try {
      await update(q, status);
      setItems(prev => prev?.filter(x => x.id !== q.id) ?? null);
      setPicked(prev => { const n = new Set(prev); n.delete(q.id); return n; });
    } catch (e) { alert(thaiError(e)); }
  };
  const edit = (id: number, patch: Partial<QItem>) => setItems(prev => prev?.map(x => (x.id === id ? { ...x, ...patch } : x)) ?? null);

  const toggle = (id: number) => setPicked(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allPicked = !!items?.length && items.every(q => picked.has(q.id));

  const saveMany = async (status: "approved" | "hidden") => {
    const list = (items ?? []).filter(q => picked.has(q.id));
    if (!list.length || bulk) return;
    const verb = status === "approved" ? "เผยแพร่" : "ซ่อน";
    if (!confirm(`${verb} ${list.length} ข้อที่เลือก? (ข้อที่แก้ไขในช่องไว้จะถูกบันทึกด้วย)`)) return;
    setBulk({ done: 0, total: list.length }); setMsg("");
    const ok: number[] = [];
    let failed = 0;
    // Five at a time keeps it quick without flooding the database.
    for (let i = 0; i < list.length; i += 5) {
      const res = await Promise.allSettled(list.slice(i, i + 5).map(q => update(q, status).then(() => q.id)));
      res.forEach(r => (r.status === "fulfilled" ? ok.push(r.value) : failed++));
      setBulk({ done: Math.min(i + 5, list.length), total: list.length });
    }
    setBulk(null);
    setMsg(`${verb}แล้ว ${ok.length} ข้อ${failed ? ` · ไม่สำเร็จ ${failed} ข้อ (ยังอยู่ในรายการ)` : ""}`);
    const left = (items ?? []).filter(q => !ok.includes(q.id));
    setItems(left);
    setPicked(new Set());
    if (!left.length) load();
  };

  if (error) return <div className="pp-error">{error}</div>;
  if (!items) return <div className="pp-spinner" />;
  if (!items.length) return <div className="pp-card pp-empty"><p>ไม่มีข้อรอตรวจ 🎉</p>{msg && <p className="pp-muted">{msg}</p>}<button className="pp-btn pp-btn-ghost" onClick={load}>โหลดใหม่</button></div>;

  return (
    <>
      <p className="pp-muted">แก้ได้ในช่อง แล้วกด "อนุมัติ" (บันทึกและเผยแพร่) หรือ "ซ่อน" ทีละข้อ หรือติ๊กเลือกหลายข้อแล้วกดปุ่มด้านบน</p>
      <div className="pp-card pp-bulkbar">
        <label className="pp-group-head">
          <input type="checkbox" checked={allPicked} disabled={!!bulk}
            onChange={e => setPicked(e.target.checked ? new Set(items.map(q => q.id)) : new Set())} />
          <b>เลือกทั้งหมด ({items.length})</b>
          <span className="pp-muted small">· เลือกแล้ว {picked.size}</span>
        </label>
        <select className="pp-input" value={size} disabled={!!bulk} onChange={e => setSize(Number(e.target.value))} aria-label="แสดงทีละ">
          {[30, 50, 100, 200].map(n => <option key={n} value={n}>แสดงทีละ {n} ข้อ</option>)}
        </select>
        <div className="pp-row">
          <button className="pp-btn pp-btn-ghost" disabled={!picked.size || !!bulk} onClick={() => saveMany("hidden")}>ซ่อนที่เลือก</button>
          <button className="pp-btn pp-btn-gold" disabled={!picked.size || !!bulk} onClick={() => saveMany("approved")}>
            {bulk ? `กำลังบันทึก ${bulk.done}/${bulk.total}...` : `เผยแพร่ที่เลือก (${picked.size})`}
          </button>
        </div>
        <div className="pp-row">
          <button className="pp-btn pp-btn-outline" disabled={!unreviewed || !!ai || !!bulk} onClick={runAi}>
            {ai ? `AI กำลังตรวจ ${ai.done}/${ai.total}...` : `ตรวจด้วย AI (${unreviewed} ข้อที่ยังไม่ตรวจ)`}
          </button>
          <button className="pp-btn pp-btn-ghost" disabled={!aiOk.length || !!bulk} onClick={() => setPicked(new Set(aiOk))}>
            เลือกข้อที่ AI ว่าถูกต้อง ({aiOk.length})
          </button>
        </div>
        <p className="pp-muted small">ตรวจสองชั้น: DeepSeek Pro และ DeepSeek Flash ทำข้อสอบโดยไม่เห็นเฉลย แล้ว DeepSeek Pro ตรวจเทียบกับเฉลย · ผ่านเฉพาะข้อที่ทั้งสองตอบตรงเฉลยและไม่มีใครติง</p>
        {ai && <div className="pp-bar"><div style={{ width: `${(100 * ai.done) / ai.total}%` }} /></div>}
        {bulk && <div className="pp-bar"><div style={{ width: `${(100 * bulk.done) / bulk.total}%` }} /></div>}
        {msg && !bulk && <div className="pp-success">{msg}</div>}
      </div>
      {items.map(q => (
        <div key={q.id} className={`pp-card pp-review ${picked.has(q.id) ? "picked" : ""}`}>
          <label className="pp-group-head">
            <input type="checkbox" checked={picked.has(q.id)} disabled={!!bulk} onChange={() => toggle(q.id)} />
            <span className="pp-muted small">#{q.id} · {q.topic} · {q.status === "review" ? "รอตรวจ" : "มีรายงานปัญหา"}{q.source ? ` · ${q.source}` : ""}</span>
          </label>
          {q.reports.length > 0 && <div className="pp-error">รายงาน: {q.reports.join(" | ")}</div>}
          {verdicts[q.id] && <AiBox v={verdicts[q.id]} keyAnswer={q.answer} onApply={() => edit(q.id, fixPatch(verdicts[q.id]))} />}
          <textarea className="pp-input" rows={3} value={q.stem} onChange={e => edit(q.id, { stem: e.target.value })} />
          {q.choices.map((c, i) => (
            <label key={i} className={`pp-review-choice ${q.answer === i ? "right" : ""}`}>
              <input type="radio" name={`a${q.id}`} checked={q.answer === i} onChange={() => edit(q.id, { answer: i })} />
              <span>{LABELS[i]}</span>
              <input className="pp-input" value={c} onChange={e => edit(q.id, { choices: q.choices.map((x, k) => (k === i ? e.target.value : x)) })} />
            </label>
          ))}
          <textarea className="pp-input" rows={3} value={q.explanation} onChange={e => edit(q.id, { explanation: e.target.value })} />
          {q.law_ref && <div className="pp-muted small">อ้างอิง: {q.law_ref}</div>}
          <div className="pp-row">
            <button className="pp-btn pp-btn-ghost" disabled={!!bulk} onClick={() => save(q, "hidden")}>ซ่อน</button>
            <button className="pp-btn pp-btn-primary" disabled={!!bulk} onClick={() => save(q, "approved")}>อนุมัติ</button>
          </div>
        </div>
      ))}
      <button className="pp-btn pp-btn-ghost" disabled={!!bulk} onClick={load}>โหลดชุดถัดไป</button>
    </>
  );
}

function KeysTab() {
  const [rows, setRows] = useState<KeyRow[] | null>(null);
  const [count, setCount] = useState(1);
  const [note, setNote] = useState("");
  const [pkg, setPkg] = useState<PackageKey>("ALL");
  const [term, setTerm] = useState<"lifetime" | "days" | "until">("days");
  const [days, setDays] = useState(90);
  const [until, setUntil] = useState("");
  const [free, setFree] = useState(false);
  const [fresh, setFresh] = useState<string[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(() => { rpc<KeyRow[]>("prep_admin_list_keys").then(setRows).catch(e => setError(thaiError(e))); }, []);
  useEffect(load, [load]);

  const create = async () => {
    if (term === "until" && !until) { alert("เลือกวันที่หมดอายุ"); return; }
    if (!note.trim() && !confirm("ไม่ได้ใส่หมายเหตุ (ชื่อผู้ซื้อ/ยอดโอน) สร้างต่อไหม?")) return;
    try {
      setFresh(await rpc<string[]>("prep_admin_create_package_keys", {
        p_count: count, p_note: note.trim() || null, p_package: pkg,
        p_duration_days: term === "days" ? days : null, p_expires_on: term === "until" ? until : null, p_free: free,
      }));
      setNote(""); load();
    } catch (e) { alert(thaiError(e)); }
  };
  const revoke = async (id: number) => {
    if (!confirm("ยกเลิกคีย์นี้? ถ้าถูกใช้แล้ว บัญชีนั้นจะเสียสิทธิ์แพ็กที่ได้จากคีย์นี้")) return;
    try { await rpc("prep_admin_revoke_key", { p_id: id }); load(); } catch (e) { alert(thaiError(e)); }
  };

  return (
    <>
      <div className="pp-card">
        <h3>สร้างคีย์</h3>
        <p className="pp-note">เช็กยอดเงินเข้าในแอปธนาคารก่อนทุกครั้ง (สลิปปลอมมีเยอะ)</p>
        <label className="small pp-muted">แพ็ก</label>
        <div className="pp-seg">
          {(["A", "B", "ALL"] as const).map(k => <button key={k} className={pkg === k ? "on" : ""} onClick={() => setPkg(k)}>{PACKAGE_LABEL[k]}</button>)}
        </div>
        <label className="small pp-muted">ระยะเวลา</label>
        <div className="pp-seg">
          <button className={term === "days" && days === 90 ? "on" : ""} onClick={() => { setTerm("days"); setDays(90); }}>รายรอบ 3 เดือน</button>
          <button className={term === "lifetime" ? "on" : ""} onClick={() => setTerm("lifetime")}>ซื้อขาด</button>
          <button className={term === "days" && days !== 90 ? "on" : ""} onClick={() => { setTerm("days"); setDays(30); }}>จำนวนวันอื่น</button>
          <button className={term === "until" ? "on" : ""} onClick={() => setTerm("until")}>ถึงวันที่ (รอบสอบ)</button>
        </div>
        {term === "days" && days !== 90 && (
          <div className="pp-seg">
            {[7, 30, 180, 365].map(n => <button key={n} className={days === n ? "on" : ""} onClick={() => setDays(n)}>{n} วัน</button>)}
          </div>
        )}
        {term === "until" && <input className="pp-input" type="date" value={until} min={new Date().toISOString().slice(0, 10)} onChange={e => setUntil(e.target.value)} />}
        <p className="pp-muted small">ผู้ที่มีแพ็กเดิมแบบมีวันหมดอายุอยู่แล้ว คีย์ "ตามจำนวนวัน" จะต่อจากวันหมดอายุเดิม · คีย์ "ถึงวันที่" ใช้ได้ถึงสิ้นวันนั้น และกรอกไม่ได้หลังวันนั้น</p>
        <label className="pp-group-head">
          <input type="checkbox" checked={free} onChange={e => setFree(e.target.checked)} />
          <span>แจกฟรี (ไม่นับเป็นสมาชิกที่จ่ายเงินในตัวเลขภาพรวม)</span>
        </label>
        <input className="pp-input" placeholder={free ? "หมายเหตุ: แจกให้ใคร / เพราะอะไร" : "หมายเหตุ: ชื่อผู้ซื้อ / อีเมล / ยอด / เวลาโอน"} value={note} onChange={e => setNote(e.target.value)} />
        <div className="pp-row">
          <input className="pp-input" type="number" min={1} max={50} value={count} onChange={e => setCount(Number(e.target.value) || 1)} style={{ width: 90 }} />
          <button className="pp-btn pp-btn-primary" onClick={create}>สร้าง {count} คีย์{free ? "ฟรี" : ""} · {PACKAGE_LABEL[pkg]} · {term === "lifetime" ? "ซื้อขาด" : term === "days" ? (days === 90 ? "รายรอบ 3 เดือน" : `${days} วัน`) : until || "เลือกวันที่"}</button>
        </div>
        {fresh.length > 0 && (
          <div className="pp-success">
            <b>คัดลอกเก็บไว้เลย — ระบบจะไม่แสดงคีย์นี้อีก</b>
            {fresh.map(k => <div key={k} className="pp-keytext">{k}</div>)}
            <button className="pp-btn pp-btn-ghost" onClick={() => navigator.clipboard?.writeText(fresh.join("\n"))}>คัดลอกทั้งหมด</button>
          </div>
        )}
      </div>
      {error && <div className="pp-error">{error}</div>}
      <div className="pp-card">
        <h3>คีย์ทั้งหมด</h3>
        {rows?.map(r => (
          <div key={r.id} className="pp-keyrow">
            <div>
              <div><span className="pp-pkg-badge small">{PACKAGE_LABEL[r.package ?? "ALL"]} · {keyTerm(r)}{r.free ? " · ฟรี" : ""}</span> {r.note || <span className="pp-muted">ไม่มีหมายเหตุ</span>}</div>
              <div className="pp-muted small">
                สร้าง {fmt(r.created_at)}
                {r.redeemed_at ? ` · ใช้โดย ${r.redeemed_email ?? "?"} ${fmt(r.redeemed_at)} · สิทธิ์${fmtUntil(r.access_until ?? null)}` : " · ยังไม่ใช้"}
                {r.revoked_at ? ` · ยกเลิกแล้ว ${fmt(r.revoked_at)}` : ""}
              </div>
            </div>
            {!r.revoked_at && <button className="pp-link small" onClick={() => revoke(r.id)}>ยกเลิก</button>}
          </div>
        ))}
      </div>
    </>
  );
}

function ImportTab() {
  const [items, setItems] = useState<unknown[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [origin, setOrigin] = useState("sheet");
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!Array.isArray(data)) throw new Error("ไฟล์ต้องเป็น JSON array");
      setItems(data); setFileName(f.name.replace(/\.json$/i, "")); setLog([]);
    } catch (e) { alert("อ่านไฟล์ไม่ได้: " + thaiError(e)); }
  };

  const run = async () => {
    if (!items || busy) return;
    setBusy(true);
    const total = { inserted: 0, skipped: 0, invalid: 0 };
    for (let i = 0; i < items.length; i += 200) {
      try {
        const r = await rpc<typeof total>("prep_admin_import", { p_items: items.slice(i, i + 200), p_source: fileName, p_origin: origin });
        total.inserted += r.inserted; total.skipped += r.skipped; total.invalid += r.invalid;
        setLog(l => [...l, `ข้อ ${i + 1}–${Math.min(i + 200, items.length)}: เพิ่ม ${r.inserted} · ซ้ำ ${r.skipped} · ไม่ถูกรูปแบบ ${r.invalid}`]);
      } catch (e) {
        setLog(l => [...l, `ข้อ ${i + 1}: ผิดพลาด ${thaiError(e)}`]);
      }
    }
    setLog(l => [...l, `เสร็จ: เพิ่ม ${total.inserted} · ซ้ำ ${total.skipped} · ไม่ถูกรูปแบบ ${total.invalid}`]);
    setBusy(false);
  };

  return (
    <div className="pp-card">
      <h3>นำเข้าข้อสอบ (ไฟล์ JSON)</h3>
      <p className="pp-muted small">รูปแบบ: [{"{"}"topic","stem","choices":[4 ตัวเลือก],"answer":0-3,"explanation","law_ref","level","status":"approved|review"{"}"}] · ข้อซ้ำจะถูกข้าม</p>
      <input type="file" accept=".json,application/json" onChange={e => onFile(e.target.files?.[0])} />
      {items && <p>{fileName}: {items.length} ข้อ</p>}
      <div className="pp-row">
        <select className="pp-input" value={origin} onChange={e => setOrigin(e.target.value)} style={{ width: 160 }}>
          <option value="sheet">ข้อสอบเก่า / เอกสารสรุป</option>
          <option value="template">สร้างด้วยโค้ด</option>
          <option value="ai">AI สร้าง</option>
          <option value="manual">เขียนเอง</option>
        </select>
        <button className="pp-btn pp-btn-primary" disabled={!items || busy} onClick={run}>{busy ? "กำลังนำเข้า..." : "นำเข้า"}</button>
      </div>
      {log.map((l, i) => <div key={i} className="pp-muted small">{l}</div>)}
    </div>
  );
}
