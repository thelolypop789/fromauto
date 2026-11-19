import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { rpc, supabase, thaiError } from "../api";
import { SHOP } from "../config";
import { ask, notify } from "../dialog";
import { navigate, usePath } from "../router";
import { shrink } from "../slip";
import Skeleton from "../Skeleton";
import { PAGE_H, PAGE_W, fontsReady, paginate, type Block, type Vars } from "./planDoc";
import "./plans.css";

// แผนการจัดการเรียนรู้สำเร็จรูป (/prep/plans, /prep/plans/<id>)
// ทุกคนดูตัวอย่างได้ (หัวแผน + ข้อ 1–4) · โหลด PDF ได้เมื่อมีแพ็กครบทุกภาค หรือซื้อรายแผน · ไม่มีปุ่มโหลด Word

type Format = { key: string; name: string; full: string; desc: string; steps: { name: string; minutes: number }[] };
type Plan = {
  id: number; slug: string; grp: string; subject: string; course_code: string | null; grade: string;
  unit_no: number | null; unit_title: string | null; plan_no: number | null; title: string; periods: number; minutes: number;
  summary: string | null; price: number; media_url: string | null; formats: Format[];
  published: boolean;
  access: "admin" | "pack" | null;     // สิทธิ์ทุกรูปแบบ (แอดมิน / แพ็กครบทุกภาค)
  owned: string[];                     // รูปแบบที่ซื้อแยกแล้ว
  pending: string[];                   // รูปแบบที่ส่งสลิปรอตรวจ
};
type List = { full_name: string | null; plans: Plan[] };
type Doc = { id: number; format: string; access: "admin" | "pack" | "purchase" | null; preview: Block[]; locked: Block[] | null; locked_blocks: number };

// ภาคเรียน/ปีการศึกษาตั้งต้นตามวันนี้ (ภาค 1 = พ.ค.–ต.ค., ภาค 2 = พ.ย.–มี.ค.)
function defaultTerm() {
  const d = new Date(), m = d.getMonth() + 1, be = d.getFullYear() + 543;
  return { term: m >= 5 && m <= 10 ? "1" : "2", year: String(m >= 5 ? be : be - 1) };
}
const load = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };

const unitKey = (p: Plan) => `${p.course_code ?? p.subject}|${p.grade}|${p.unit_no}`;

export default function Plans({ onBack, onBuyPack }: { onBack: () => void; onBuyPack: () => void }) {
  const path = usePath();
  const id = Number(path.match(/^\/prep\/plans\/(\d+)/)?.[1] ?? 0);
  const [list, setList] = useState<List | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(() => rpc<List>("prep_lesson_plans").then(r => { setList(r); setError(""); }).catch(e => setError(thaiError(e))), []);
  useEffect(() => { reload(); }, [reload]);

  if (error) return <div className="pp-card"><div className="pp-error">{error}</div><button className="pp-btn pp-btn-primary" onClick={reload}>ลองใหม่</button></div>;
  if (!list) return <Skeleton kind="cards" n={3} />;
  const plan = id ? list.plans.find(p => p.id === id) : undefined;
  if (id && plan) return <Detail key={plan.id} plan={plan} fullName={list.full_name} onBack={() => navigate("/prep/plans")} onBuyPack={onBuyPack} onChanged={reload} />;

  const groups = [...new Set(list.plans.map(p => p.grp))];
  return (
    <div>
      <button className="pp-link" onClick={onBack}>‹ กลับ</button>
      <div className="lp-hero">
        <h2>แผนการสอนสำเร็จรูป</h2>
        <p className="pp-muted small" style={{ margin: 0 }}>แผนเต็มพร้อมใบงาน แบบประเมิน และสื่อออนไลน์ เลือกได้ 3 รูปแบบ: PhenoBL · Active Learning · 5E ดูตัวอย่างได้ฟรี โหลดเป็น PDF ใส่ชื่อผู้สอนให้อัตโนมัติ</p>
      </div>
      {list.plans.length === 0 && <div className="pp-card pp-muted">ยังไม่มีแผนที่เปิดให้ดู เร็ว ๆ นี้</div>}
      {groups.map(g => (
        <section key={g}>
          <h3 className="lp-grp">{g}</h3>
          {/* หน่วยการเรียนรู้หนึ่งมีหลายแผน (เรื่องย่อย) → จัดกลุ่มตามรายวิชา + หน่วย */}
          {[...new Set(list.plans.filter(p => p.grp === g).map(unitKey))].map(u => {
            const ps = list.plans.filter(p => p.grp === g && unitKey(p) === u);
            const f = ps[0];
            return (
              <div key={u} className="lp-unit">
                <div className="lp-unit-h">
                  <span className="meta">{f.subject} {f.course_code ? `(${f.course_code}) ` : ""}{f.grade}</span>
                  <b>หน่วยที่ {f.unit_no} {f.unit_title}</b>
                  <span className="meta">{ps.length} แผน</span>
                </div>
                <div className="lp-list">
                  {ps.map(p => (
                    <button key={p.id} className="lp-item" onClick={() => navigate(`/prep/plans/${p.id}`)}>
                      <span className="t">แผนที่ {p.plan_no} {p.title}</span>
                      {p.summary && <span className="pp-muted small">{p.summary}</span>}
                      <span className="lp-chips">
                        {!p.published && <span className="lp-chip wait">ยังไม่เผยแพร่ (แอดมินเห็นคนเดียว)</span>}
                        {p.formats.map(x => <span key={x.key} className={`lp-chip${p.access || p.owned.includes(x.key) ? " own" : ""}`}>{x.name}</span>)}
                        <span className="lp-chip">{p.periods * p.minutes} นาที</span>
                        {p.access ? <span className="lp-chip own">โหลดได้ทุกรูปแบบ</span>
                          : p.pending.length ? <span className="lp-chip wait">รอตรวจสลิป</span>
                          : <span className="lp-chip price">รูปแบบละ {p.price} บาท</span>}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function Detail({ plan, fullName, onBack, onBuyPack, onChanged }: { plan: Plan; fullName: string | null; onBack: () => void; onBuyPack: () => void; onChanged: () => void }) {
  const [fmt, setFmt] = useState(() => {
    const f = new URLSearchParams(location.search).get("f");
    return plan.formats.some(x => x.key === f) ? f! : plan.formats[0]?.key ?? "";
  });
  const pickFmt = (k: string) => { setFmt(k); history.replaceState(history.state, "", `/prep/plans/${plan.id}?f=${k}`); };
  const [loaded, setDoc] = useState<Doc | null>(null);
  const doc = loaded && loaded.format === fmt ? loaded : null;    // เปลี่ยนรูปแบบ = ยังไม่มีเอกสารจนกว่าจะโหลดเสร็จ
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    rpc<Doc>("prep_lesson_plan", { p_id: plan.id, p_format: fmt }).then(d => { if (live) { setDoc(d); setErr(""); } }).catch(e => { if (live) setErr(thaiError(e)); });
    return () => { live = false; };
  }, [plan.id, fmt]);

  const def = defaultTerm();
  const [term, setTerm] = useState(() => load("lp-term", def.term));
  const [year, setYear] = useState(() => load("lp-year", def.year));
  const [name, setName] = useState(fullName);
  const vars: Vars = { teacher: name ?? "", term, year };
  const format = plan.formats.find(f => f.key === fmt);
  const owned = !!(doc?.access);
  const blocks = doc ? (doc.locked ? [...doc.preview, ...doc.locked] : doc.preview) : null;

  // ---------- พรีวิว: ตัดหน้าในกล่องวัดนอกจอ แล้วย้ายหน้าเข้ากล่องย่อขนาด ----------
  const host = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLElement[]>([]);
  const [width, setWidth] = useState(0);
  const [nPages, setNPages] = useState(0);
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const key = JSON.stringify([doc?.format, doc?.access, vars]);
  useEffect(() => {
    const el = host.current;
    if (!el || !blocks) return;
    let live = true;
    (async () => {
      await fontsReady();
      if (!live) return;
      const measure = document.createElement("div");
      measure.className = "lp-measure";
      document.body.append(measure);
      const pages = paginate(blocks, vars, measure);
      el.replaceChildren();
      pages.forEach((pg, i) => {
        const fit = document.createElement("div");
        fit.className = "lp-fit";
        const scale = document.createElement("div");
        scale.className = "lp-scale";
        scale.append(pg);
        fit.append(scale);
        const no = document.createElement("div");
        no.className = "lp-pageno";
        no.textContent = `หน้า ${i + 1}`;
        el.append(fit, no);
      });
      measure.remove();
      pagesRef.current = pages;
      setNPages(pages.length);
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  // ย่อหน้าให้พอดีความกว้างจอ
  const scale = Math.min(1, (width || PAGE_W) / PAGE_W);
  useEffect(() => {
    host.current?.querySelectorAll<HTMLElement>(".lp-fit").forEach(f => {
      f.style.width = `${PAGE_W * scale}px`;
      f.style.height = `${PAGE_H * scale}px`;
      (f.firstElementChild as HTMLElement).style.transform = `scale(${scale})`;
    });
  }, [scale, nPages, key]);

  // ---------- โหลด PDF ----------
  const [busy, setBusy] = useState<string>("");
  const download = async () => {
    if (!owned || busy || !doc?.locked) return;
    if (!name) { notify("กรอกชื่อ-สกุลก่อนโหลดแผน"); return; }
    setBusy("กำลังเตรียมไฟล์...");
    try {
      const r = await rpc<{ id: number; full_name: string; email: string | null }>("prep_lesson_plan_download", { p_id: plan.id, p_format: fmt });
      const { pagesToPdf, saveBlob } = await import("./planPdf");
      const blob = await pagesToPdf(pagesRef.current, {
        title: `แผนการจัดการเรียนรู้ที่ ${plan.plan_no} เรื่อง ${plan.title} (${format?.name ?? fmt})`,
        author: r.full_name,
        subject: `${plan.subject} ${plan.course_code ?? ""} ${plan.grade} หน่วยที่ ${plan.unit_no} · SOBPREP`,
        keywords: ["SOBPREP", `dl-${r.id}`, r.email ?? "", r.full_name],
      }, (d, t) => setBusy(`กำลังสร้าง PDF ${d}/${t} หน้า`));
      // ชื่อไฟล์ภาษาอังกฤษ: Chrome บางรุ่นเปลี่ยนชื่อไฟล์ภาษาไทยเป็น "download"
      saveBlob(blob, `SOBPREP-${plan.slug}-${fmt}.pdf`);
      notify("โหลดแผนแล้ว ดูได้ในโฟลเดอร์ดาวน์โหลด");
    } catch (e) { notify(thaiError(e)); }
    setBusy("");
  };

  return (
    <div>
      <button className="pp-link" onClick={onBack}>‹ แผนทั้งหมด</button>
      <div className="lp-hero">
        <span className="pp-muted small">{plan.subject} {plan.course_code ? `(${plan.course_code}) ` : ""}{plan.grade} · หน่วยที่ {plan.unit_no} {plan.unit_title}</span>
        <h2>แผนที่ {plan.plan_no} {plan.title}</h2>
        <span className="pp-muted small">{plan.periods} คาบ · {plan.periods * plan.minutes} นาที</span>
      </div>

      <div className="lp-tabs" role="tablist" aria-label="รูปแบบแผน">
        {plan.formats.map(f => <button key={f.key} role="tab" aria-selected={f.key === fmt} className={f.key === fmt ? "on" : ""} onClick={() => pickFmt(f.key)}>{!plan.access && plan.owned.includes(f.key) ? "✓ " : ""}{f.name}</button>)}
      </div>
      {format && <p className="lp-desc"><b>{format.full}</b> · {format.desc}</p>}

      <div className="lp-opts">
        <label>ภาคเรียนที่
          <select className="pp-input" value={term} onChange={e => { setTerm(e.target.value); save("lp-term", e.target.value); }}>
            <option value="1">1</option><option value="2">2</option><option value="">เว้นว่าง</option>
          </select>
        </label>
        <label>ปีการศึกษา
          <input className="pp-input" inputMode="numeric" maxLength={4} value={year} onChange={e => { const v = e.target.value.replace(/\D/g, ""); setYear(v); save("lp-year", v); }} />
        </label>
        {plan.media_url && <a className="pp-btn pp-btn-outline" href={plan.media_url} target="_blank" rel="noopener noreferrer">สื่อออนไลน์ (ใบความรู้)</a>}
      </div>

      <div className={`lp-actions${owned && name ? " sticky" : ""}`}>
        {owned
          ? (name
              ? <>
                  <button className="pp-btn pp-btn-primary" disabled={!!busy || !nPages} onClick={download}>{busy || `ดาวน์โหลด PDF · ${format?.name ?? ""} (${nPages} หน้า)`}</button>
                  <span className="pp-muted small">ผู้สอน: <b>{name}</b> · ไฟล์ PDF สำหรับพิมพ์และยื่นสัมภาษณ์ได้ทันที{doc?.access === "pack" ? " · สิทธิ์จากแพ็กครบทุกภาค" : doc?.access === "purchase" ? ` · ซื้อรูปแบบ ${format?.name ?? ""} แล้ว` : ""}</span>
                </>
              : <NameForm onSaved={n => { setName(n); onChanged(); }} />)
          : <Unlock plan={plan} format={format} onBuyPack={onBuyPack} onChanged={onChanged} />}
      </div>
      {plan.access === "admin" && <Publish plan={plan} onChanged={onChanged} />}

      {err && <div className="pp-error">{err}</div>}
      {!doc && !err && <Skeleton kind="cards" n={1} />}
      <div ref={host} className="lp-pages" onContextMenu={e => e.preventDefault()} />
      {doc && !owned && (
        <div className="lp-pages" style={{ marginTop: 14 }}>
          <LockPage scale={scale} steps={format?.steps ?? []} blocks={doc.locked_blocks} />
        </div>
      )}
    </div>
  );
}

function LockPage({ scale, steps, blocks }: { scale: number; steps: Format["steps"]; blocks: number }) {
  const w = PAGE_W * scale, h = PAGE_H * scale;
  return (
    <div className="lp-lockpage" style={{ width: w, height: h }}>
      <div className="bars">{Array.from({ length: 34 }, (_, i) => <i key={i} style={{ width: `${55 + ((i * 37) % 45)}%` }} />)}</div>
      <div className="lp-lockcta">
        <span className="ico" aria-hidden>🔒</span>
        <b>ส่วนที่เหลือของแผน ({blocks} รายการ)</b>
        <span className="small">ขั้นการจัดการเรียนรู้ พร้อมแนวคำตอบ</span>
        <ol>{steps.map(s => <li key={s.name}>{s.name} · {s.minutes} นาที</li>)}</ol>
        <span className="small">+ สื่อ · การวัดผล · บันทึกหลังสอน · แบบประเมิน 3 ชุดพร้อม rubric · ใบงาน · การ์ดกิจกรรมและเฉลย</span>
      </div>
    </div>
  );
}

function NameForm({ onSaved }: { onSaved: (n: string) => void }) {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const n = v.trim().replace(/\s+/g, " ");
    if (!n || busy) return;
    if (!(await ask({ title: "ยืนยันชื่อ-สกุล", body: `"${n}" จะเป็นชื่อผู้สอนในทุกแผนที่โหลด และผูกกับบัญชีนี้ แก้เองภายหลังไม่ได้ (ถ้าพิมพ์ผิด ติดต่อทีมงานทาง LINE)`, ok: "ยืนยัน", cancel: "แก้ไข" }))) return;
    setBusy(true);
    try { onSaved(await rpc<string>("prep_set_full_name", { p_name: n })); }
    catch (e) { notify(thaiError(e)); }
    setBusy(false);
  };
  return (
    <>
      <b>กรอกชื่อ-สกุลผู้สอน (ครั้งเดียว)</b>
      <span className="pp-muted small">ใส่คำนำหน้าได้ เช่น นายสมชาย ใจดี · ชื่อนี้จะอยู่ในช่องผู้สอนและช่องลงชื่อของแผน</span>
      <div className="pp-row">
        <input className="pp-input" style={{ flex: 1 }} maxLength={80} placeholder="ชื่อ นามสกุล" value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submit(); }} />
        <button className="pp-btn pp-btn-primary" disabled={busy || !v.trim()} onClick={submit}>บันทึก</button>
      </div>
    </>
  );
}

function Publish({ plan, onChanged }: { plan: Plan; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    const on = !plan.published;
    if (!(await ask(on
      ? { title: "เผยแพร่แผนนี้?", body: "ลูกค้าทุกคนจะเห็นแผนนี้ในหน้าแผนสำเร็จรูป ดูตัวอย่างได้ และซื้อได้", ok: "เผยแพร่" }
      : { title: "ซ่อนแผนนี้?", body: "ลูกค้าจะไม่เห็นแผนนี้ (คนที่ซื้อแล้วก็โหลดไม่ได้จนกว่าจะเผยแพร่อีกครั้ง)", ok: "ซ่อน", danger: true }))) return;
    setBusy(true);
    try { await rpc("prep_admin_plan_publish", { p_id: plan.id, p_on: on }); notify(on ? "เผยแพร่แล้ว" : "ซ่อนแล้ว"); onChanged(); }
    catch (e) { notify(thaiError(e)); }
    setBusy(false);
  };
  return (
    <div className="pp-card lp-admin">
      <b>แอดมิน · {plan.published ? "เผยแพร่อยู่ ลูกค้าเห็นแล้ว" : "ยังไม่เผยแพร่ ลูกค้ายังไม่เห็น"}</b>
      <button className={`pp-btn ${plan.published ? "pp-btn-ghost" : "pp-btn-gold"}`} disabled={busy} onClick={toggle}>{plan.published ? "ซ่อนจากลูกค้า" : "ตรวจแล้ว เผยแพร่ให้ลูกค้าเห็น"}</button>
    </div>
  );
}

function Unlock({ plan, format, onBuyPack, onChanged }: { plan: Plan; format: Format | undefined; onBuyPack: () => void; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const qr = SHOP.qrByAmount[plan.price] || SHOP.qrImage;
  const fixed = !!SHOP.qrByAmount[plan.price];

  if (!format) return null;
  if (plan.pending.includes(format.key)) return (
    <>
      <b>ส่งสลิปซื้อแผนนี้ (รูปแบบ {format.name}) แล้ว · รอตรวจ</b>
      <span className="pp-muted small">ตรวจเสร็จแล้วปุ่มดาวน์โหลดจะขึ้นที่นี่ ส่วนใหญ่ไม่กี่นาที</span>
      <button className="pp-btn pp-btn-outline" onClick={onChanged}>ตรวจสถานะอีกครั้ง</button>
    </>
  );

  const send = async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) throw new Error("not_authenticated");
      const img = await shrink(file);
      const path = `${uid}/${crypto.randomUUID()}.${img.ext}`;
      const up = await supabase.storage.from("prep-slips").upload(path, img.blob, { contentType: img.type, upsert: false });
      if (up.error) throw up.error;
      await rpc("prep_submit_plan_order", { p_plan: plan.id, p_format: format.key, p_slip_path: path });
      notify("ส่งสลิปแล้ว ตรวจเสร็จจะเปิดให้โหลดแผนทันที");
      onChanged();
    } catch (e) { notify(thaiError(e)); }
    setBusy(false);
  };

  return (
    <div className="lp-buy">
      <b>ดูตัวอย่างได้ฟรี · ปลดล็อกเพื่อโหลดแผนเต็ม</b>
      <div className="lp-buy-opt">
        <b>แพ็กครบทุกภาค</b>
        <span className="pp-muted small">โหลดแผนสำเร็จรูปได้ทุกแผน ทุกรูปแบบ (PhenoBL · Active Learning · 5E) + ข้อสอบภาค ก ภาค ข และวิชาเอกครบ</span>
        <button className="pp-btn pp-btn-gold" onClick={onBuyPack}>ดูแพ็กครบทุกภาค</button>
      </div>
      <div className="lp-buy-opt">
        <b>ซื้อเฉพาะแผนนี้ รูปแบบ {format.name} · {plan.price} บาท</b>
        <span className="pp-muted small">ได้แผนรูปแบบ {format.name} ที่ดูตัวอย่างอยู่ โหลดซ้ำได้ (อยากได้รูปแบบอื่น เลือกที่ปุ่มด้านบนแล้วซื้อแยก)</span>
        {!open
          ? <button className="pp-btn pp-btn-primary" onClick={() => setOpen(true)}>ซื้อรูปแบบ {format.name} {plan.price} บาท</button>
          : (
            <div className="lp-qrpay">
              <img src={qr} alt={`QR พร้อมเพย์ ${plan.price} บาท`} />
              <span className="small">{fixed ? `สแกนจ่าย ${plan.price} บาท (ยอดล็อกใน QR แล้ว)` : `สแกนแล้วกรอกยอด ${plan.price} บาท`}</span>
              <span className="pp-muted small">{SHOP.bankText}</span>
              <a className="pp-btn pp-btn-outline" href={qr} download={`QR-แผน-${plan.price}.png`}>บันทึกรูป QR</a>
              <label className="pp-btn pp-btn-outline">
                {file ? "เปลี่ยนรูปสลิป" : "แนบสลิป"}
                <input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)); } }} />
              </label>
              {preview && <img className="lp-slip" src={preview} alt="สลิปที่เลือก" />}
              <button className="pp-btn pp-btn-primary" disabled={!file || busy} onClick={send}>{busy ? "กำลังส่ง..." : `ส่งสลิป · ${plan.price} บาท`}</button>
            </div>
          )}
      </div>
    </div>
  );
}
