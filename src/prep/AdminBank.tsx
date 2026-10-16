import { useCallback, useEffect, useMemo, useState } from "react";
import { GROUPS, LEVELS, SECTIONS, rpc, thaiError } from "./api";
import { IconCheck, IconX } from "./icons";

type TopicRow = { code: string; name: string; grp: string; section: "A" | "B"; approved: number; review: number; hidden: number; reports: number; answered: number; correct: number };
type Q = {
  id: number; topic: string; topic_name: string; grp: string; section: string; level: string;
  stem: string; choices: string[]; answer: number; explanation: string; law_ref: string | null;
  origin: string; source: string | null; status: "approved" | "review" | "hidden"; created_at: string;
  n: number; correct: number; choice_counts: number[]; reports: string[];
};
type Page = { total: number; by_status: Record<string, number>; items: Q[] };
type Filters = { section: string; grp: string; topic: string; status: string; search: string; sort: string };

const LABELS = ["ก", "ข", "ค", "ง"];
const STATUS: Record<string, string> = { approved: "เผยแพร่", review: "รอตรวจ", hidden: "ซ่อน" };
const ORIGIN: Record<string, string> = { sheet: "ข้อสอบเก่า / เอกสารสรุป", template: "สร้างด้วยโค้ด", ai: "AI", manual: "พิมพ์เอง" };
const SORTS: [string, string][] = [["new", "ใหม่สุด"], ["old", "เก่าสุด"], ["hardest", "ยากสุด (ตอบถูกน้อย)"], ["easiest", "ง่ายสุด"], ["most_answered", "มีคนทำมากสุด"], ["reports", "ถูกรายงานมากสุด"]];
const PAGE = 30;
const EMPTY: Filters = { section: "", grp: "", topic: "", status: "", search: "", sort: "new" };
const pct = (c: number, n: number) => (n ? Math.round((100 * c) / n) : 0);

// reportsOnly: the "รายงาน" tab — questions with open reports, most reported first, no summary.
export default function AdminBank({ reportsOnly = false, onChanged }: { reportsOnly?: boolean; onChanged?: () => void }) {
  const [summary, setSummary] = useState<TopicRow[] | null>(null);
  const [f, setF] = useState<Filters>(reportsOnly ? { ...EMPTY, status: "reported", sort: "reports" } : EMPTY);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState<Page | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [newMajor, setNewMajor] = useState("");
  const addMajor = async () => {
    if (!newMajor.trim()) return;
    try { await rpc("prep_admin_add_major", { p_name: newMajor.trim() }); setNewMajor(""); loadSummary(); }
    catch (e) { setError(thaiError(e)); }
  };

  const loadSummary = useCallback(() => {
    rpc<TopicRow[]>("prep_admin_bank_summary").then(setSummary).catch(e => setError(thaiError(e)));
  }, []);
  useEffect(loadSummary, [loadSummary]);

  // Debounce typing in the search box.
  useEffect(() => {
    const t = setTimeout(() => setF(prev => (prev.search === search ? prev : { ...prev, search })), 350);
    return () => clearTimeout(t);
  }, [search]);

  const query = useCallback((offset: number) => rpc<Page>("prep_admin_questions", {
    p_section: f.section || null, p_grp: f.grp || null, p_topic: f.topic || null, p_status: f.status || null,
    p_search: f.search || null, p_sort: f.sort, p_offset: offset, p_limit: PAGE,
  }), [f]);

  // First page on every filter change; ignore responses from filters that were already replaced.
  useEffect(() => {
    let live = true;
    query(0).then(r => { if (live) { setPage(r); setError(""); } }).catch(e => { if (live) setError(thaiError(e)); });
    return () => { live = false; };
  }, [query]);

  const loadMore = async () => {
    if (!page || busy) return;
    setBusy(true);
    try {
      const r = await query(page.items.length);
      setPage(prev => prev && { ...r, items: [...prev.items, ...r.items] });
    } catch (e) { setError(thaiError(e)); }
    setBusy(false);
  };

  const set = (patch: Partial<Filters>) => { setF(prev => ({ ...prev, ...patch })); setOpen(null); };
  const groupsOf = (sec: string) => (sec ? SECTIONS[sec as "A" | "B"].groups : Object.keys(GROUPS));
  const topicsOf = useMemo(() => (summary ?? []).filter(t => (!f.section || t.section === f.section) && (!f.grp || t.grp === f.grp)), [summary, f.section, f.grp]);

  const drop = (id: number) => setPage(prev => prev && { ...prev, total: prev.total - 1, items: prev.items.filter(x => x.id !== id) });
  const replace = (q: Q) => setPage(prev => prev && { ...prev, items: prev.items.map(x => (x.id === q.id ? q : x)) });

  return (
    <>
      {/* summary by section → group → topic */}
      {reportsOnly && <p className="pp-muted small">ข้อที่ผู้ใช้รายงานและยังไม่ได้ปิด · แก้ไขข้อแล้วกดบันทึก (ปิดรายงานเป็น "แก้ไขแล้ว") หรือกด "ข้อนี้ถูกต้อง" เพื่อปฏิเสธรายงาน · ข้อความตอบกลับจะแสดงให้ผู้รายงานเห็น</p>}
      {!reportsOnly && <div className="pp-card">
        <h3>คลังข้อสอบแยกตามภาค</h3>
        {!summary ? <div className="pp-spinner" /> : (["A", "B"] as const).map(sec => {
          const ts = summary.filter(t => t.section === sec);
          const sum = (k: "approved" | "review" | "hidden" | "reports") => ts.reduce((s, t) => s + t[k], 0);
          return (
            <details key={sec} className="pp-acc">
              <summary>
                <div className="pp-bank-row head">
                  <span className="pp-bank-name"><span className="pp-sec-badge sm">{SECTIONS[sec].short}</span>{SECTIONS[sec].name}</span>
                  <BankCounts a={sum("approved")} r={sum("review")} h={sum("hidden")} rep={sum("reports")} />
                </div>
              </summary>
              <div className="pp-acc-body">
                {SECTIONS[sec].groups.map(g => {
                  const gt = ts.filter(t => t.grp === g);
                  if (!gt.length) return null;
                  return (
                    <div key={g} className="pp-bank-grp">
                      <button className="pp-bank-row grp" onClick={() => set({ section: sec, grp: g, topic: "" })}>
                        <span className="pp-bank-name">{GROUPS[g]}</span>
                        <BankCounts a={gt.reduce((s, t) => s + t.approved, 0)} r={gt.reduce((s, t) => s + t.review, 0)} h={gt.reduce((s, t) => s + t.hidden, 0)} rep={gt.reduce((s, t) => s + t.reports, 0)} />
                      </button>
                      {gt.map(t => (
                        <button key={t.code} className={`pp-bank-row ${f.topic === t.code ? "on" : ""}`} onClick={() => set({ section: sec, grp: g, topic: t.code })}>
                          <span className="pp-bank-name small">{t.name}{t.answered > 0 && <em> · ตอบถูก {pct(t.correct, t.answered)}%</em>}</span>
                          <BankCounts a={t.approved} r={t.review} h={t.hidden} rep={t.reports} />
                        </button>
                      ))}
                      {g === "B3" && (
                        <div className="pp-row pp-add-major">
                          <input className="pp-input" placeholder="เพิ่มวิชาเอกที่ยังไม่มี เช่น ภาษาญี่ปุ่น" value={newMajor}
                            onChange={e => setNewMajor(e.target.value)} onKeyDown={e => e.key === "Enter" && addMajor()} />
                          <button className="pp-btn pp-btn-ghost" disabled={!newMajor.trim()} onClick={addMajor}>เพิ่มวิชาเอก</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>}

      {/* filters */}
      <div className="pp-card pp-filters">
        <input className="pp-input" type="search" placeholder="ค้นหาโจทย์ ตัวเลือก คำอธิบาย มาตรา ที่มา หรือเลขข้อ" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="pp-filter-row">
          <select className="pp-input" value={f.section} onChange={e => set({ section: e.target.value, grp: "", topic: "" })} aria-label="ภาค">
            <option value="">ทุกภาค</option>
            <option value="A">ภาค ก</option><option value="B">ภาค ข</option>
          </select>
          <select className="pp-input" value={f.grp} onChange={e => set({ grp: e.target.value, topic: "" })} aria-label="กลุ่มวิชา">
            <option value="">ทุกกลุ่มวิชา</option>
            {groupsOf(f.section).map(g => <option key={g} value={g}>{GROUPS[g]}</option>)}
          </select>
          <select className="pp-input" value={f.topic} onChange={e => set({ topic: e.target.value })} aria-label="หมวด">
            <option value="">ทุกหมวด</option>
            {topicsOf.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
          </select>
          <select className="pp-input" value={f.status} onChange={e => set({ status: e.target.value })} aria-label="สถานะ">
            <option value="">ทุกสถานะ</option>
            <option value="approved">เผยแพร่</option><option value="review">รอตรวจ</option>
            <option value="hidden">ซ่อน</option><option value="reported">มีรายงานปัญหา</option>
          </select>
          <select className="pp-input" value={f.sort} onChange={e => set({ sort: e.target.value })} aria-label="เรียงตาม">
            {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className="pp-filter-sum">
          {page && <span>พบ <b>{page.total.toLocaleString()}</b> ข้อ{Object.entries(page.by_status).map(([k, v]) => ` · ${STATUS[k] ?? k} ${v}`).join("")}</span>}
          {JSON.stringify(f) !== JSON.stringify(EMPTY) && <button className="pp-link small" onClick={() => { setSearch(""); setF(EMPTY); }}>ล้างตัวกรอง</button>}
        </div>
      </div>

      {error && <div className="pp-error">{error}</div>}
      {!page && <div className="pp-spinner" />}
      {page?.items.map(q => (
        <QuestionCard key={q.id} q={q} topics={summary ?? []} open={open === q.id}
          onToggle={() => setOpen(open === q.id ? null : q.id)}
          onSaved={nq => { if (reportsOnly) drop(nq.id); else replace(nq); loadSummary(); onChanged?.(); }}
          onResolved={nq => { if (reportsOnly) drop(nq.id); else replace(nq); loadSummary(); onChanged?.(); }} />
      ))}
      {page && page.items.length < page.total && (
        <button className="pp-btn pp-btn-ghost pp-wide" disabled={busy} onClick={loadMore}>
          {busy ? "กำลังโหลด..." : `โหลดเพิ่ม (${page.items.length}/${page.total})`}
        </button>
      )}
      {page && page.total === 0 && <div className="pp-card pp-empty"><p className="pp-muted">{reportsOnly ? "ไม่มีรายงานค้าง" : "ไม่พบข้อสอบตามเงื่อนไข"}</p></div>}
    </>
  );
}

function BankCounts({ a, r, h, rep }: { a: number; r: number; h: number; rep: number }) {
  return (
    <span className="pp-bank-c">
      <span className="ok" title="เผยแพร่">{a}</span>
      {r > 0 && <span className="warn" title="รอตรวจ">{r} รอตรวจ</span>}
      {h > 0 && <span title="ซ่อน">{h} ซ่อน</span>}
      {rep > 0 && <span className="bad" title="รายงานปัญหา">{rep} รายงาน</span>}
    </span>
  );
}

function QuestionCard({ q, topics, open, onToggle, onSaved, onResolved }: {
  q: Q; topics: TopicRow[]; open: boolean; onToggle: () => void; onSaved: (q: Q) => void; onResolved: (q: Q) => void;
}) {
  const [edit, setEdit] = useState<Q | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [dupes, setDupes] = useState<Q[] | null>(null);
  const resolve = async (status: "fixed" | "rejected") => {
    setBusy(true); setErr("");
    try {
      await rpc("prep_admin_resolve_reports", { p_question: q.id, p_status: status, p_note: note.trim() || null });
      onResolved({ ...q, reports: [] }); setNote("");
    } catch (e) { setErr(thaiError(e)); }
    setBusy(false);
  };
  const total = q.choice_counts.reduce((s, x) => s + x, 0);

  // The fixed wording already exists as another question: show it so the admin can hide this copy instead.
  const findTwins = async (stem: string, choices: string[]) => {
    const norm = (s: string) => s.replace(/\s+/g, "");
    try {
      const r = await rpc<Page>("prep_admin_questions", { p_search: stem.trim().slice(0, 40), p_sort: "new", p_offset: 0, p_limit: 30 });
      setDupes(r.items.filter(i => i.id !== q.id && norm(i.stem) === norm(stem) && choices.map(norm).join("|") === i.choices.map(norm).join("|")));
    } catch { setDupes([]); }
  };

  const save = async (patch: Partial<Q>) => {
    setBusy(true); setErr(""); setDupes(null);
    try {
      await rpc("prep_admin_save_question", { p_id: q.id, p_patch: patch });
      const t = topics.find(x => x.code === (patch.topic ?? q.topic));
      onSaved({ ...q, ...patch, topic_name: t?.name ?? q.topic_name, grp: t?.grp ?? q.grp, section: t?.section ?? q.section, reports: [] });
      setEdit(null);
    } catch (e) {
      if (e instanceof Error && e.message === "duplicate_question" && patch.stem && patch.choices) await findTwins(patch.stem, patch.choices);
      else setErr(thaiError(e));
    }
    setBusy(false);
  };

  return (
    <div className={`pp-card pp-qcard st-${q.status}`}>
      <button className="pp-qcard-h" onClick={onToggle} aria-expanded={open}>
        <div className="pp-qcard-meta">
          <span className={`pp-badge ${q.status === "approved" ? "ok" : q.status === "review" ? "warn" : ""}`}>{STATUS[q.status]}</span>
          <span className="pp-muted small">#{q.id} · {SECTIONS[q.section as "A" | "B"]?.short} · {q.topic_name}</span>
          {q.reports.length > 0 && <span className="pp-badge bad">รายงาน {q.reports.length}</span>}
          <span className="pp-spacer" />
          {q.n > 0 && <span className="pp-muted small">ถูก {pct(q.correct, q.n)}% ({q.n} คน)</span>}
        </div>
        <div className={`pp-qcard-stem ${open ? "" : "clamp"}`}>{q.stem}</div>
      </button>

      {open && !edit && (
        <div className="pp-qcard-body">
          {q.choices.map((c, i) => (
            <div key={i} className={`pp-draft-choice ${q.answer === i ? "right" : ""}`}>
              <span><b>{LABELS[i]}.</b> {c} {q.answer === i && <IconCheck size={14} />}</span>
              {total > 0 && <span className="pp-dist"><i style={{ width: `${pct(q.choice_counts[i], total)}%` }} />{pct(q.choice_counts[i], total)}%</span>}
            </div>
          ))}
          {q.explanation && <p className="pp-qcard-exp"><b>คำอธิบาย:</b> {q.explanation}</p>}
          <div className="pp-muted small pp-qcard-info">
            {q.law_ref && <span>อ้างอิง: {q.law_ref}</span>}
            <span>ระดับ: {LEVELS[q.level] ?? q.level}</span>
            <span>ที่มา: {ORIGIN[q.origin] ?? q.origin}{q.source ? ` · ${q.source}` : ""}</span>
            <span>เพิ่มเมื่อ {new Date(q.created_at).toLocaleDateString("th-TH")}</span>
          </div>
          {q.reports.length > 0 && (
            <div className="pp-reports">
              <b>รายงานจากผู้ใช้ {q.reports.length} รายการ</b>
              <ul>{q.reports.map((r, i) => <li key={i}>{r}</li>)}</ul>
              <input className="pp-input" maxLength={300} placeholder="ข้อความตอบกลับผู้รายงาน (ไม่บังคับ) เช่น แก้เฉลยเป็นข้อ ค แล้ว" value={note} onChange={e => setNote(e.target.value)} />
              <div className="pp-row">
                <button className="pp-btn pp-btn-outline" disabled={busy} onClick={() => resolve("rejected")}>ข้อนี้ถูกต้อง (ปฏิเสธรายงาน)</button>
                <button className="pp-btn pp-btn-ghost" disabled={busy} onClick={() => resolve("fixed")}>แก้ไขแล้ว (ปิดรายงาน)</button>
              </div>
            </div>
          )}
          {err && <div className="pp-error">{err}</div>}
          <div className="pp-row">
            <button className="pp-btn pp-btn-outline" onClick={() => setEdit({ ...q })}>แก้ไข</button>
            {q.status !== "approved" && <button className="pp-btn pp-btn-primary" disabled={busy} onClick={() => save({ status: "approved" })}><IconCheck />อนุมัติ/เผยแพร่</button>}
            {q.status !== "hidden" && <button className="pp-btn pp-btn-ghost" disabled={busy} onClick={() => save({ status: "hidden" })}><IconX />ซ่อน</button>}
            {q.status === "hidden" && <button className="pp-btn pp-btn-ghost" disabled={busy} onClick={() => save({ status: "review" })}>ย้ายไปรอตรวจ</button>}
          </div>
        </div>
      )}

      {open && edit && (
        <div className="pp-qcard-body pp-review">
          <label className="small">โจทย์</label>
          <textarea className="pp-input" rows={3} value={edit.stem} onChange={e => setEdit({ ...edit, stem: e.target.value })} />
          <label className="small">ตัวเลือก (เลือกวงกลมหน้าข้อที่ถูก)</label>
          {edit.choices.map((c, i) => (
            <label key={i} className={`pp-review-choice ${edit.answer === i ? "right" : ""}`}>
              <input type="radio" name={`e${q.id}`} checked={edit.answer === i} onChange={() => setEdit({ ...edit, answer: i })} />
              <span>{LABELS[i]}</span>
              <input className="pp-input" value={c} onChange={e => setEdit({ ...edit, choices: edit.choices.map((x, k) => (k === i ? e.target.value : x)) })} />
            </label>
          ))}
          <label className="small">คำอธิบาย</label>
          <textarea className="pp-input" rows={3} value={edit.explanation} onChange={e => setEdit({ ...edit, explanation: e.target.value })} />
          <div className="pp-filter-row">
            <label className="small">อ้างอิง (มาตรา/กฎหมาย)
              <input className="pp-input" value={edit.law_ref ?? ""} onChange={e => setEdit({ ...edit, law_ref: e.target.value })} />
            </label>
            <label className="small">หมวด
              <select className="pp-input" value={edit.topic} onChange={e => setEdit({ ...edit, topic: e.target.value })}>
                {topics.map(t => <option key={t.code} value={t.code}>{SECTIONS[t.section].short} · {t.name}</option>)}
              </select>
            </label>
            <label className="small">ระดับความคิด
              <select className="pp-input" value={edit.level} onChange={e => setEdit({ ...edit, level: e.target.value })}>
                {Object.entries(LEVELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
          </div>
          {err && <div className="pp-error">{err}</div>}
          {dupes && (
            <div className="pp-error pp-dupe">
              <b>โจทย์ที่แก้แล้วซ้ำกับข้อที่มีอยู่ในคลัง</b>
              <span>แปลว่ามีข้อที่ถูกต้องอยู่แล้ว ไม่ต้องแก้ข้อนี้ ให้ซ่อนข้อนี้แทน ระบบจะปิดรายงานว่าแก้แล้ว</span>
              {dupes.length > 0
                ? dupes.map(d => <span key={d.id} className="small">ข้อที่ซ้ำ: #{d.id} · {STATUS[d.status]}{d.source ? ` · ${d.source}` : ""}</span>)
                : <span className="small">ค้นไม่พบข้อที่ซ้ำโดยตรง ลองค้นโจทย์ในช่องค้นหาด้านบน</span>}
              {dupes.length > 0 && dupes.every(d => d.status !== "approved") && <b>ข้อที่ซ้ำยังไม่ได้เผยแพร่ ไปเผยแพร่ข้อนั้นก่อน แล้วค่อยซ่อนข้อนี้</b>}
              <button className="pp-btn pp-btn-primary" disabled={busy} onClick={() => save({ status: "hidden" })}>ซ่อนข้อนี้ (ซ้ำกับข้อที่ถูกต้อง) และปิดรายงาน</button>
            </div>
          )}
          <div className="pp-row">
            <button className="pp-btn pp-btn-ghost" onClick={() => { setEdit(null); setErr(""); setDupes(null); }}>ยกเลิก</button>
            <button className="pp-btn pp-btn-primary" disabled={busy} onClick={() => save({
              stem: edit.stem, choices: edit.choices, answer: edit.answer, explanation: edit.explanation,
              law_ref: edit.law_ref, topic: edit.topic, level: edit.level,
            })}>{busy ? "กำลังบันทึก..." : "บันทึก"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
