import { useRef, useState } from "react";
import { rpc, supabase, thaiError } from "./api";

type Draft = {
  topic: string; level: string; stem: string; choices: string[]; answer: number;
  explanation: string; law_ref: string | null; needs_review: boolean;
  keep: boolean; src: string; file: string;
};

type Chunk = { label: string; body: Record<string, unknown> };
type Mode = "generate" | "extract";
type Quality = "best" | "balanced" | "fast";
type Media = { mimeType: string; data: string; label?: string };

const LABELS = ["ก", "ข", "ค", "ง"];
const MAX_FILE = 40 * 1024 * 1024;
const MAX_CHUNK_B64 = 6_000_000;    // the Edge Function rejects bodies over ~9 MB
const TEXT_CHUNK = 25_000;
const IMG_MAX_SIDE = 2400;
const ACCEPT = ".pdf,.docx,.doc,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,.heic,.heif,.gif,.bmp";
const QUALITY: [Quality, string, string][] = [
  ["best", "ละเอียดสุด", "Gemini Pro · อ่านสแกน/รูปแม่นที่สุด"],
  ["balanced", "สมดุล", "Gemini Flash"],
  ["fast", "ประหยัด", "Flash-Lite · เร็วและถูก"],
];

type Kind = "pdf" | "docx" | "doc" | "text" | "image" | "unknown";
function kindOf(f: File): Kind {
  const n = f.name.toLowerCase();
  if (n.endsWith(".pdf") || f.type === "application/pdf") return "pdf";
  if (n.endsWith(".docx")) return "docx";
  if (n.endsWith(".doc")) return "doc";
  if (/\.(txt|md|csv)$/.test(n) || f.type.startsWith("text/")) return "text";
  if (/\.(png|jpe?g|webp|heic|heif|gif|bmp)$/.test(n) || f.type.startsWith("image/")) return "image";
  return "unknown";
}

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

// Downscale + re-encode images as JPEG so photos of exam pages stay small but readable.
// Formats the browser cannot decode (HEIC outside Safari) are sent as-is; Gemini reads them.
async function prepareImage(blob: Blob, mimeHint: string): Promise<Media | null> {
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, IMG_MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const url = canvas.toDataURL("image/jpeg", 0.88);
    return { mimeType: "image/jpeg", data: url.slice(url.indexOf(",") + 1) };
  } catch {
    const mime = /heic|heif/.test(mimeHint) ? mimeHint : "";
    if (!mime || blob.size > 4.5 * 1024 * 1024) return null;
    return { mimeType: mime, data: toBase64(new Uint8Array(await blob.arrayBuffer())) };
  }
}

// Word → text that keeps paragraphs, lists and tables ("a | b | c"), plus its pictures in order.
async function readDocx(file: File): Promise<{ text: string; images: (Media | null)[] }> {
  const mammoth = await import("mammoth");
  const raw: { type: string; b64: string }[] = [];
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, {
    convertImage: mammoth.images.imgElement(async img => {
      raw.push({ type: img.contentType, b64: await img.read("base64") });
      return { src: `pp-img:${raw.length}` };
    }),
  });
  const images = await Promise.all(raw.map(async r => {
    if (!/^image\/(png|jpe?g|gif|bmp|webp)$/.test(r.type)) return null;   // EMF/WMF drawings cannot be read
    const bytes = Uint8Array.from(atob(r.b64), c => c.charCodeAt(0));
    return prepareImage(new Blob([bytes], { type: r.type }), r.type);
  }));
  const doc = new DOMParser().parseFromString(html, "text/html");
  const lines: string[] = [];
  const inline = (el: Element): string => [...el.childNodes].map(n => {
    if (n.nodeType === Node.TEXT_NODE) return n.textContent ?? "";
    const e = n as Element;
    if (e.tagName === "IMG") {
      const k = Number(e.getAttribute("src")?.split(":")[1]);
      return images[k - 1] ? ` [รูปที่ ${k}] ` : ` [รูปที่ ${k}: อ่านไม่ได้] `;
    }
    if (e.tagName === "BR") return "\n";
    return inline(e);
  }).join("");
  const walk = (el: Element) => {
    for (const c of [...el.children]) {
      if (c.tagName === "TABLE") {
        lines.push("[ตาราง]");
        c.querySelectorAll("tr").forEach(tr => lines.push("| " + [...tr.children].map(td => inline(td).replace(/\s+/g, " ").trim()).join(" | ") + " |"));
        lines.push("[จบตาราง]");
      } else if (/^(P|H[1-6]|LI)$/.test(c.tagName)) {
        const t = inline(c).trim();
        if (t) lines.push((c.tagName === "LI" ? "- " : "") + t);
      } else walk(c);
    }
  };
  walk(doc.body);
  return { text: lines.join("\n"), images };
}

async function buildChunks(file: File, opts: { pagesPer: number; imagesPer: number }, common: Record<string, unknown>, images?: Media[]): Promise<Chunk[]> {
  const kind = kindOf(file);
  if (kind === "pdf") {
    const { PDFDocument } = await import("pdf-lib");
    const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    const total = src.getPageCount();
    const chunks: Chunk[] = [];
    // Heavy (scanned) page ranges are split further to stay under the request limit.
    const addRange = async (from: number, to: number): Promise<void> => {
      const doc = await PDFDocument.create();
      const pages = await doc.copyPages(src, Array.from({ length: to - from }, (_, i) => from + i));
      pages.forEach(p => doc.addPage(p));
      const b64 = toBase64(await doc.save());
      if (b64.length > MAX_CHUNK_B64 && to - from > 1) {
        const mid = from + Math.ceil((to - from) / 2);
        await addRange(from, mid);
        await addRange(mid, to);
        return;
      }
      const label = from + 1 === to ? `หน้า ${to}` : `หน้า ${from + 1}–${to}`;
      chunks.push({ label, body: { ...common, kind: "pdf", pdf_base64: b64, pages: label } });
    };
    for (let from = 0; from < total; from += opts.pagesPer) await addRange(from, Math.min(from + opts.pagesPer, total));
    return chunks;
  }
  if (kind === "image") {
    // Images are grouped by the caller (several photos = one exam); here we pack them into requests.
    const list = images ?? [];
    const chunks: Chunk[] = [];
    let cur: Media[] = [], size = 0;
    const flush = () => {
      if (!cur.length) return;
      const label = cur.length === 1 ? cur[0].label! : `${cur[0].label} – ${cur[cur.length - 1].label}`;
      chunks.push({ label, body: { ...common, kind: "media", files: cur, pages: label } });
      cur = []; size = 0;
    };
    for (const m of list) {
      if (cur.length >= opts.imagesPer || size + m.data.length > MAX_CHUNK_B64) flush();
      cur.push(m); size += m.data.length;
    }
    flush();
    return chunks;
  }
  if (kind === "docx") {
    const { text, images: pics } = await readDocx(file);
    const parts = splitText(text, TEXT_CHUNK);
    return parts.map((t, i) => {
      // Attach only the pictures this slice of text refers to.
      const files: Media[] = [];
      let size = 0;
      for (const m of t.matchAll(/\[รูปที่ (\d+)\]/g)) {
        const img = pics[Number(m[1]) - 1];
        if (img && size + img.data.length <= MAX_CHUNK_B64) { files.push({ ...img, label: `รูปที่ ${m[1]}` }); size += img.data.length; }
      }
      return { label: `ส่วน ${i + 1}/${parts.length}${files.length ? ` (รูป ${files.length})` : ""}`, body: { ...common, kind: "media", text: t, files } };
    });
  }
  const text = await file.text();
  return splitText(text, TEXT_CHUNK).map((t, i, all) => ({ label: `ส่วน ${i + 1}/${all.length}`, body: { ...common, kind: "text", text: t } }));
}

async function callImport(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("prep-import", { body });
  if (error) {
    let msg = error.message;
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error; } catch { /* keep generic */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data as { items: Omit<Draft, "keep" | "src" | "file">[]; dropped: string[]; model: string; truncated: boolean; usage: { promptTokenCount?: number; candidatesTokenCount?: number } | null };
}

export default function ImportAI() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<Mode>("extract");
  const [quality, setQuality] = useState<Quality>("best");
  const [count, setCount] = useState(30);
  const [pagesPer, setPagesPer] = useState(4);
  const [imagesPer, setImagesPer] = useState(4);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [tokens, setTokens] = useState({ inp: 0, out: 0 });
  const [saving, setSaving] = useState(false);
  const cancel = useRef(false);
  const say = (m: string) => setLog(l => [...l, m]);

  const kinds = new Set(files.map(kindOf));
  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of list) if (!next.some(x => x.name === f.name && x.size === f.size)) next.push(f);
    setFiles(next); setDrafts([]); setLog([]);
  };

  const run = async () => {
    if (!files.length || busy) return;
    cancel.current = false;
    setBusy(true); setLog([]); setDrafts([]); setTokens({ inp: 0, out: 0 }); setProgress(null);
    const seen = new Set<string>();
    const common = { mode, count, hint, quality };
    const jobs: { file: string; chunk: Chunk }[] = [];
    try {
      // Photos are treated as one document (pages of the same exam), in the order they were picked.
      const imgs = files.filter(f => kindOf(f) === "image");
      const others = files.filter(f => kindOf(f) !== "image");
      for (const f of others) {
        const k = kindOf(f);
        if (k === "doc") { say(`${f.name}: ไฟล์ .doc แบบเก่าอ่านไม่ได้ — เปิดใน Word แล้ว "บันทึกเป็น" .docx หรือ PDF`); continue; }
        if (k === "unknown") { say(`${f.name}: ไม่รองรับชนิดไฟล์นี้`); continue; }
        if (f.size > MAX_FILE) { say(`${f.name}: ใหญ่เกิน 40 MB`); continue; }
        say(`กำลังเตรียม ${f.name}...`);
        try {
          const cs = await buildChunks(f, { pagesPer, imagesPer }, common);
          if (!cs.length) say(`${f.name}: ไม่พบเนื้อหาที่อ่านได้`);
          cs.forEach(c => jobs.push({ file: f.name, chunk: c }));
        } catch (e) { say(`${f.name}: อ่านไฟล์ไม่ได้ — ${thaiError(e)}`); }
      }
      if (imgs.length) {
        say(`กำลังย่อรูป ${imgs.length} ไฟล์...`);
        const media: Media[] = [];
        for (const f of imgs) {
          const m = await prepareImage(f, f.type || (f.name.toLowerCase().endsWith(".heic") ? "image/heic" : ""));
          if (m) media.push({ ...m, label: f.name }); else say(`${f.name}: เปิดรูปนี้ไม่ได้ (ลองแปลงเป็น JPG)`);
        }
        const cs = await buildChunks(imgs[0], { pagesPer, imagesPer }, common, media);
        // Source = the photo names in this request, so questions can be traced (and hidden) per file later.
        cs.forEach(c => jobs.push({ file: c.label.slice(0, 200), chunk: c }));
      }
      if (!jobs.length) { setBusy(false); return; }
      say(`ส่งให้ AI ทั้งหมด ${jobs.length} ช่วง`);
      setProgress({ done: 0, total: jobs.length });
      for (let i = 0; i < jobs.length; i++) {
        if (cancel.current) { say("หยุดตามคำสั่ง"); break; }
        const { file, chunk: c } = jobs[i];
        const where = files.length > 1 && file !== c.label ? `${file} · ${c.label}` : c.label;
        try {
          const r = await callImport(c.body);
          const fresh = r.items.filter(q => {
            const k = q.stem.replace(/\s/g, "");
            if (seen.has(k)) return false;
            seen.add(k); return true;
          });
          setDrafts(d => [...d, ...fresh.map(q => ({ ...q, keep: true, src: where, file }))]);
          setTokens(t => ({ inp: t.inp + (r.usage?.promptTokenCount ?? 0), out: t.out + (r.usage?.candidatesTokenCount ?? 0) }));
          say(`${where}: ได้ ${fresh.length} ข้อ · ${r.model}${r.dropped.length ? ` (ตัดทิ้ง ${r.dropped.length})` : ""}${r.truncated ? " ⚠ ผลลัพธ์ถูกตัดกลางทาง ลองลดจำนวนข้อ/หน้าต่อช่วง" : ""}`);
        } catch (e) {
          say(`${where}: ผิดพลาด — ${thaiError(e)}`);
        }
        setProgress({ done: i + 1, total: jobs.length });
      }
    } catch (e) {
      say("เกิดข้อผิดพลาด: " + thaiError(e));
    }
    setBusy(false);
  };

  const kept = drafts.filter(d => d.keep);

  const save = async () => {
    if (!kept.length || saving) return;
    setSaving(true);
    let ins = 0, skip = 0, bad = 0;
    try {
      // Saved per source file so every question keeps the name of the file it came from.
      const byFile = new Map<string, Draft[]>();
      kept.forEach(d => byFile.set(d.file, [...(byFile.get(d.file) ?? []), d]));
      for (const [file, list] of byFile) {
        for (let i = 0; i < list.length; i += 100) {
          const items = list.slice(i, i + 100).map(d => ({
            topic: d.topic, level: d.level, stem: d.stem, choices: d.choices, answer: d.answer,
            explanation: d.explanation, law_ref: d.law_ref, status: "review",
          }));
          const r = await rpc<{ inserted: number; skipped: number; invalid: number }>("prep_admin_import", {
            p_items: items, p_source: file, p_origin: mode === "extract" ? "sheet" : "ai",
          });
          ins += r.inserted; skip += r.skipped; bad += r.invalid;
        }
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
        <p className="pp-muted small">อัปโหลดได้หลายไฟล์พร้อมกัน: PDF, Word (.docx รวมรูปและตารางในไฟล์), รูปถ่าย/สแกน (PNG, JPG, HEIC), TXT → AI สร้างหรือคัดข้อสอบเป็น "ร่าง" → ตรวจ → บันทึกเข้าคิว "ตรวจข้อสอบ" (ไม่เผยแพร่ทันที)</p>
        <label className={`pp-drop ${busy ? "off" : ""}`}
          onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) addFiles(e.dataTransfer.files); }}>
          <input type="file" multiple accept={ACCEPT} disabled={busy} onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
          <b>แตะเพื่อเลือกไฟล์ หรือลากมาวาง</b>
          <span className="pp-muted small">PDF · DOCX · PNG · JPG · HEIC · TXT (ไฟล์ละไม่เกิน 40 MB) · รูปหลายรูปจะอ่านต่อกันเป็นชุดเดียวตามลำดับ</span>
        </label>
        {files.length > 0 && (
          <div className="pp-files">
            {files.map((f, i) => (
              <div key={f.name + f.size} className={`pp-file k-${kindOf(f)}`}>
                <span className="pp-file-k">{kindOf(f) === "image" ? "รูป" : kindOf(f).toUpperCase()}</span>
                <span className="pp-file-n">{f.name}<small>{(f.size / 1024 / 1024).toFixed(1)} MB{kindOf(f) === "doc" ? " · ต้องแปลงเป็น .docx" : ""}</small></span>
                {!busy && <button className="pp-x" aria-label="เอาออก" onClick={() => setFiles(files.filter((_, k) => k !== i))}>✕</button>}
              </div>
            ))}
          </div>
        )}

        <h3>สิ่งที่ให้ AI ทำ</h3>
        <div className="pp-seg">
          <button className={mode === "extract" ? "on" : ""} onClick={() => setMode("extract")} disabled={busy}>เป็นข้อสอบอยู่แล้ว → คัดข้อ</button>
          <button className={mode === "generate" ? "on" : ""} onClick={() => setMode("generate")} disabled={busy}>ชีทสรุป → แต่งข้อสอบ</button>
        </div>
        <h3>ความละเอียดของ AI</h3>
        <div className="pp-modes">
          {QUALITY.map(([k, l, h]) => (
            <button key={k} className={quality === k ? "on" : ""} disabled={busy} onClick={() => setQuality(k)}><b>{l}</b><span>{h}</span></button>
          ))}
        </div>
        <div className="pp-row">
          <label className="small" style={{ flex: 1 }}>ข้อต่อช่วง (สูงสุด 60)
            <input className="pp-input" type="number" min={1} max={60} value={count} disabled={busy} onChange={e => setCount(Math.min(60, Number(e.target.value) || 30))} />
          </label>
          {kinds.has("pdf") && (
            <label className="small" style={{ flex: 1 }}>หน้า PDF ต่อช่วง
              <input className="pp-input" type="number" min={1} max={30} value={pagesPer} disabled={busy} onChange={e => setPagesPer(Number(e.target.value) || 4)} />
            </label>
          )}
          {kinds.has("image") && (
            <label className="small" style={{ flex: 1 }}>รูปต่อช่วง
              <input className="pp-input" type="number" min={1} max={16} value={imagesPer} disabled={busy} onChange={e => setImagesPer(Math.min(16, Number(e.target.value) || 4))} />
            </label>
          )}
        </div>
        <input className="pp-input" placeholder="คำแนะนำเพิ่มเติม (ไม่บังคับ) เช่น เน้นมาตราและบทลงโทษ" value={hint} disabled={busy} onChange={e => setHint(e.target.value)} />

        <div className="pp-row">
          {busy
            ? <button className="pp-btn pp-btn-ghost" onClick={() => { cancel.current = true; }}>หยุด</button>
            : <button className="pp-btn pp-btn-primary" disabled={!files.length} onClick={run}>เริ่มให้ AI อ่าน {files.length ? `(${files.length} ไฟล์)` : ""}</button>}
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
              <button className="pp-btn pp-btn-primary" disabled={!kept.length || saving || busy} onClick={save}>{saving ? "กำลังบันทึก..." : `บันทึก ${kept.length} ข้อ`}</button>
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
