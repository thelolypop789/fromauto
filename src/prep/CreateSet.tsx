import { useEffect, useMemo, useState } from "react";
import { GROUPS, PACKAGE_LABEL, SECTIONS, covers, rpc, thaiError, track, type Me, type Quote, type Subtopic, type Topic } from "./api";
import FreeWall from "./FreeWall";
import Skeleton from "./Skeleton";

export type Preset = { section?: "A" | "B"; topics?: string[]; subtopics?: string[]; mode?: "new" | "weak" | "mixed" };
type Props = { me: Me; major?: string | null; preset?: Preset; onCancel: () => void; onCreated: (setId: string) => void; onUpgrade: () => void };

const MODES = [
  { key: "new", label: "ข้อใหม่ก่อน", hint: "ดึงข้อที่ยังไม่เคยทำก่อน" },
  { key: "weak", label: "เน้นจุดอ่อน", hint: "ข้อที่เคยตอบผิดมาก่อน" },
  { key: "mixed", label: "สุ่มทั้งหมด", hint: "ผสมทุกข้อในหมวดที่เลือก" },
] as const;

export default function CreateSet({ me, major = null, preset, onCancel, onCreated, onUpgrade }: Props) {
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(preset?.topics ?? []));
  const [section, setSection] = useState<"A" | "B">(preset?.section ?? "A");
  const [size, setSize] = useState(Math.min(20, me.max_set_size));
  const [mode, setMode] = useState<"new" | "weak" | "mixed">(preset?.mode ?? "new");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [offer, setOffer] = useState("");
  // Majors can be narrowed to some of their sub-topics (none chosen = the whole major).
  const [subs, setSubs] = useState<Record<string, Subtopic[]>>({});
  const [pickedSubs, setPickedSubs] = useState<Set<string>>(() => new Set(preset?.subtopics ?? []));

  useEffect(() => {
    rpc<Topic[]>("prep_topics").then(t => {
      setTopics(t);
      // Preset topics decide the opening tab when no section was given.
      if (!preset?.section && preset?.topics?.length) {
        const first = t.find(x => x.code === preset.topics![0]);
        if (first) setSection(first.section);
      }
    }).catch(e => setError(thaiError(e)));
  }, [preset]);

  const pickedMajors = useMemo(() => topics?.filter(t => t.grp === "B3" && picked.has(t.code)).map(t => t.code) ?? [], [topics, picked]);
  useEffect(() => {
    pickedMajors.filter(c => !(c in subs)).forEach(c => {
      rpc<Subtopic[]>("prep_subtopics", { p_topic: c }).then(l => setSubs(m => ({ ...m, [c]: l }))).catch(() => setSubs(m => ({ ...m, [c]: [] })));
    });
  }, [pickedMajors, subs]);
  const subsOf = (code: string) => (subs[code] ?? []).filter(s => s.available > 0);
  const chosenIn = (code: string) => subsOf(code).filter(s => pickedSubs.has(s.code));
  const availableOf = (t: Topic) => { const c = chosenIn(t.code); return c.length ? c.reduce((n, s) => n + s.available, 0) : t.available; };

  const groups = useMemo(() => {
    const g = new Map<string, Topic[]>();
    topics?.filter(t => t.section === section).forEach(t => g.set(t.grp, [...(g.get(t.grp) ?? []), t]));
    // The user's own major goes first in วิชาเอก.
    const b3 = g.get("B3");
    if (b3 && major) g.set("B3", [...b3.filter(t => t.code === major), ...b3.filter(t => t.code !== major)]);
    // Topics with questions come first; empty ones are shown greyed as coming soon.
    return [...g.entries()].map(([k, l]) => [k, [...l].sort((a, b) => Number(b.available > 0) - Number(a.available > 0))] as [string, Topic[]]);
  }, [topics, section, major]);
  const sectionTopics = (sec: "A" | "B") => topics?.filter(t => t.section === sec) ?? [];
  const pickedIn = (sec: "A" | "B") => sectionTopics(sec).filter(t => picked.has(t.code)).length;
  // "Select all" boxes take only the user's own major from วิชาเอก; other majors are ticked one by one.
  const bulk = (list: Topic[]) => list.filter(t => t.available > 0 && (t.grp !== "B3" || t.code === major));
  const sectionBulk = bulk(sectionTopics(section));
  const allSection = sectionBulk.length > 0 && sectionBulk.every(t => picked.has(t.code));

  const available = topics?.filter(t => picked.has(t.code)).reduce((s, t) => s + availableOf(t), 0) ?? 0;
  // Sets whose topics are all inside the user's packages are unlimited (up to 200); others use the free quota.
  const pickedSections = [...new Set(topics?.filter(t => picked.has(t.code)).map(t => t.section) ?? [])];
  const covered = covers(me, pickedSections);
  const owned = (me.packages ?? []).map(p => p.package);
  const sizes = covered ? [10, 20, 40, 60, 100, 150, 200] : [10, 20, 30, 40];
  const quotaLeft = me.free_sets_limit - me.free_sets_used;
  const finalSize = covered ? size : Math.min(size, 40);
  const blocked = picked.size > 0 && !covered && quotaLeft <= 0;
  useEffect(() => {
    if (!blocked) return;
    rpc<Quote[]>("prep_quotes").then(qs => {
      const u = qs.find(x => x.package === "ALL" && x.term === "lifetime" && x.kind === "upgrade" && !x.error && x.amount);
      setOffer(u ? `อัปเกรดเป็นครบทุกภาค จ่ายแค่ ${u.amount} บาท (หักแพ็กที่มีอยู่แล้ว)` : "");
    }).catch(() => { /* hint only */ });
  }, [blocked]);

  const hitLimit = me.plan !== "paid" && quotaLeft <= 0;
  useEffect(() => { if (hitLimit) track("free_limit"); }, [hitLimit]);

  const toggle = (codes: string[], on: boolean) => {
    const next = new Set(picked);
    codes.forEach(c => (on ? next.add(c) : next.delete(c)));
    setPicked(next);
  };

  const create = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const id = await rpc<string>("prep_create_set", {
        p_topics: [...picked], p_size: finalSize, p_mode: mode, p_title: title.trim() || null,
        p_subtopics: pickedMajors.flatMap(c => chosenIn(c).map(s => s.code)).length ? pickedMajors.flatMap(c => chosenIn(c).map(s => s.code)) : null,
      });
      if (pickedMajors.some(c => chosenIn(c).length)) track("subtopic_pick");
      onCreated(id);
    } catch (e) {
      setError(thaiError(e));
      setBusy(false);
    }
  };

  if (me.plan !== "paid" && quotaLeft <= 0) return <FreeWall />;

  return (
    <div className="pp-card pp-create">
      <h2>สร้างชุดฝึก</h2>
      {owned.length > 0
        ? <p className="pp-note">แพ็กของคุณ: <b>{owned.map(k => PACKAGE_LABEL[k]).join(", ")}</b> · ชุดที่มีเฉพาะหมวดในแพ็กสร้างได้ไม่จำกัด (ชุดละสูงสุด 200 ข้อ){owned.includes("ALL") ? "" : ` · หมวดนอกแพ็กใช้สิทธิ์ฟรีอีก ${Math.max(0, quotaLeft)} ชุด`}</p>
        : <p className="pp-note">บัญชีฟรีสร้างได้อีก {quotaLeft} ชุด (ชุดละไม่เกิน 40 ข้อ) ทำซ้ำชุดเดิมได้ไม่จำกัด</p>}

      <h3><span className="pp-step">1</span>เลือกภาคและหมวด</h3>
      <div className="pp-sections" role="tablist">
        {(["A", "B"] as const).map(sec => (
          <button key={sec} role="tab" aria-selected={section === sec} className={section === sec ? "on" : ""} onClick={() => setSection(sec)}>
            <b>{SECTIONS[sec].short}</b>
            <span>{SECTIONS[sec].name}</span>
            {pickedIn(sec) > 0 ? <em>เลือก {pickedIn(sec)}</em> : covers(me, [sec]) ? <em>ในแพ็ก</em> : null}
          </button>
        ))}
      </div>
      {!topics && !error && <Skeleton kind="list" n={4} />}
      {topics && (
        <label className="pp-group-head pp-all">
          <input type="checkbox" checked={allSection} disabled={sectionBulk.length === 0} onChange={e => toggle(sectionBulk.map(t => t.code), e.target.checked)} />
          <b>เลือกทั้ง{SECTIONS[section].short}</b>
          {sectionTopics(section).some(t => t.grp === "B3") && <span className="pp-muted small">{major ? "(วิชาเอกเฉพาะของฉัน)" : "(ไม่รวมวิชาเอก)"}</span>}
          <span className="pp-group-n">{sectionBulk.reduce((s, t) => s + t.available, 0)} ข้อ</span>
        </label>
      )}
      {groups.map(([grp, list]) => {
        const open = bulk(list);
        const all = open.length > 0 && open.every(t => picked.has(t.code));
        return (
          <div key={grp} className="pp-group">
            <label className="pp-group-head">
              <input type="checkbox" checked={all} disabled={open.length === 0} onChange={e => toggle(open.map(t => t.code), e.target.checked)} />
              <b>{GROUPS[grp] ?? grp}</b>
              <span className="pp-group-n">{list.reduce((s, t) => s + t.available, 0)} ข้อ</span>
            </label>
            <div className="pp-topic-list">
              {list.map(t => (
                <label key={t.code} className={`pp-topic ${picked.has(t.code) ? "on" : ""} ${t.available === 0 ? "soon" : ""}`}>
                  <input type="checkbox" checked={picked.has(t.code)} disabled={t.available === 0} onChange={e => toggle([t.code], e.target.checked)} />
                  {t.name} {t.available > 0 ? <span className="pp-muted">({t.available})</span> : <span className="pp-soon">กำลังเพิ่มข้อสอบ</span>}{t.code === major && <span className="pp-mine">วิชาเอกของฉัน</span>}
                </label>
              ))}
              {list.filter(t => picked.has(t.code) && subsOf(t.code).length > 0).map(t => (
                <div key={`${t.code}-subs`} className="pp-subpick">
                  <span className="small"><b>หมวดย่อย{t.name}</b> <span className="pp-muted">(ไม่เลือก = ทั้งวิชา)</span></span>
                  <div className="pp-subpick-list">
                    {subsOf(t.code).map(s => (
                      <button key={s.code} className={`pp-chip-btn ${pickedSubs.has(s.code) ? "on" : ""}`}
                        onClick={() => { const n = new Set(pickedSubs); if (n.has(s.code)) n.delete(s.code); else n.add(s.code); setPickedSubs(n); }}>
                        {s.name} <span className="pp-muted">{s.available}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <h3><span className="pp-step">2</span>จำนวนข้อ</h3>
      <div className="pp-seg">
        {sizes.map(n => (
          <button key={n} className={finalSize === n ? "on" : ""} onClick={() => setSize(n)}>{n}</button>
        ))}
      </div>
      {picked.size > 0 && available < finalSize && <p className="pp-note">หมวดที่เลือกมี {available} ข้อ ชุดนี้จะได้ {available} ข้อ</p>}
      {blocked && (
        <div className="pp-error">หมวดที่เลือกอยู่นอกแพ็กของคุณ และใช้สิทธิ์ฟรีครบแล้ว — เลือกเฉพาะหมวดในแพ็ก หรือ {offer && <b>{offer} · </b>}<button className="pp-link" onClick={onUpgrade}>ซื้อแพ็กเพิ่ม</button></div>
      )}

      <h3><span className="pp-step">3</span>แบบการจัดข้อ</h3>
      <div className="pp-modes">
        {MODES.map(m => (
          <button key={m.key} className={mode === m.key ? "on" : ""} onClick={() => setMode(m.key)}>
            <b>{m.label}</b><span>{m.hint}</span>
          </button>
        ))}
      </div>

      <h3><span className="pp-step">4</span>ชื่อชุด <span className="pp-muted small">(ไม่บังคับ)</span></h3>
      <input className="pp-input" maxLength={80} placeholder="เช่น ภาค ก ข้าราชการที่ดี รอบ 1" value={title} onChange={e => setTitle(e.target.value)} />

      {error && <div className="pp-error">{error}</div>}
      <div className="pp-sticky">
        <div className="pp-sticky-sum">
          {picked.size === 0 ? <span className="pp-muted">เลือกอย่างน้อย 1 หมวด</span>
            : <><b>{Math.min(finalSize, available)} ข้อ</b> <span className="pp-muted">· {picked.size} หมวด{pickedIn("A") && pickedIn("B") ? " (ภาค ก+ข)" : ""}</span></>}
        </div>
        <button className="pp-btn pp-btn-ghost" onClick={onCancel}>ยกเลิก</button>
        <button className="pp-btn pp-btn-primary" disabled={busy || picked.size === 0 || available < 5 || blocked} onClick={create}>
          {busy ? "กำลังจัดชุด..." : "สร้างและเริ่มทำ"}
        </button>
      </div>
    </div>
  );
}
