import { useCallback, useEffect, useState } from "react";
import { rpc, thaiError } from "./api";
import { ask } from "./dialog";
import Skeleton from "./Skeleton";

type AreaStats = {
  answered: number; none: number; snoozed: number;
  rows: { label: string; kind: string; provinces: string[]; n: number; paid: number; majors: { name: string; n: number }[] | null }[];
};
type Post = {
  event_id: number;
  exam: { phase: "recap" | "result"; exam_on: string; result_on: string | null } | null;
  responders: number;
  votes: { code: string; name: string | null; section: string | null; y: number; n: number }[];
  difficulty: { A: number | null; B: number | null; M: number | null } | null;
  stories: { note: string; updated_at: string; email: string; major: string | null }[];
  notes: { id: number; topic: string | null; body: string; published: boolean }[];
  outcomes: { pass: number; fail: number; absent: number; unsure: number } | null;
  next: Record<string, number>;
} | null;

const NEXT_LABEL: Record<string, string> = { next: "ครูผู้ช่วยรอบหน้า", local: "ครูท้องถิ่น", bkk: "ครู กทม.", ocsc: "ภาค ก ก.พ.", other: "อื่น ๆ", done: "ยังไม่สอบต่อ" };
const KIND_LABEL: Record<string, string> = { "": "ทุกสังกัด", spp: "สพป.", spm: "สพม.", sped: "ศึกษาพิเศษ", vec: "อาชีวะ" };

// แอดมิน → ผู้ใช้ → เขต·หลังสอบ: ผลสำรวจเขตที่ลงสอบ, ข้อสอบจริงออกเรื่องไหน (โหวต + เรื่องเล่า), สรุปที่ทีมงานเขียนเอง, ผลสอบ/สนามถัดไป
export default function AdminPostExam() {
  const [areas, setAreas] = useState<AreaStats | null>(null);
  const [post, setPost] = useState<Post | undefined>(undefined);
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(() => {
    rpc<AreaStats>("prep_admin_area_stats").then(setAreas).catch(e => setError(thaiError(e)));
    rpc<Post>("prep_admin_postexam").then(setPost).catch(e => { setError(thaiError(e)); setPost(null); });
  }, []);
  useEffect(load, [load]);

  const rows = (areas?.rows ?? []).filter(r => (!kind || r.kind === kind) && r.label.includes(q.trim()));
  const csv = () => {
    const lines = [["เขต", "คน", "มีแพ็ก", "เอก 3 อันดับ"], ...(areas?.rows ?? []).map(r => [r.label, r.n, r.paid, (r.majors ?? []).map(m => `${m.name} ${m.n}`).join(" / ")])];
    const blob = new Blob(["﻿" + lines.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "sobprep-areas.csv"; a.click();
  };

  return (
    <>
      {error && <div className="pp-error">{error}</div>}
      <div className="pp-card">
        <h3>เขตที่ลงสอบ</h3>
        {!areas ? <Skeleton kind="list" n={3} /> : <>
          <p className="pp-muted small">ตอบแล้ว {areas.answered.toLocaleString()} คน · ไม่ได้สมัครรอบนี้ {areas.none} · กด "ไว้ทีหลัง" {areas.snoozed}</p>
          <div className="pp-seg pp-seg-sub">
            {Object.entries(KIND_LABEL).map(([k, l]) => <button key={k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>{l}</button>)}
          </div>
          <div className="pp-row">
            <input className="pp-input" placeholder="ค้นหาชื่อเขต/จังหวัด" value={q} onChange={e => setQ(e.target.value)} />
            <button className="pp-btn pp-btn-ghost" onClick={csv}>ดาวน์โหลด CSV</button>
          </div>
          <div className="pp-otable-wrap">
            <table className="pp-otable">
              <thead><tr><th>เขต</th><th>คน</th><th>มีแพ็ก</th><th>เอกที่มากสุด</th></tr></thead>
              <tbody>
                {rows.slice(0, 300).map(r => (
                  <tr key={r.label}><td>{r.label}</td><td>{r.n}</td><td>{r.paid}</td>
                    <td className="small">{(r.majors ?? []).map(m => `${m.name} ${m.n}`).join(" · ")}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}
      </div>

      {post === undefined && <Skeleton kind="list" n={3} />}
      {post === null && !error && <div className="pp-card"><p className="pp-muted">ยังไม่มีวันสอบในปฏิทิน</p></div>}
      {post && <>
        <div className="pp-card">
          <h3>หลังสอบ</h3>
          <p className="pp-muted small">
            {post.exam
              ? post.exam.phase === "recap"
                ? `ตอนนี้ผู้ใช้เห็นการ์ด "ข้อสอบออกเรื่องไหน" จนถึงวันประกาศผล ${post.exam.result_on ?? "(ยังไม่ได้ใส่ในปฏิทิน)"}`
                : "ตอนนี้ผู้ใช้เห็นการ์ดถามผลสอบ + สนามสอบถัดไป (หน้าโหวตยังเปิดอยู่)"
              : "การ์ดหลังสอบยังไม่แสดงให้ผู้ใช้ (เปิดเอง 17:00 น. ของวันสอบวันสุดท้ายตามปฏิทินสอบ) · เขียนสรุปเตรียมไว้ก่อนได้"}
          </p>
          {post.outcomes && (
            <p>ผลสอบ: ผ่าน <b>{post.outcomes.pass}</b> · ไม่ผ่าน <b>{post.outcomes.fail}</b> · ไม่ได้สอบ <b>{post.outcomes.absent}</b>{post.outcomes.unsure ? ` · รอลุ้น ${post.outcomes.unsure}` : ""}</p>
          )}
          {Object.keys(post.next).length > 0 && (
            <p>จะสอบต่อ: {Object.entries(post.next).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${NEXT_LABEL[k] ?? k} ${n}`).join(" · ")}</p>
          )}
        </div>

        <NotesEditor eventId={post.event_id} notes={post.notes} topics={post.votes} onChanged={load} />

        <div className="pp-card">
          <h3>โหวต "ออกเรื่องไหน" · {post.responders.toLocaleString()} คน</h3>
          {post.difficulty && <p className="pp-muted small">ความยากเฉลี่ย (1–5): ภาค ก {post.difficulty.A ?? "–"} · ภาค ข {post.difficulty.B ?? "–"} · วิชาเอก {post.difficulty.M ?? "–"}</p>}
          <div className="pp-otable-wrap">
            <table className="pp-otable">
              <thead><tr><th>หมวด</th><th>ออก</th><th>ไม่ออก</th><th>% ออก</th></tr></thead>
              <tbody>
                {post.votes.map(v => (
                  <tr key={v.code}><td>{v.section === "A" ? "ก · " : "ข · "}{v.name ?? v.code}</td><td>{v.y}</td><td>{v.n}</td>
                    <td>{v.y + v.n ? Math.round(100 * v.y / (v.y + v.n)) : 0}%</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pp-card">
          <h3>เรื่องเล่าจากผู้สอบ ({post.stories.length})</h3>
          <p className="pp-muted small">ผู้ใช้ไม่เห็นส่วนนี้ ใช้ปรับคลังข้อสอบ</p>
          {post.stories.map((s, i) => (
            <div key={i} className="pp-recap-story">
              <div className="pp-muted small">{s.email} · {s.major ?? "ไม่ระบุเอก"} · {new Date(s.updated_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</div>
              <div>{s.note}</div>
            </div>
          ))}
        </div>
      </>}
    </>
  );
}

// สรุปที่ทีมงานเขียนเอง: ภาพรวม (ไม่เลือกหมวด) หรือรายหมวด แสดงในหน้า /prep/recap
function NotesEditor({ eventId, notes, topics, onChanged }: {
  eventId: number; notes: NonNullable<Post>["notes"]; topics: NonNullable<Post>["votes"]; onChanged: () => void;
}) {
  const [all, setAll] = useState<{ code: string; name: string }[]>([]);
  const [edit, setEdit] = useState<{ id: number | null; topic: string; body: string; published: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    rpc<{ code: string; name: string; section: string }[]>("prep_topics")
      .then(t => setAll(t.filter(x => x.section === "A" || x.section === "B").map(x => ({ code: x.code, name: x.name })))).catch(() => { /* use voted topics */ });
  }, []);
  const names = new Map([...topics.map(t => [t.code, t.name ?? t.code] as const), ...all.map(t => [t.code, t.name] as const)]);

  const save = async () => {
    if (!edit || busy || !edit.body.trim()) return;
    setBusy(true); setErr("");
    try {
      await rpc("prep_admin_recap_note_save", { p_id: edit.id, p_event: eventId, p_topic: edit.topic || null, p_body: edit.body, p_published: edit.published });
      setEdit(null); onChanged();
    } catch (e) { setErr(thaiError(e)); }
    setBusy(false);
  };
  const del = async (id: number) => {
    if (!(await ask({ title: "ลบสรุปนี้?", ok: "ลบ", danger: true }))) return;
    try { await rpc("prep_admin_recap_note_delete", { p_id: id }); onChanged(); } catch (e) { setErr(thaiError(e)); }
  };

  return (
    <div className="pp-card">
      <h3>สรุปจากทีมงาน (กรอกเอง)</h3>
      <p className="pp-muted small">แสดงในหน้า "ข้อสอบจริงออกเรื่องไหน" · เลือกหมวดเพื่อแสดงใต้หมวดนั้น หรือไม่เลือกเพื่อแสดงเป็นภาพรวมด้านบน</p>
      {notes.map(n => (
        <div key={n.id} className="pp-recap-story">
          <div className="pp-muted small">{n.topic ? names.get(n.topic) ?? n.topic : "ภาพรวม"}{n.published ? "" : " · ซ่อนอยู่"}</div>
          <div>{n.body}</div>
          <div className="pp-row">
            <button className="pp-link" onClick={() => setEdit({ id: n.id, topic: n.topic ?? "", body: n.body, published: n.published })}>แก้ไข</button>
            <button className="pp-link" onClick={() => del(n.id)}>ลบ</button>
          </div>
        </div>
      ))}
      {edit ? <>
        <select className="pp-input" value={edit.topic} onChange={e => setEdit({ ...edit, topic: e.target.value })}>
          <option value="">ภาพรวม (ไม่ระบุหมวด)</option>
          {[...names.entries()].map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </select>
        <textarea className="pp-input" rows={3} maxLength={2000} value={edit.body} onChange={e => setEdit({ ...edit, body: e.target.value })}
          placeholder="เช่น ภาค ก ปีนี้อนุกรมออก 3 ข้อ เน้นอนุกรมซ้อน" />
        <label className="pp-row small"><input type="checkbox" checked={edit.published} onChange={e => setEdit({ ...edit, published: e.target.checked })} /> แสดงให้ผู้ใช้เห็น</label>
        {err && <div className="pp-error">{err}</div>}
        <div className="pp-row">
          <button className="pp-btn pp-btn-primary" disabled={busy || !edit.body.trim()} onClick={save}>{busy ? "กำลังบันทึก..." : "บันทึก"}</button>
          <button className="pp-btn pp-btn-ghost" onClick={() => setEdit(null)}>ยกเลิก</button>
        </div>
      </> : <button className="pp-btn pp-btn-outline" onClick={() => setEdit({ id: null, topic: "", body: "", published: true })}>+ เขียนสรุป</button>}
    </div>
  );
}
