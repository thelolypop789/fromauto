// หน้า A4 (DOM จาก planDoc.ts) → PDF ภาพ ในเบราว์เซอร์
// * แต่ละหน้าวาดเป็นภาพด้วยเบราว์เซอร์เอง (SVG foreignObject → canvas) สระ/วรรณยุกต์ไทยจึงวางถูกที่ และข้อความในไฟล์คัดลอกไปแก้ต่อไม่ได้
//   ส่ง HTML ของหน้า + CSS ชุดเดียวกับบนจอ ไม่ล็อกความสูงรายบล็อก ถ้าภาพตัดบรรทัดต่างจากจอเล็กน้อย เนื้อหาก็แค่ไหลตาม
//   (planDoc.paginate เผื่อที่ท้ายหน้าไว้แล้ว)
// * ไม่มีลายน้ำบนหน้า (ใช้ยื่นสัมภาษณ์ได้) — ชื่อเจ้าของบัญชี อีเมล และเลขการโหลดฝังใน metadata ของไฟล์แทน
import { PAGE_H, PAGE_W, docFontCss } from "./planDoc";
import planCss from "./plans.css?raw";

export type PdfMeta = { title: string; author: string; subject: string; keywords: string[] };

export async function pagesToPdf(pages: HTMLElement[], meta: PdfMeta, onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const [{ PDFDocument }, fontCss] = await Promise.all([import("pdf-lib"), docFontCss()]);
  const css = `${fontCss}\n${planCss}`;
  const doc = await PDFDocument.create();
  doc.setTitle(meta.title);
  doc.setAuthor(meta.author);
  doc.setSubject(meta.subject);
  doc.setKeywords(meta.keywords);
  doc.setCreator("SOBPREP แผนการสอนสำเร็จรูป");
  doc.setProducer("SOBPREP");
  // ความละเอียด ~190 dpi: ตัวหนังสือคมเมื่อพิมพ์ ไฟล์ไม่ใหญ่เกิน (ราว 150–250 KB ต่อหน้า)
  const ratio = 2;
  for (let i = 0; i < pages.length; i++) {
    const canvas = await pageToCanvas(pages[i], css, ratio);
    const blob = await new Promise<Blob>((ok, bad) => canvas.toBlob(b => (b ? ok(b) : bad(new Error("encode"))), "image/jpeg", 0.86));
    const img = await doc.embedJpg(await blob.arrayBuffer());
    const page = doc.addPage([595.28, 841.89]);
    page.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
    onProgress?.(i + 1, pages.length);
  }
  const bytes = await doc.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

async function pageToCanvas(page: HTMLElement, css: string, ratio: number) {
  const xhtml = new XMLSerializer().serializeToString(page);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W * ratio}" height="${PAGE_H * ratio}" viewBox="0 0 ${PAGE_W} ${PAGE_H}">`
    + `<foreignObject x="0" y="0" width="${PAGE_W}" height="${PAGE_H}"><div xmlns="http://www.w3.org/1999/xhtml">`
    + `<style><![CDATA[${css}]]></style>${xhtml}</div></foreignObject></svg>`;
  // data URL (ไม่ใช่ blob URL): Chrome ถือว่า SVG ที่มี foreignObject จาก blob URL ทำให้ canvas "tainted" ส่งออกไม่ได้
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  {
    await img.decode();
    const c = document.createElement("canvas");
    c.width = PAGE_W * ratio; c.height = PAGE_H * ratio;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
}

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
