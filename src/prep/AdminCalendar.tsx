import { useCallback, useEffect, useState } from "react";
import { rpc, thaiError } from "./api";
import { KIND_LABEL, bkkToday, when, type CalKind } from "./calendarUtil";
import "./calendar.css";

type Row = { id: number; title: string; kind: CalKind; starts_on: string; ends_on: string | null; note: string | null; link: string | null; published: boolean };
type Form = { id: number | null; title: string; kind: CalKind; starts_on: string; ends_on: string; note: string; link: string; published: boolean };
const blank = (): Form => ({ id: null, title: "", kind: "exam", starts_on: bkkToday(), ends_on: "", note: "", link: "", published: true });
const ERR: Record<string, string> = {
  invalid_title: "ใส่ชื่อกำหนดการ (ไม่เกิน 120 ตัวอักษร)", invalid_date: "วันที่ไม่ถูกต้อง (วันสิ้นสุดต้องไม่ก่อนวันเริ่ม)",
  invalid_link: "ลิงก์ต้องขึ้นต้นด้วย https://", invalid_kind: "ประเภทไม่ถูกต้อง",
};

// Admin editor for the calendar students see: application window, exam day, results, notices.
export default function AdminCalendar() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [f, setF] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => { rpc<Row[]>("prep_admin_events").then(setRows).catch(e => setMsg({ ok: false, text: thaiError(e) })); }, []);
  useEffect(load, [load]);

  const edit = (r: Row) => { setMsg(null); setF({ id: r.id, title: r.title, kind: r.kind, starts_on: r.starts_on, ends_on: r.ends_on ?? "", note: r.note ?? "", link: r.link ?? "", published: r.published }); };
  const save = async () => {
    if (!f || busy) return;
    setBusy(true); setMsg(null);
    try {
      await rpc("prep_admin_event_save", { p_id: f.id, p_title: f.title, p_kind: f.kind, p_starts: f.starts_on, p_ends: f.ends_on || null, p_note: f.note || null, p_link: f.link || null, p_published: f.published });
      setMsg({ ok: true, text: f.id ? "บันทึกแล้ว" : "เพิ่มแล้ว" }); setF(null); load();
    } catch (e) { const m = e instanceof Error ? e.message : ""; setMsg({ ok: false, text: ERR[m] ?? thaiError(e) }); }
    setBusy(false);
  };
  const del = async (r: Row) => {
    if (!confirm(`ลบ “${r.title}” ออกจากปฏิทิน?\nผู้ใช้จะไม่เห็นรายการนี้อีก (ถ้าแค่ยังไม่พร้อมประกาศ ใช้ “ซ่อนจากผู้ใช้” แทนการลบ)`)) return;
    try { await rpc("prep_admin_event_delete", { p_id: r.id }); load(); } catch (e) { setMsg({ ok: false, text: thaiError(e) }); }
  };
  const set = (p: Partial<Form>) => setF(prev => (prev ? { ...prev, ...p } : prev));

  return (
    <>
      <div className="pp-card">
        <h3>ปฏิทินสอบ</h3>
        <p className="pp-muted small">ผู้ใช้เห็นรายการที่เผยแพร่ในหน้าแรกและหน้า “ปฏิทิน” · ตัวนับถอยหลังบนหน้าแรกใช้ “วันสอบ” ที่ใกล้ที่สุดที่ยังไม่ผ่าน ใส่เฉพาะวันที่ประกาศแล้ว และแนบลิงก์ประกาศทางการเสมอ</p>
        {msg && <div className={msg.ok ? "pp-success" : "pp-error"}>{msg.text}</div>}
        {!f && <button className="pp-btn pp-btn-primary" onClick={() => { setMsg(null); setF(blank()); }}>+ เพิ่มกำหนดการ</button>}
      </div>

      {f && (
        <div className="pp-card">
          <h3>{f.id ? "แก้ไขกำหนดการ" : "เพิ่มกำหนดการ"}</h3>
          <label className="small pp-muted">ชื่อ (เช่น เปิดรับสมัครสอบครูผู้ช่วย สพฐ. ปี 2569)</label>
          <input className="pp-input" maxLength={120} value={f.title} onChange={e => set({ title: e.target.value })} />
          <label className="small pp-muted">ประเภท</label>
          <div className="pp-seg">{(Object.keys(KIND_LABEL) as CalKind[]).map(k => <button key={k} className={f.kind === k ? "on" : ""} onClick={() => set({ kind: k })}>{KIND_LABEL[k]}</button>)}</div>
          <label className="small pp-muted" htmlFor="ev-start">วันที่เริ่ม</label>
          <input id="ev-start" className="pp-input" type="date" value={f.starts_on} onChange={e => set({ starts_on: e.target.value })} />
          <label className="small pp-muted" htmlFor="ev-end">ถึงวันที่ (เว้นว่างถ้าวันเดียว เช่น วันสอบ)</label>
          <input id="ev-end" className="pp-input" type="date" min={f.starts_on} value={f.ends_on} onChange={e => set({ ends_on: e.target.value })} />
          <label className="small pp-muted">หมายเหตุ (ไม่บังคับ เช่น สมัครทางเว็บไซต์ …)</label>
          <textarea className="pp-input" rows={2} maxLength={500} value={f.note} onChange={e => set({ note: e.target.value })} />
          <label className="small pp-muted">ลิงก์ประกาศ (https://…)</label>
          <input className="pp-input" inputMode="url" maxLength={300} value={f.link} onChange={e => set({ link: e.target.value })} />
          <label className="pp-group-head"><input type="checkbox" checked={!f.published} onChange={e => set({ published: !e.target.checked })} /><span>ซ่อนจากผู้ใช้ (ฉบับร่าง)</span></label>
          <div className="pp-row">
            <button className="pp-btn pp-btn-ghost" disabled={busy} onClick={() => setF(null)}>ยกเลิก</button>
            <button className="pp-btn pp-btn-primary" disabled={busy || !f.title.trim() || !f.starts_on} onClick={save}>{busy ? "กำลังบันทึก..." : "บันทึก"}</button>
          </div>
        </div>
      )}

      <div className="pp-card">
        <h3>ทั้งหมด</h3>
        {!rows && <div className="pp-spinner" />}
        {rows?.length === 0 && <p className="pp-muted small">ยังไม่มีรายการ</p>}
        {rows?.map(r => (
          <div key={r.id} className="pp-event">
            <div className="pp-event-top"><span className={`pp-kind ${r.kind}`}>{KIND_LABEL[r.kind]}</span><b>{r.title}</b>{!r.published && <span className="pp-chip">ซ่อนอยู่</span>}</div>
            <div className="pp-event-when">{when(r)}</div>
            {r.note && <div className="small">{r.note}</div>}
            <div className="pp-row"><button className="pp-link small" onClick={() => edit(r)}>แก้ไข</button><button className="pp-link small" onClick={() => del(r)}>ลบ</button></div>
          </div>
        ))}
      </div>
    </>
  );
}
