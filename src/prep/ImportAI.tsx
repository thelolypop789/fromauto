import { useRef, useState } from "react";
import { rpc, supabase, thaiError } from "./api";

type Draft = {
  topic: string; level: string; stem: string; choices: string[]; answer: number;
  explanation: string; law_ref: string | null; needs_review: boolean;
  keep: boolean; src: string;
};

type Chunk = { label: string; body: Record<string, unknown> };
type Mode = "generate" | "extract";

const LABELS = ["ก", "ข", "ค", "ง"];
const MAX_FILE = 25 * 1024 * 1024;

function splitText(text: string, size: number): string[] {
  const paras = text.split(/\n{1,}/).map(p => p.trim()).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length > size) { out.push(cur); cur = ""; }
    cur += (cur ? "\n" : "") + p;
    while (cur.length > size * 1.5) { out.push(cur.slice(0, size)); cur = cur.slice(size); }
  }
  if (cur.trim().length >= 50) out.push(cur);
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function buildChunks(file: File, pagesPer: number, charsPer: number, common: Record<string, unknown>): Promise<Chunk[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) {
    const { PDFDocument } = await import("pdf-lib");
    const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    const total = src.getPageCount();
    const chunks: Chunk[] = [];
    // The Edge Function rejects bodies over ~8 MB, so heavy (scanned) pages are split further.
    const addRange = async (from: number, to: number): Promise<void> => {
      const doc = await PDFDocument.create();
      const pages = await doc.copyPages(src, Array.from({ length: to - from }, (_, i) => from + i));
      pages.forEach(p => doc.addPage(p));
      const b64 = toBase64(await doc.save());
      if (b64.length > 6_500_000 && to - from > 1) {
        const mid = from + Math.ceil((to - from) / 2);
        await addRange(from, mid);
        await addRange(mid, to);
        return;
      }
      const label = from + 1 === to ? `หน้า ${to}` : `หน้า ${from + 1}–${to}`;
      chunks.push({ label, body: { ...common, kind: "pdf", pdf_base64: b64, pages: label } });
    };
    for (let from = 0; from < total; from += pagesPer) await addRange(from, Math.min(from + pagesPer, total));
    return chunks;
  }
  let text: string;
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    text = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  } else {
    text = await file.text();
  }
  return splitText(text, charsPer).map((t, i, all) => ({ label: `ส่วน ${i + 1}/${all.length}`, body: { ...common, kind: "text", text: t } }));
}

async function callImport(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("prep-import", { body });
  if (error) {
    let msg = error.message;
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error; } catch { /* keep generic */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data as { items: Omit<Draft, "keep" | "src">[]; dropped: string[]; model: string; truncated: boolean; usage: { promptTokenCount?: number; candidatesTokenCount?: number } | null };
}

export default function ImportAI() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>("generate");
  const [count, setCount] = useState(15);
  const [pagesPer, setPagesPer] = useState(4);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [tokens, setTokens] = useState({ inp: 0, out: 0 });
  const [saving, setSaving] = useState(false);
  const cancel = useRef(false);
  const say = (m: string) => setLog(l => [...l, m]);

  const isPdf = !!file?.name.toLowerCase().endsWith(".pdf");

  const run = async () => {
    if (!file || busy) return;
    if (file.size > MAX_FILE) { alert("ไฟล์ใหญ่เกิน 25 MB"); return; }
    cancel.current = false;
    setBusy(true); setLog([]); setDrafts([]); setTokens({ inp: 0, out: 0 }); setProgress(null);
    const seen = new Set<string>();
    try {
      say("กำลังเตรียมไฟล์...");
      const chunks = await buildChunks(file, pagesPer, 6000, { mode, count, hint });
      if (!chunks.length) { say("ไม่พบเนื้อหาที่อ่านได้ในไฟล์"); setBusy(false); return; }
      say(`แบ่งเป็น ${chunks.length} ช่วง`);
      setProgress({ done: 0, total: chunks.length });
      for (let i = 0; i < chunks.length; i++) {
        if (cancel.current) { say("หยุดตามคำสั่ง"); break; }
        const c = chunks[i];
        try {
          const r = await callImport(c.body);
          const fresh = r.items.filter(q => {
            const k = q.stem.replace(/\s/g, "");
            if (seen.has(k)) return false;
            seen.add(k); return true;
          });
          setDrafts(d => [...d, ...fresh.map(q => ({ ...q, keep: true, src: c.label }))]);
          setTokens(t => ({ inp: t.inp + (r.usage?.promptTokenCount ?? 0), out: t.out + (r.usage?.candidatesTokenCount ?? 0) }));
          say(`${c.label}: ได้ ${fresh.length} ข้อ${r.dropped.length ? ` (ตัดทิ้ง ${r.dropped.length})` : ""}${r.truncated ? " ⚠ ผลลัพธ์ถูกตัดกลางทาง ลองลดจำนวนข้อ/หน้าต่อช่วง" : ""}`);
        } catch (e) {
          say(`${c.label}: ผิดพลาด — ${thaiError(e)}`);
        }
        setProgress({ done: i + 1, total: chunks.length });
      }
    } catch (e) {
      say("อ่านไฟล์ไม่ได้: " + thaiError(e));
    }
    setBusy(false);
  };

  const kept = drafts.filter(d => d.keep);

  const save = async () => {
    if (!kept.length || saving) return;
    setSaving(true);
    let ins = 0, skip = 0, bad = 0;
    try {
      for (let i = 0; i < kept.length; i += 100) {
        const items = kept.slice(i, i + 100).map(({ keep: _k, src: _s, needs_review: _n, ...q }) => ({ ...q, status: "review" }));
        const r = await rpc<{ inserted: number; skipped: number; invalid: number }>("prep_admin_import", {
          p_items: items, p_source: file?.name ?? "import", p_origin: mode === "extract" ? "sheet" : "ai",
        });
        ins += r.inserted; skip += r.skipped; bad += r.invalid;
      }
      say(`บันทึกแล้ว: เพิ่ม ${ins} · ซ้ำกับในคลัง ${skip} · ไม่ถูกรูปแบบ ${bad} → ไปแท็บ "ตรวจข้อสอบ" เพื่ออนุมัติ`);
      setDrafts([]);
    } catch (e) {
      say("บันทึกไม่สำเร็จ: " + thaiError(e));
    }
    setSaving(false);
  };

  const edit = (i: number, patch: Partial<Draft>) => setDrafts(d => d.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  return (
    <>
      <div className="pp-card">
        <h3>นำเข้าด้วย AI (Gemini)</h3>
        <p className="pp-muted small">อัปโหลดไฟล์ .docx .pdf .txt → AI สร้าง/คัดข้อสอบเป็น "ร่าง" → ตรวจ → บันทึกเข้าคิว "ตรวจข้อสอบ" (ไม่เผยแพร่ทันที)</p>
        <input type="file" accept=".docx,.pdf,.txt" disabled={busy} onChange={e => { setFile(e.target.files?.[0] ?? null); setDrafts([]); setLog([]); }} />
        {file && <p className="small">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}

        <div className="pp-seg" style={{ marginTop: 10 }}>
          <button className={mode === "generate" ? "on" : ""} onClick={() => setMode("generate")} disabled={busy}>ชีทสรุป → แต่งข้อสอบ</button>
          <button className={mode === "extract" ? "on" : ""} onClick={() => setMode("extract")} disabled={busy}>เป็นข้อสอบอยู่แล้ว → คัดข้อ</button>
        </div>
        <div className="pp-row">
          <label className="small" style={{ flex: 1 }}>ข้อต่อช่วง (สูงสุด 40)
            <input className="pp-input" type="number" min={1} max={40} value={count} disabled={busy} onChange={e => setCount(Number(e.target.value) || 15)} />
          </label>
          {isPdf && (
            <label className="small" style={{ flex: 1 }}>หน้าต่อช่วง
              <input className="pp-input" type="number" min={1} max={20} value={pagesPer} disabled={busy} onChange={e => setPagesPer(Number(e.target.value) || 4)} />
            </label>
          )}
        </div>
        <input className="pp-input" placeholder="คำแนะนำเพิ่มเติม (ไม่บังคับ) เช่น เน้นมาตราและบทลงโทษ" value={hint} disabled={busy} onChange={e => setHint(e.target.value)} />

        <div className="pp-row">
          {busy
            ? <button className="pp-btn pp-btn-ghost" onClick={() => { cancel.current = true; }}>หยุด</button>
            : <button className="pp-btn pp-btn-primary" disabled={!file} onClick={run}>เริ่มให้ AI อ่าน</button>}
        </div>

        {progress && (
          <>
            <div className="pp-bar"><div style={{ width: `${(100 * progress.done) / progress.total}%` }} /></div>
            <p className="pp-muted small">
              ช่วงที่ {progress.done}/{progress.total} · ใช้ token แล้ว {tokens.inp.toLocaleString()} เข้า / {tokens.out.toLocaleString()} ออก
            </p>
          </>
        )}
        {log.map((l, i) => <div key={i} className="pp-muted small">{l}</div>)}
      </div>

      {drafts.length > 0 && (
        <>
          <div className="pp-card">
            <b>ร่างที่ได้ {drafts.length} ข้อ · เลือกไว้ {kept.length}</b>
            <p className="pp-muted small">ติ๊กออกข้อที่ไม่เอา แก้เฉลยได้ในแท็บ "ตรวจข้อสอบ" หลังบันทึก ข้อที่ซ้ำกับคลังจะถูกข้ามอัตโนมัติ</p>
            <div className="pp-row">
              <button className="pp-btn pp-btn-ghost" onClick={() => setDrafts(d => d.map(x => ({ ...x, keep: true })))}>เลือกทั้งหมด</button>
              <button className="pp-btn pp-btn-ghost" onClick={() => setDrafts(d => d.map(x => ({ ...x, keep: !x.needs_review })))}>ไม่เอาข้อที่ AI ติดธง</button>
              <button className="pp-btn pp-btn-primary" disabled={!kept.length || saving} onClick={save}>{saving ? "กำลังบันทึก..." : `บันทึก ${kept.length} ข้อ`}</button>
            </div>
          </div>
          {drafts.map((d, i) => (
            <div key={i} className={`pp-card pp-draft ${d.keep ? "" : "off"}`}>
              <label className="pp-group-head">
                <input type="checkbox" checked={d.keep} onChange={e => edit(i, { keep: e.target.checked })} />
                <span className="pp-muted small">{d.topic} · {d.level} · {d.src}{d.needs_review ? " · ⚑ ควรตรวจ" : ""}</span>
              </label>
              <div className="pp-q-stem" style={{ fontSize: 16 }}>{d.stem}</div>
              {d.choices.map((c, k) => (
                <div key={k} className={`pp-draft-choice ${k === d.answer ? "right" : ""}`}>{LABELS[k]}. {c}</div>
              ))}
              {d.explanation && <p className="pp-muted small">💡 {d.explanation}</p>}
              {d.law_ref && <p className="pp-muted small">อ้างอิง: {d.law_ref}</p>}
            </div>
          ))}
        </>
      )}
    </>
  );
}
