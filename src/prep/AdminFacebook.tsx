import { useCallback, useEffect, useState } from "react";
import { rpc, supabase, thaiError } from "./api";

type Status = "draft" | "scheduled" | "posting" | "posted" | "failed" | "cancelled";
type CStatus = "none" | "pending" | "commenting" | "done" | "failed";
type Post = {
  id: number; title: string; caption: string; image_path: string | null; comment_text: string | null; comment_image_path: string | null;
  comment_delay_min: number; scheduled_at: string | null; status: Status; fb_post_id: string | null; posted_at: string | null;
  comment_status: CStatus; commented_at: string | null; error: string | null;
};
type Data = { settings: { enabled: boolean; daily_limit: number }; posted_24h: number; posts: Post[] };

const STATUS: Record<Status, { label: string; cls: string }> = {
  draft: { label: "ร่าง รออนุมัติ", cls: "" }, scheduled: { label: "อนุมัติแล้ว รอเวลา", cls: "warn" }, posting: { label: "กำลังโพสต์", cls: "warn" },
  posted: { label: "โพสต์แล้ว", cls: "ok" }, failed: { label: "ผิดพลาด", cls: "bad" }, cancelled: { label: "ยกเลิก", cls: "" },
};
const CSTATUS: Record<CStatus, string> = { none: "", pending: "รอคอมเมนต์เฉลย", commenting: "กำลังคอมเมนต์", done: "คอมเมนต์เฉลยแล้ว", failed: "คอมเมนต์ไม่สำเร็จ" };
const FILTERS: [string, string, (p: Post) => boolean][] = [
  ["all", "ทั้งหมด", () => true], ["draft", "ร่าง", p => p.status === "draft"], ["scheduled", "รอโพสต์", p => p.status === "scheduled" || p.status === "posting"],
  ["posted", "โพสต์แล้ว", p => p.status === "posted"], ["bad", "ผิดพลาด", p => p.status === "failed" || p.comment_status === "failed"],
];
const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "ยังไม่ได้ตั้งเวลา");
const toLocalInput = (s: string | null) => {
  if (!s) return "";
  const d = new Date(s);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

async function callAgent(action: "test" | "tick"): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke("prep-fb-agent", { body: { action } });
  if (error) {
    let msg = error.message;
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error; } catch { /* keep generic */ }
    throw new Error(msg);
  }
  return data as Record<string, unknown>;
}

function Thumb({ path }: { path: string | null }) {
  const [url, setUrl] = useState<{ path: string; url: string } | null>(null);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    supabase.storage.from("fb-media").createSignedUrl(path, 3600).then(({ data }) => { if (alive && data) setUrl({ path, url: data.signedUrl }); });
    return () => { alive = false; };
  }, [path]);
  if (!path) return null;
  return url?.path === path ? <img src={url.url} alt="" className="pp-fb-thumb" /> : <div className="pp-fb-thumb" />;
}

async function upload(file: File): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "png";
  const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("fb-media").upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error("อัปโหลดรูปไม่สำเร็จ: " + error.message);
  return path;
}

type Draft = { id?: number; title: string; caption: string; image_path: string | null; comment_text: string; comment_image_path: string | null; comment_delay_min: number; scheduled_at: string };
const blank: Draft = { title: "", caption: "", image_path: null, comment_text: "", comment_image_path: null, comment_delay_min: 150, scheduled_at: "" };

function Editor({ init, onSaved, onCancel }: { init: Draft; onSaved: () => void; onCancel: () => void }) {
  const [d, setD] = useState(init);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pick = async (key: "image_path" | "comment_image_path", f: File | undefined) => {
    if (!f) return;
    setBusy(true); setError("");
    try { const path = await upload(f); setD(x => ({ ...x, [key]: path })); } catch (e) { setError(thaiError(e)); }
    setBusy(false);
  };
  const save = async () => {
    setBusy(true); setError("");
    try {
      await rpc("prep_admin_fb_save", { p_post: { ...d, scheduled_at: d.scheduled_at ? new Date(d.scheduled_at).toISOString() : null } });
      onSaved();
    } catch (e) { setError(thaiError(e)); setBusy(false); }
  };
  return (
    <div className="pp-ai-edit pp-fb-edit">
      <label><span className="pp-muted small">ชื่อโพสต์ (เห็นเฉพาะแอดมิน)</span>
        <input className="pp-input" value={d.title} maxLength={120} onChange={e => setD({ ...d, title: e.target.value })} /></label>
      <label><span className="pp-muted small">เวลาโพสต์</span>
        <input className="pp-input" type="datetime-local" value={d.scheduled_at} onChange={e => setD({ ...d, scheduled_at: e.target.value })} /></label>
      <label><span className="pp-muted small">แคปชั่น</span>
        <textarea className="pp-input" rows={6} value={d.caption} onChange={e => setD({ ...d, caption: e.target.value })} /></label>
      <div><span className="pp-muted small">รูปโพสต์</span><br />
        <Thumb path={d.image_path} />
        <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => pick("image_path", e.target.files?.[0])} />
        {d.image_path && <button type="button" className="pp-chipbtn" onClick={() => setD({ ...d, image_path: null })}>เอารูปออก</button>}
      </div>
      <label><span className="pp-muted small">คอมเมนต์เฉลย (เว้นว่างถ้าไม่ต้องการ)</span>
        <textarea className="pp-input" rows={5} value={d.comment_text} onChange={e => setD({ ...d, comment_text: e.target.value })} /></label>
      <div><span className="pp-muted small">รูปในคอมเมนต์ (ไม่บังคับ)</span><br />
        <Thumb path={d.comment_image_path} />
        <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => pick("comment_image_path", e.target.files?.[0])} />
        {d.comment_image_path && <button type="button" className="pp-chipbtn" onClick={() => setD({ ...d, comment_image_path: null })}>เอารูปออก</button>}
      </div>
      <label><span className="pp-muted small">คอมเมนต์หลังโพสต์กี่นาที</span>
        <input className="pp-input" type="number" min={0} max={1440} value={d.comment_delay_min} onChange={e => setD({ ...d, comment_delay_min: Number(e.target.value) })} /></label>
      {error && <div className="pp-error">{error}</div>}
      <div className="pp-ai-act">
        <button className="pp-btn pp-btn-primary" disabled={busy} onClick={save}>บันทึก</button>
        <button className="pp-btn pp-btn-ghost" disabled={busy} onClick={onCancel}>ยกเลิก</button>
      </div>
    </div>
  );
}

function Row({ p, onChanged, setError }: { p: Post; onChanged: () => void; setError: (s: string) => void }) {
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (fn: string, args: Record<string, unknown>, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true); setError("");
    try { await rpc(fn, args); onChanged(); } catch (e) { setError(thaiError(e)); }
    setBusy(false);
  };
  const st = STATUS[p.status];
  const editable = p.status !== "posting" && p.status !== "posted";
  return (
    <div className="pp-ai-card">
      <div className="pp-ai-h">
        <span className={`pp-badge ${st.cls}`}>{st.label}</span>
        {p.comment_status !== "none" && <span className={`pp-badge ${p.comment_status === "failed" ? "bad" : p.comment_status === "done" ? "ok" : ""}`}>{CSTATUS[p.comment_status]}</span>}
        <b>{p.title}</b>
        <span className="pp-muted small">{p.status === "posted" ? `โพสต์ ${fmt(p.posted_at)}` : fmt(p.scheduled_at)}</span>
      </div>
      {edit ? (
        <Editor
          init={{ id: p.id, title: p.title, caption: p.caption, image_path: p.image_path, comment_text: p.comment_text ?? "", comment_image_path: p.comment_image_path, comment_delay_min: p.comment_delay_min, scheduled_at: toLocalInput(p.scheduled_at) }}
          onSaved={() => { setEdit(false); onChanged(); }} onCancel={() => setEdit(false)} />
      ) : (
        <div className="pp-fb-body">
          <Thumb path={p.image_path} />
          <div>
            <div className="pp-ai-q">{p.caption || <span className="pp-muted">(ไม่มีแคปชั่น)</span>}</div>
            {p.comment_text && <div className="pp-ai-an"><b>คอมเมนต์ (หลัง {p.comment_delay_min} นาที):</b><br />{p.comment_text}</div>}
          </div>
        </div>
      )}
      {p.error && <div className="pp-error">{p.error}</div>}
      {!edit && (
        <div className="pp-ai-act">
          {(p.status === "draft" || p.status === "failed" || p.status === "cancelled") && (
            <button className="pp-btn pp-btn-primary" disabled={busy}
              onClick={() => run("prep_admin_fb_set_status", { p_ids: [p.id], p_status: "scheduled" },
                p.status === "failed" ? "ตรวจที่เพจแล้วหรือยังว่าโพสต์นี้ยังไม่ขึ้น? ถ้าขึ้นแล้ว การอนุมัติซ้ำจะโพสต์ซ้ำ" : undefined)}>
              {p.status === "draft" ? "อนุมัติ" : "อนุมัติอีกครั้ง"}
            </button>
          )}
          {p.status === "scheduled" && <button className="pp-btn pp-btn-ghost" disabled={busy} onClick={() => run("prep_admin_fb_set_status", { p_ids: [p.id], p_status: "draft" })}>ดึงกลับเป็นร่าง</button>}
          {p.status === "posted" && p.comment_status === "failed" && <button className="pp-btn pp-btn-ghost" disabled={busy} onClick={() => run("prep_admin_fb_retry_comment", { p_id: p.id })}>ลองคอมเมนต์ใหม่</button>}
          {editable && <button className="pp-btn pp-btn-ghost" disabled={busy} onClick={() => setEdit(true)}>แก้ไข</button>}
          {(p.status === "draft" || p.status === "scheduled") && <button className="pp-btn pp-btn-ghost" disabled={busy} onClick={() => run("prep_admin_fb_set_status", { p_ids: [p.id], p_status: "cancelled" })}>ยกเลิก</button>}
          {editable && !p.fb_post_id && p.status !== "scheduled" && <button className="pp-btn pp-btn-ghost" disabled={busy} onClick={() => run("prep_admin_fb_delete", { p_id: p.id }, `ลบ "${p.title}" ถาวร?`)}>ลบ</button>}
        </div>
      )}
    </div>
  );
}

export default function AdminFacebook() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { setData(await rpc<Data>("prep_admin_fb_list")); } catch (e) { setError(thaiError(e)); }
  }, []);
  useEffect(() => {
    let alive = true;
    rpc<Data>("prep_admin_fb_list").then(d => { if (alive) setData(d); }).catch(e => { if (alive) setError(thaiError(e)); });
    return () => { alive = false; };
  }, []);

  const guard = async (fn: () => Promise<void>) => { setBusy(true); setError(""); setNote(""); try { await fn(); } catch (e) { setError(thaiError(e)); } setBusy(false); };
  const toggle = () => guard(async () => {
    if (!data) return;
    const on = !data.settings.enabled;
    if (on && !window.confirm("เปิดระบบ? โพสต์ที่อนุมัติแล้วและถึงเวลาจะถูกโพสต์ลงเพจจริงโดยอัตโนมัติ")) return;
    await rpc("prep_admin_fb_settings", { p_enabled: on });
    await load();
  });
  const test = () => guard(async () => {
    const r = await callAgent("test");
    setNote(r.ok ? `เชื่อมต่อเพจสำเร็จ: ${String(r.page)}` : String(r.error));
  });
  const tick = () => guard(async () => {
    if (!window.confirm("รันตอนนี้เลย? ระบบจะโพสต์/คอมเมนต์ทุกอย่างที่ถึงเวลาและอนุมัติแล้ว")) return;
    const r = await callAgent("tick");
    setNote(r.ok === false ? String(r.error) : r.enabled === false ? "ระบบปิดอยู่ ไม่ได้โพสต์อะไร" : `โพสต์ ${r.posted} · คอมเมนต์ ${r.commented} · ผิดพลาด ${r.failed}`);
    await load();
  });
  const approveAll = () => guard(async () => {
    const ids = (data?.posts ?? []).filter(p => p.status === "draft").map(p => p.id);
    if (!ids.length || !window.confirm(`อนุมัติร่างทั้งหมด ${ids.length} โพสต์? ระบบจะโพสต์ตามเวลาที่ตั้งไว้ (ต้องเปิดระบบด้วย)`)) return;
    await rpc("prep_admin_fb_set_status", { p_ids: ids, p_status: "scheduled" });
    await load();
  });

  const posts = (data?.posts ?? []).filter((FILTERS.find(f => f[0] === filter) ?? FILTERS[0])[2]);
  const drafts = (data?.posts ?? []).filter(p => p.status === "draft").length;
  return (
    <div className="pp-card">
      <h3>โพสต์เพจ Facebook</h3>
      <p className="pp-muted small">ระบบจะโพสต์เฉพาะที่คุณกด "อนุมัติ" และเปิดสวิตช์ด้านล่างเท่านั้น คอมเมนต์เฉลยจะขึ้นตามเวลาที่ตั้งหลังโพสต์ ตรวจทุกอย่างทุก 10 นาที
        ถ้าโพสต์ไหนผิดพลาดจะไม่ลองใหม่เอง (กันโพสต์ซ้ำ) ต้องตรวจที่เพจแล้วกดอนุมัติอีกครั้ง</p>
      {data && (
        <div className="pp-ai-human">
          <p><b>สวิตช์หลัก: {data.settings.enabled ? "เปิดอยู่ 🟢" : "ปิดอยู่ ⚪ (ไม่โพสต์อะไร)"}</b>
            <span className="pp-muted small"> · โพสต์ใน 24 ชม. ล่าสุด {data.posted_24h}/{data.settings.daily_limit}</span></p>
          <div className="pp-ai-act">
            <button className={`pp-btn ${data.settings.enabled ? "pp-btn-ghost" : "pp-btn-primary"}`} disabled={busy} onClick={toggle}>{data.settings.enabled ? "ปิดระบบ" : "เปิดระบบ"}</button>
            <button className="pp-btn pp-btn-ghost" disabled={busy} onClick={test}>ทดสอบเชื่อมต่อเพจ</button>
            <button className="pp-btn pp-btn-ghost" disabled={busy || !data.settings.enabled} onClick={tick}>รันตอนนี้</button>
          </div>
        </div>
      )}
      {note && <div className="pp-ai-an">{note}</div>}
      {error && <div className="pp-error">{error}</div>}
      <div className="pp-seg" role="group" aria-label="กรอง">
        {FILTERS.map(([k, l]) => <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>)}
      </div>
      <div className="pp-ai-act">
        <button className="pp-btn pp-btn-primary" onClick={() => setAdding(true)} disabled={adding}>+ เพิ่มโพสต์</button>
        {drafts > 0 && <button className="pp-btn pp-btn-ghost" disabled={busy} onClick={approveAll}>อนุมัติร่างทั้งหมด ({drafts})</button>}
      </div>
      {adding && <div className="pp-ai-card"><Editor init={blank} onSaved={() => { setAdding(false); load(); }} onCancel={() => setAdding(false)} /></div>}
      {data && posts.length === 0 && <p className="pp-muted">ยังไม่มีโพสต์ในหมวดนี้</p>}
      {posts.map(p => <Row key={p.id} p={p} onChanged={load} setError={setError} />)}
    </div>
  );
}
