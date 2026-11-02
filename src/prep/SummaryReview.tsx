import { useCallback, useEffect, useState } from "react";
import { rpc, thaiError } from "./api";
import { ask, notify } from "./dialog";
import { GROUPS, type MindMap } from "./summaries/types";

// Review of a mind-map summary by admins and reviewers (prep.reviewers, granted in แอดมิน → ข้อสอบ → สรุปแผนผัง).
// A comment belongs to the whole map or to one branch and may carry a verdict: ผ่าน / ต้องแก้. Publishing a map stays
// with the admin; the panel only collects what the reviewers found. Admins mark comments as fixed.
type Comment = { id: number; branch: string | null; body: string; verdict: "ok" | "fix" | null; at: string; by: string; admin: boolean; mine: boolean; resolved: boolean };
const fmt = (s: string) => new Date(s).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function ReviewPanel({ map, isAdmin }: { map: MindMap; isAdmin: boolean }) {
  const [items, setItems] = useState<Comment[] | null>(null);
  const [branch, setBranch] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const load = useCallback(() => { rpc<Comment[]>("prep_summary_comments", { p_id: map.id }).then(setItems).catch(e => notify(thaiError(e))); }, [map.id]);
  useEffect(load, [load]);

  const send = async (verdict: "ok" | "fix" | null) => {
    if (verdict !== "ok" && !body.trim()) { notify(verdict === "fix" ? "เขียนว่าต้องแก้ตรงไหน" : "พิมพ์คอมเมนต์ก่อน"); return; }
    setBusy(true);
    try {
      await rpc("prep_summary_comment_add", { p_id: map.id, p_branch: branch || null, p_body: body.trim(), p_verdict: verdict });
      setBody(""); load();
    } catch (e) { notify(thaiError(e)); }
    setBusy(false);
  };
  const resolve = async (c: Comment) => {
    try { await rpc("prep_summary_comment_resolve", { p_comment: c.id, p_on: !c.resolved }); load(); } catch (e) { notify(thaiError(e)); }
  };
  const remove = async (c: Comment) => {
    if (!(await ask({ title: "ลบคอมเมนต์นี้?", ok: "ลบ", danger: true }))) return;
    try { await rpc("prep_summary_comment_delete", { p_comment: c.id }); load(); } catch (e) { notify(thaiError(e)); }
  };

  const title = (id: string | null) => (id ? map.branches.find(b => b.id === id)?.title ?? id : "ทั้งแผนผัง");
  // Latest verdict per branch: how far the review has got.
  const last = new Map<string, "ok" | "fix">();
  for (const c of items ?? []) if (c.verdict && c.branch && !c.resolved) last.set(c.branch, c.verdict);
  const passed = map.branches.filter(b => last.get(b.id) === "ok").length;
  const open = (items ?? []).filter(c => !c.resolved);
  const shown = showDone ? items ?? [] : open;

  return (
    <div className="pp-card mm-review">
      <h3>💬 ตรวจแผนผังนี้</h3>
      <p className="pp-muted small">ผ่านแล้ว {passed}/{map.branches.length} กิ่ง · คอมเมนต์ที่ยังไม่แก้ {open.length}</p>
      <div className="mm-review-chips">
        {map.branches.map(b => (
          <button key={b.id} className={`pp-badge ${last.get(b.id) === "ok" ? "ok" : last.get(b.id) === "fix" ? "bad" : ""}`} onClick={() => setBranch(b.id)}>
            {b.icon} {b.title}{last.get(b.id) === "ok" ? " ✓" : last.get(b.id) === "fix" ? " ✎" : ""}
          </button>
        ))}
      </div>

      <label className="small pp-muted" htmlFor="mm-rv-branch">ตรวจส่วนไหน</label>
      <select id="mm-rv-branch" className="pp-input" value={branch} onChange={e => setBranch(e.target.value)}>
        <option value="">ทั้งแผนผัง</option>
        {map.branches.map(b => <option key={b.id} value={b.id}>{b.icon} {b.title}</option>)}
      </select>
      <textarea className="pp-input" rows={3} maxLength={2000} value={body} onChange={e => setBody(e.target.value)}
        placeholder="เช่น ตารางแถว 2 ควรเป็น... อ้างอิง หนังสือ/พจนานุกรม หน้า..." />
      <div className="pp-row">
        <button className="pp-btn pp-btn-primary sm" disabled={busy} onClick={() => send("ok")}>✓ ผ่าน</button>
        <button className="pp-btn pp-btn-outline sm" disabled={busy} onClick={() => send("fix")}>✎ ต้องแก้</button>
        <button className="pp-btn pp-btn-ghost sm" disabled={busy} onClick={() => send(null)}>ส่งคอมเมนต์</button>
      </div>

      {items === null ? <div className="pp-spinner" /> : (
        <div className="mm-review-list">
          {shown.length === 0 && <p className="pp-muted small">{items.length ? "ทุกคอมเมนต์แก้แล้ว" : "ยังไม่มีคอมเมนต์"}</p>}
          {shown.map(c => (
            <div key={c.id} className={`pp-myrep ${c.resolved ? "done" : ""}`}>
              <div className="pp-myrep-h">
                {c.verdict && <span className={`pp-badge ${c.verdict === "ok" ? "ok" : "bad"}`}>{c.verdict === "ok" ? "ผ่าน" : "ต้องแก้"}</span>}
                <b>{title(c.branch)}</b>
                <span className="pp-muted small">{c.by}{c.admin ? " (แอดมิน)" : ""} · {fmt(c.at)}{c.resolved ? " · แก้แล้ว" : ""}</span>
              </div>
              <div style={{ whiteSpace: "pre-line" }}>{c.body}</div>
              <div className="pp-row">
                {isAdmin && <button className="pp-link small" onClick={() => resolve(c)}>{c.resolved ? "เปิดใหม่" : "แก้แล้ว"}</button>}
                {(isAdmin || (c.mine && !c.resolved)) && <button className="pp-link small" onClick={() => remove(c)}>ลบ</button>}
              </div>
            </div>
          ))}
          {items.length > open.length && (
            <button className="pp-link small" onClick={() => setShowDone(v => !v)}>{showDone ? "ซ่อนที่แก้แล้ว" : `ดูที่แก้แล้ว (${items.length - open.length})`}</button>
          )}
        </div>
      )}
    </div>
  );
}

type Reviewer = { user_id: string; email: string; scope: string[]; granted_at: string; comments: number; last_at: string | null };

// แอดมิน: who may review which maps. Scope = map groups (A3, B1 ...) or major topic codes (B3-THAI); none = every map.
export function Reviewers({ majors }: { majors: { code: string; name: string }[] }) {
  const [list, setList] = useState<Reviewer[] | null>(null);
  const [email, setEmail] = useState("");
  const [scope, setScope] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { rpc<Reviewer[]>("prep_admin_reviewers").then(setList).catch(e => notify(thaiError(e))); }, []);
  useEffect(load, [load]);

  const options: { code: string; name: string }[] = [
    ...GROUPS.filter(g => g.key !== "B3").map(g => ({ code: g.key, name: g.title })),
    ...majors.map(m => ({ code: m.code, name: `วิชาเอก ${m.name}` })),
  ];
  const label = (s: string[]) => (s.length ? s.map(c => options.find(o => o.code === c)?.name ?? c).join(" · ") : "ทุกแผนผัง");
  const toggle = (c: string) => setScope(s => (s.includes(c) ? s.filter(x => x !== c) : [...s, c]));

  const save = async (mail: string, sc: string[], on: boolean) => {
    if (!mail.trim()) { notify("กรอกอีเมลผู้ตรวจ"); return; }
    if (!on && !(await ask({ title: `ถอนสิทธิ์ผู้ตรวจ ${mail}?`, body: "คอมเมนต์ที่เขียนไว้ยังอยู่", ok: "ถอนสิทธิ์", danger: true }))) return;
    setBusy(true);
    try {
      await rpc("prep_admin_reviewer_set", { p_email: mail.trim(), p_scope: sc, p_on: on });
      if (on) { setEmail(""); setScope([]); notify("มอบสิทธิ์แล้ว ผู้ตรวจจะได้รับแจ้งในแอป"); }
      load();
    } catch (e) { notify(thaiError(e)); }
    setBusy(false);
  };

  return (
    <div className="pp-card">
      <h3>ผู้ตรวจสรุปแผนผัง</h3>
      <p className="pp-muted small">ผู้ตรวจต้องล็อกอินแอปด้วยอีเมลนี้มาก่อนอย่างน้อย 1 ครั้ง · เห็นแผนผังร่างในขอบเขตที่เลือก เปิดอ่านได้โดยไม่ต้องมีแพ็ก และเขียนคอมเมนต์ได้ แต่เปิดให้ผู้ใช้เห็นไม่ได้</p>
      <input className="pp-input" type="email" placeholder="อีเมลผู้ตรวจ" value={email} onChange={e => setEmail(e.target.value)} autoComplete="off" />
      <div className="mm-review-chips">
        {options.map(o => (
          <button key={o.code} className={`pp-badge ${scope.includes(o.code) ? "ok" : ""}`} onClick={() => toggle(o.code)}>{scope.includes(o.code) ? "✓ " : ""}{o.name}</button>
        ))}
      </div>
      <p className="pp-muted small">ขอบเขต: {label(scope)}</p>
      <button className="pp-btn pp-btn-primary sm" disabled={busy} onClick={() => save(email, scope, true)}>มอบสิทธิ์ / อัปเดตขอบเขต</button>

      {list && list.length > 0 && (
        <div className="mm-review-list">
          {list.map(r => (
            <div key={r.user_id} className="pp-myrep">
              <div className="pp-myrep-h"><b>{r.email}</b><span className="pp-muted small">คอมเมนต์ {r.comments}{r.last_at ? ` · ล่าสุด ${fmt(r.last_at)}` : ""}</span></div>
              <div className="pp-muted small">{label(r.scope)}</div>
              <div className="pp-row">
                <button className="pp-link small" onClick={() => { setEmail(r.email); setScope(r.scope); }}>แก้ขอบเขต</button>
                <button className="pp-link small" onClick={() => save(r.email, r.scope, false)}>ถอนสิทธิ์</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
