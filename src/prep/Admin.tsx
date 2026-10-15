import { useCallback, useEffect, useState } from "react";
import { rpc, thaiError } from "./api";
import ImportAI from "./ImportAI";
import AdminBank from "./AdminBank";

type Stats = { users: number; paid: number; answered_today: number; active_today: number;
  questions: Record<string, number> | null; open_reports: number; keys_unused: number };
type KeyRow = { id: number; note: string | null; created_at: string; redeemed_at: string | null; redeemed_email: string | null; revoked_at: string | null };
type QItem = { id: number; topic: string; stem: string; choices: string[]; answer: number; explanation: string;
  law_ref: string | null; status: string; source: string | null; reports: string[] };

const LABELS = ["ก", "ข", "ค", "ง"];
const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "");

export default function Admin() {
  const [tab, setTab] = useState<"stats" | "bank" | "reports" | "review" | "ai" | "keys" | "import">("stats");
  const [open, setOpen] = useState<number | null>(null);
  const loadCount = useCallback(() => { rpc<Stats>("prep_admin_stats").then(s => setOpen(s.open_reports)).catch(() => { /* badge only */ }); }, []);
  useEffect(loadCount, [loadCount]);
  return (
    <>
      <div className="pp-seg">
        {([["stats", "ภาพรวม"], ["bank", "คลังข้อสอบ"], ["reports", open ? `รายงาน (${open})` : "รายงาน"], ["review", "ตรวจข้อสอบ"], ["ai", "นำเข้า AI"], ["keys", "คีย์"], ["import", "นำเข้า JSON"]] as const).map(([k, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === "stats" && <StatsTab />}
      {tab === "bank" && <AdminBank onChanged={loadCount} />}
      {tab === "reports" && <AdminBank reportsOnly onChanged={loadCount} />}
      {tab === "review" && <ReviewTab />}
      {tab === "ai" && <ImportAI />}
      {tab === "keys" && <KeysTab />}
      {tab === "import" && <ImportTab />}
    </>
  );
}

function StatsTab() {
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { rpc<Stats>("prep_admin_stats").then(setS).catch(e => setError(thaiError(e))); }, []);
  if (error) return <div className="pp-error">{error}</div>;
  if (!s) return <div className="pp-spinner" />;
  return (
    <div className="pp-kpis">
      <div className="pp-kpi"><b>{s.users}</b><span>ผู้ใช้ทั้งหมด</span></div>
      <div className="pp-kpi"><b>{s.paid}</b><span>สมาชิกเสียเงิน</span></div>
      <div className="pp-kpi"><b>{s.active_today}</b><span>ใช้งานวันนี้</span></div>
      <div className="pp-kpi"><b>{s.answered_today}</b><span>ข้อที่ทำวันนี้</span></div>
      <div className="pp-kpi"><b>{s.questions?.approved ?? 0}</b><span>ข้อสอบเผยแพร่</span></div>
      <div className="pp-kpi"><b>{s.questions?.review ?? 0}</b><span>รอตรวจ</span></div>
      <div className="pp-kpi"><b>{s.open_reports}</b><span>รายงานปัญหา</span></div>
      <div className="pp-kpi"><b>{s.keys_unused}</b><span>คีย์ที่ยังไม่ใช้</span></div>
    </div>
  );
}

function ReviewTab() {
  const [items, setItems] = useState<QItem[] | null>(null);
  const [error, setError] = useState("");
  const [size, setSize] = useState(30);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const [msg, setMsg] = useState("");
  const load = useCallback(() => {
    rpc<QItem[]>("prep_admin_review_queue", { p_limit: size })
      .then(r => { setItems(r); setPicked(new Set()); })
      .catch(e => setError(thaiError(e)));
  }, [size]);
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
  const [fresh, setFresh] = useState<string[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(() => { rpc<KeyRow[]>("prep_admin_list_keys").then(setRows).catch(e => setError(thaiError(e))); }, []);
  useEffect(load, [load]);

  const create = async () => {
    if (!note.trim() && !confirm("ไม่ได้ใส่หมายเหตุ (ชื่อผู้ซื้อ/ยอดโอน) สร้างต่อไหม?")) return;
    try {
      setFresh(await rpc<string[]>("prep_admin_create_keys", { p_count: count, p_note: note.trim() || null }));
      setNote(""); load();
    } catch (e) { alert(thaiError(e)); }
  };
  const revoke = async (id: number) => {
    if (!confirm("ยกเลิกคีย์นี้? ถ้าถูกใช้แล้ว บัญชีนั้นจะกลับเป็นฟรี")) return;
    try { await rpc("prep_admin_revoke_key", { p_id: id }); load(); } catch (e) { alert(thaiError(e)); }
  };

  return (
    <>
      <div className="pp-card">
        <h3>สร้างคีย์</h3>
        <p className="pp-note">เช็กยอดเงินเข้าในแอปธนาคารก่อนทุกครั้ง (สลิปปลอมมีเยอะ)</p>
        <input className="pp-input" placeholder="หมายเหตุ: ชื่อผู้ซื้อ / อีเมล / ยอด / เวลาโอน" value={note} onChange={e => setNote(e.target.value)} />
        <div className="pp-row">
          <input className="pp-input" type="number" min={1} max={50} value={count} onChange={e => setCount(Number(e.target.value) || 1)} style={{ width: 90 }} />
          <button className="pp-btn pp-btn-primary" onClick={create}>สร้าง {count} คีย์</button>
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
              <div>{r.note || <span className="pp-muted">ไม่มีหมายเหตุ</span>}</div>
              <div className="pp-muted small">
                สร้าง {fmt(r.created_at)}
                {r.redeemed_at ? ` · ใช้โดย ${r.redeemed_email ?? "?"} ${fmt(r.redeemed_at)}` : " · ยังไม่ใช้"}
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
