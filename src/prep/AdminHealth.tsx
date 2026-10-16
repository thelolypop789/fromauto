import { useCallback, useEffect, useState } from "react";
import { rpc, thaiError } from "./api";

type DupItem = { id: number; origin: string; source: string | null; n: number };
type Health = {
  duplicates: { groups: number; extra_rows: number; list: { topic: string; stem: string; keep_id: number; items: DupItem[] }[] };
  similar_stems: { groups: number; list: { topic: string; stem: string; ids: number[] }[] };
  thin_topics: { code: string; name: string; section: "A" | "B"; grp: string; approved: number; review: number }[];
  mock_ready: { code: string; name: string; needed: number; available: number }[];
  majors_ready: { total: number; ready_100: number; empty: string[] };
  suspicious: { id: number; topic: string; stem: string; n: number; correct: number; pct: number }[];
  origins: { origin: string; n: number }[];
  sources: { source: string; origin: string; n: number }[];
};
const ORIGIN: Record<string, string> = { sheet: "นำเข้าจากไฟล์", ai: "AI", template: "สร้างด้วยโค้ด", manual: "พิมพ์เอง" };
const cut = (s: string, n = 90) => (s.length > n ? s.slice(0, n) + "…" : s);

// Where the question bank is weak: copies, thin topics, doubtful keys, and where the questions came from.
export default function AdminHealth() {
  const [h, setH] = useState<Health | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [all, setAll] = useState(false);
  const load = useCallback(() => { rpc<Health>("prep_admin_content_health").then(setH).catch(e => setError(thaiError(e))); }, []);
  useEffect(load, [load]);
  if (error) return <div className="pp-error">{error}</div>;
  if (!h) return <div className="pp-spinner" />;

  const hide = async (ids: number[], label: string) => {
    if (busy || ids.length === 0) return;
    if (!confirm(`ซ่อนสำเนา ${ids.length} ข้อ (${label})\nเก็บข้อที่มีคนทำมากที่สุดไว้ในแต่ละกลุ่ม\nซ่อนแล้วกลับมาเปิดได้ที่แท็บ คลังข้อสอบ`)) return;
    setBusy(true); setMsg(null);
    try {
      const r = await rpc<{ hidden: number }>("prep_admin_hide_duplicates", { p_ids: ids });
      setMsg({ ok: true, text: `ซ่อนสำเนาแล้ว ${r.hidden} ข้อ` }); load();
    } catch (e) { setMsg({ ok: false, text: e instanceof Error && e.message === "would_hide_all" ? "ซ่อนไม่ได้ เพราะจะไม่เหลือข้อที่เผยแพร่ในกลุ่มนั้น" : thaiError(e) }); }
    setBusy(false);
  };
  const extras = (g: Health["duplicates"]["list"][number]) => g.items.filter(i => i.id !== g.keep_id).map(i => i.id);
  const allExtras = h.duplicates.list.flatMap(extras);
  const shown = all ? h.duplicates.list : h.duplicates.list.slice(0, 8);
  const total = h.origins.reduce((s, o) => s + o.n, 0) || 1;
  const thinA = h.thin_topics.filter(t => t.section === "A" || t.grp !== "B3");

  return (
    <>
      {msg && <div className={msg.ok ? "pp-success" : "pp-error"}>{msg.text}</div>}

      <div className="pp-card">
        <h3>ข้อสอบซ้ำ</h3>
        {h.duplicates.groups === 0
          ? <p className="pp-muted">ไม่พบข้อซ้ำ 🎉</p>
          : <>
              <p>พบ <b>{h.duplicates.groups}</b> กลุ่ม (สำเนาที่เกิน {h.duplicates.extra_rows} ข้อ) <span className="pp-muted">โจทย์และตัวเลือกเหมือนกัน แค่สลับลำดับ ผู้ใช้อาจเจอข้อเดิมซ้ำในชุดเดียวกัน และจำนวนข้อที่นับสูงกว่าจริง</span></p>
              <button className="pp-btn pp-btn-primary" disabled={busy} onClick={() => hide(allExtras, "ทุกกลุ่ม")}>ซ่อนสำเนาทั้งหมด ({allExtras.length} ข้อ)</button>
              {shown.map((g, i) => (
                <div key={i} className="pp-keyrow">
                  <div>
                    <div className="small pp-muted">{g.topic}</div>
                    <div>{cut(g.stem)}</div>
                    <div className="small">{g.items.map(it => (
                      <span key={it.id} className={`pp-chip ${it.id === g.keep_id ? "ok" : ""}`}>#{it.id} {it.source ? cut(it.source, 22) : ORIGIN[it.origin]} · {it.n} คน{it.id === g.keep_id ? " · เก็บ" : ""}</span>
                    ))}</div>
                  </div>
                  <button className="pp-link small" disabled={busy} onClick={() => hide(extras(g), cut(g.stem, 30))}>ซ่อนสำเนา</button>
                </div>
              ))}
              {h.duplicates.list.length > 8 && <button className="pp-link small" onClick={() => setAll(!all)}>{all ? "แสดงน้อยลง" : `ดูทั้งหมด ${h.duplicates.list.length} กลุ่ม`}</button>}
            </>}
        {h.similar_stems.groups > 0 && (
          <details>
            <summary className="pp-muted small">โจทย์ถ้อยคำเดียวกันแต่ตัวเลือกต่างกัน {h.similar_stems.groups} กลุ่ม (ไม่ต้องซ่อน แต่ควรตรวจว่าไม่ซ้ำความหมาย)</summary>
            {h.similar_stems.list.map((s, i) => <div key={i} className="small">{s.topic} · {cut(s.stem, 70)} · #{s.ids.join(", #")}</div>)}
          </details>
        )}
      </div>

      <div className="pp-card">
        <h3>ความพร้อมจำลองสอบ</h3>
        {h.mock_ready.map(m => (
          <div key={m.code} className="pp-keyrow"><div>{m.name}</div><span className={`pp-chip ${m.available >= m.needed * 3 ? "ok" : m.available >= m.needed ? "warn" : ""}`}>{m.available.toLocaleString("th-TH")} / ต้อง {m.needed} ข้อ</span></div>
        ))}
        <p className="pp-muted small">เขียว = มีข้อมากกว่า 3 เท่าของที่ใช้สอบ (ชุดไม่ซ้ำกันบ่อย) เหลือง = พอสอบได้แต่ซ้ำบ่อย · วิชาเอกพร้อม (≥100 ข้อ) {h.majors_ready.ready_100} จาก {h.majors_ready.total} วิชา</p>
      </div>

      <div className="pp-card">
        <h3>หมวดที่ข้อน้อย (ต่ำกว่า 30 ข้อ)</h3>
        {thinA.length === 0 ? <p className="pp-muted">ไม่มี</p> : thinA.map(t => (
          <div key={t.code} className="pp-keyrow"><div>{t.name}{t.review > 0 ? <span className="pp-muted small"> · รอตรวจ {t.review}</span> : null}</div><span className={`pp-chip ${t.approved === 0 ? "bad" : "warn"}`}>{t.approved} ข้อ</span></div>
        ))}
        {h.majors_ready.empty.length > 0 && (
          <details>
            <summary className="pp-muted small">วิชาเอกที่ยังไม่มีข้อสอบ {h.majors_ready.empty.length} วิชา</summary>
            <div className="small">{h.majors_ready.empty.join(" · ")}</div>
          </details>
        )}
      </div>

      <div className="pp-card">
        <h3>ข้อที่น่าสงสัย</h3>
        <p className="pp-muted small">มีคนตอบตั้งแต่ 10 คน แล้วตอบถูกต่ำกว่า 20% (เฉลยอาจผิด) หรือสูงกว่า 95% (ง่ายเกินไป) แก้ได้ที่แท็บ คลังข้อสอบ</p>
        {h.suspicious.length === 0 ? <p className="pp-muted">ยังไม่มี (ต้องมีคนตอบข้อละ 10 คนขึ้นไปก่อน)</p> : h.suspicious.map(s => (
          <div key={s.id} className="pp-keyrow"><div><div className="small pp-muted">#{s.id} · {s.topic}</div><div>{cut(s.stem)}</div></div><span className={`pp-chip ${s.pct < 50 ? "bad" : "warn"}`}>ถูก {s.pct}% ({s.n} คน)</span></div>
        ))}
      </div>

      <div className="pp-card">
        <h3>ข้อสอบมาจากไหน</h3>
        {h.origins.map(o => (
          <div key={o.origin} className="pp-topic-bar">
            <div className="pp-topic-bar-h"><span>{ORIGIN[o.origin] ?? o.origin}</span><b>{o.n.toLocaleString("th-TH")} ข้อ · {Math.round((100 * o.n) / total)}%</b></div>
            <div className="pp-bar"><div style={{ width: `${(100 * o.n) / total}%` }} /></div>
          </div>
        ))}
        <p className="pp-note">ข้อที่นำเข้าจากไฟล์ของผู้อื่น (สื่อติว/ไฟล์รวมข้อสอบ) ควรตรวจสิทธิ์การใช้ก่อนนำไปขาย และอย่าโฆษณาว่าเรียบเรียงเอง</p>
        <details>
          <summary className="pp-muted small">แยกตามไฟล์ต้นทาง ({h.sources.length} รายการ)</summary>
          {h.sources.map((s, i) => <div key={i} className="pp-keyrow"><div className="small">{s.source}<span className="pp-muted"> · {ORIGIN[s.origin] ?? s.origin}</span></div><b className="small">{s.n.toLocaleString("th-TH")}</b></div>)}
        </details>
      </div>
    </>
  );
}
