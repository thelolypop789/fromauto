import { useEffect, useMemo, useState } from "react";
import { GROUPS, SECTIONS, rpc, thaiError, type Me, type Topic } from "./api";
import { IconCrown } from "./icons";

export type Preset = { section?: "A" | "B"; topics?: string[]; mode?: "new" | "weak" | "mixed" };
type Props = { me: Me; preset?: Preset; onCancel: () => void; onCreated: (setId: string) => void; onUpgrade: () => void };

const MODES = [
  { key: "new", label: "ข้อใหม่ก่อน", hint: "ดึงข้อที่ยังไม่เคยทำก่อน" },
  { key: "weak", label: "เน้นจุดอ่อน", hint: "ข้อที่เคยตอบผิดมาก่อน" },
  { key: "mixed", label: "สุ่มทั้งหมด", hint: "ผสมทุกข้อในหมวดที่เลือก" },
] as const;

export default function CreateSet({ me, preset, onCancel, onCreated, onUpgrade }: Props) {
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(preset?.topics ?? []));
  const [section, setSection] = useState<"A" | "B">(preset?.section ?? "A");
  const [size, setSize] = useState(Math.min(20, me.max_set_size));
  const [mode, setMode] = useState<"new" | "weak" | "mixed">(preset?.mode ?? "new");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    rpc<Topic[]>("prep_topics").then(t => {
      setTopics(t.filter(x => x.available > 0));
      // Preset topics decide the opening tab when no section was given.
      if (!preset?.section && preset?.topics?.length) {
        const first = t.find(x => x.code === preset.topics![0]);
        if (first) setSection(first.section);
      }
    }).catch(e => setError(thaiError(e)));
  }, [preset]);

  const groups = useMemo(() => {
    const g = new Map<string, Topic[]>();
    topics?.filter(t => t.section === section).forEach(t => g.set(t.grp, [...(g.get(t.grp) ?? []), t]));
    return [...g.entries()];
  }, [topics, section]);
  const sectionTopics = (sec: "A" | "B") => topics?.filter(t => t.section === sec) ?? [];
  const pickedIn = (sec: "A" | "B") => sectionTopics(sec).filter(t => picked.has(t.code)).length;
  const allSection = sectionTopics(section).length > 0 && sectionTopics(section).every(t => picked.has(t.code));

  const available = topics?.filter(t => picked.has(t.code)).reduce((s, t) => s + t.available, 0) ?? 0;
  const sizes = me.plan === "paid" ? [10, 20, 40, 60, 100, 150, 200] : [10, 20, 30, 40];
  const quotaLeft = me.free_sets_limit - me.free_sets_used;

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
        p_topics: [...picked], p_size: size, p_mode: mode, p_title: title.trim() || null,
      });
      onCreated(id);
    } catch (e) {
      setError(thaiError(e));
      setBusy(false);
    }
  };

  if (me.plan !== "paid" && quotaLeft <= 0) {
    return (
      <div className="pp-card pp-empty">
        <h3>ใช้ชุดฟรีครบ 3 ชุดแล้ว</h3>
        <p className="pp-muted">ชุดเดิมยังทำซ้ำได้ไม่จำกัด หรืออัปเกรดเพื่อสร้างชุดใหม่ได้ไม่จำกัด</p>
        <button className="pp-btn pp-btn-gold" onClick={onUpgrade}><IconCrown size={20} />ดูวิธีอัปเกรด</button>
      </div>
    );
  }

  return (
    <div className="pp-card pp-create">
      <h2>สร้างชุดฝึก</h2>
      {me.plan !== "paid" && <p className="pp-note">บัญชีฟรีสร้างได้อีก {quotaLeft} ชุด (ชุดละไม่เกิน {me.max_set_size} ข้อ) ทำซ้ำชุดเดิมได้ไม่จำกัด</p>}

      <h3><span className="pp-step">1</span>เลือกภาคและหมวด</h3>
      <div className="pp-sections" role="tablist">
        {(["A", "B"] as const).map(sec => (
          <button key={sec} role="tab" aria-selected={section === sec} className={section === sec ? "on" : ""} onClick={() => setSection(sec)}>
            <b>{SECTIONS[sec].short}</b>
            <span>{SECTIONS[sec].name}</span>
            {pickedIn(sec) > 0 && <em>เลือก {pickedIn(sec)}</em>}
          </button>
        ))}
      </div>
      {!topics && !error && <div className="pp-spinner" />}
      {topics && (
        <label className="pp-group-head pp-all">
          <input type="checkbox" checked={allSection} onChange={e => toggle(sectionTopics(section).map(t => t.code), e.target.checked)} />
          <b>เลือกทั้ง{SECTIONS[section].short}</b>
          <span className="pp-group-n">{sectionTopics(section).reduce((s, t) => s + t.available, 0)} ข้อ</span>
        </label>
      )}
      {groups.map(([grp, list]) => {
        const all = list.every(t => picked.has(t.code));
        return (
          <div key={grp} className="pp-group">
            <label className="pp-group-head">
              <input type="checkbox" checked={all} onChange={e => toggle(list.map(t => t.code), e.target.checked)} />
              <b>{GROUPS[grp] ?? grp}</b>
              <span className="pp-group-n">{list.reduce((s, t) => s + t.available, 0)} ข้อ</span>
            </label>
            <div className="pp-topic-list">
              {list.map(t => (
                <label key={t.code} className={`pp-topic ${picked.has(t.code) ? "on" : ""}`}>
                  <input type="checkbox" checked={picked.has(t.code)} onChange={e => toggle([t.code], e.target.checked)} />
                  {t.name} <span className="pp-muted">({t.available})</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}

      <h3><span className="pp-step">2</span>จำนวนข้อ</h3>
      <div className="pp-seg">
        {sizes.map(n => (
          <button key={n} className={size === n ? "on" : ""} onClick={() => setSize(n)}>{n}</button>
        ))}
      </div>
      {picked.size > 0 && available < size && <p className="pp-note">หมวดที่เลือกมี {available} ข้อ ชุดนี้จะได้ {available} ข้อ</p>}

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
            : <><b>{Math.min(size, available)} ข้อ</b> <span className="pp-muted">· {picked.size} หมวด{pickedIn("A") && pickedIn("B") ? " (ภาค ก+ข)" : ""}</span></>}
        </div>
        <button className="pp-btn pp-btn-ghost" onClick={onCancel}>ยกเลิก</button>
        <button className="pp-btn pp-btn-primary" disabled={busy || picked.size === 0 || available < 5} onClick={create}>
          {busy ? "กำลังจัดชุด..." : "สร้างและเริ่มทำ"}
        </button>
      </div>
    </div>
  );
}
