import { useEffect, useMemo, useState } from "react";
import { GROUPS, rpc, thaiError, type Me, type Topic } from "./api";

type Props = { me: Me; onCancel: () => void; onCreated: (setId: string) => void; onUpgrade: () => void };

const MODES = [
  { key: "new", label: "ข้อใหม่ก่อน", hint: "ดึงข้อที่ยังไม่เคยทำก่อน" },
  { key: "weak", label: "เน้นจุดอ่อน", hint: "ข้อที่เคยตอบผิดมาก่อน" },
  { key: "mixed", label: "สุ่มทั้งหมด", hint: "ผสมทุกข้อในหมวดที่เลือก" },
] as const;

export default function CreateSet({ me, onCancel, onCreated, onUpgrade }: Props) {
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [size, setSize] = useState(Math.min(20, me.max_set_size));
  const [mode, setMode] = useState<"new" | "weak" | "mixed">("new");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    rpc<Topic[]>("prep_topics").then(t => setTopics(t.filter(x => x.available > 0))).catch(e => setError(thaiError(e)));
  }, []);

  const groups = useMemo(() => {
    const g = new Map<string, Topic[]>();
    topics?.forEach(t => g.set(t.grp, [...(g.get(t.grp) ?? []), t]));
    return [...g.entries()];
  }, [topics]);

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
        <button className="pp-btn pp-btn-gold" onClick={onUpgrade}>ดูวิธีอัปเกรด</button>
      </div>
    );
  }

  return (
    <div className="pp-card">
      <h2>สร้างชุดฝึก</h2>
      {me.plan !== "paid" && <p className="pp-note">บัญชีฟรีสร้างได้อีก {quotaLeft} ชุด (ชุดละไม่เกิน {me.max_set_size} ข้อ) ทำซ้ำชุดเดิมได้ไม่จำกัด</p>}

      <h3>1. เลือกหมวด</h3>
      {!topics && !error && <div className="pp-spinner" />}
      {groups.map(([grp, list]) => {
        const all = list.every(t => picked.has(t.code));
        return (
          <div key={grp} className="pp-group">
            <label className="pp-group-head">
              <input type="checkbox" checked={all} onChange={e => toggle(list.map(t => t.code), e.target.checked)} />
              <b>{GROUPS[grp] ?? grp}</b>
              <span className="pp-muted"> · {list.reduce((s, t) => s + t.available, 0)} ข้อ</span>
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

      <h3>2. จำนวนข้อ</h3>
      <div className="pp-seg">
        {sizes.map(n => (
          <button key={n} className={size === n ? "on" : ""} onClick={() => setSize(n)}>{n}</button>
        ))}
      </div>
      {picked.size > 0 && available < size && <p className="pp-note">หมวดที่เลือกมี {available} ข้อ ชุดนี้จะได้ {available} ข้อ</p>}

      <h3>3. แบบการจัดข้อ</h3>
      <div className="pp-modes">
        {MODES.map(m => (
          <button key={m.key} className={mode === m.key ? "on" : ""} onClick={() => setMode(m.key)}>
            <b>{m.label}</b><span>{m.hint}</span>
          </button>
        ))}
      </div>

      <h3>4. ชื่อชุด (ไม่บังคับ)</h3>
      <input className="pp-input" maxLength={80} placeholder="เช่น ภาค ก ข้าราชการที่ดี รอบ 1" value={title} onChange={e => setTitle(e.target.value)} />

      {error && <div className="pp-error">{error}</div>}
      <div className="pp-row">
        <button className="pp-btn pp-btn-ghost" onClick={onCancel}>ยกเลิก</button>
        <button className="pp-btn pp-btn-primary" disabled={busy || picked.size === 0 || available < 5} onClick={create}>
          {busy ? "กำลังจัดชุด..." : "สร้างและเริ่มทำ"}
        </button>
      </div>
    </div>
  );
}
