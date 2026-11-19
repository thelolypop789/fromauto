// บล็อกเอกสารแผน (เดียวกับ PDF) → ไฟล์ Word (.docx) ที่ลูกค้าแก้ต่อได้
// * ข้อความ/ตาราง เป็นของจริงใน Word (แก้ได้) ฟอนต์ TH SarabunPSK 16 pt ตามแบบเอกสารราชการ
// * การ์ดสี (บล็อก html) และ QR เป็นรูปภาพ — วาดจาก CSS ชุดเดียวกับบนจอ
// * ชื่อเจ้าของบัญชีอยู่ในช่องผู้สอน + metadata ของไฟล์ (ผู้สร้าง/คำสำคัญ = เลขการโหลด) ไว้ตามต้นทางเมื่อไฟล์หลุด
import {
  AlignmentType, BorderStyle, LineRuleType, Document, HeightRule, ImageRun, Packer, Paragraph, Table, TableCell, TableLayoutType,
  TableRow, TextRun, VerticalAlign, WidthType, type IBorderOptions,
} from "docx";
import { fillVars, type Block, type Cell, type Vars } from "./planDoc";
import { docCss, nodeToCanvas } from "./planPdf";

export type DocxMeta = { title: string; author: string; description: string; keywords: string };

const FONT = "TH SarabunPSK";
// ระบุภาษาไทย (bidi = th-TH) แบบไฟล์ Word จริง ไม่งั้นบางโปรแกรมคิดระยะบรรทัดผิด
const TH = { value: "th-TH", bidirectional: "th-TH" } as const;
// A4 + ระยะขอบตามไฟล์ต้นฉบับ (twips) · พื้นที่เนื้อหากว้าง 9386 twips ≈ 626 px
const PAGE = { width: 11906, height: 16838, margin: { top: 1300, right: 1080, bottom: 1100, left: 1440 } };
const CONTENT_TW = PAGE.width - PAGE.margin.left - PAGE.margin.right;
const CONTENT_PX = 626;
const INDENT = [0, 420, 780, 1140, 1500];   // ระดับย่อหน้าเดียวกับ .lp-p.i1–i4 (px × 15)
const SIZE = { body: 32, table: 28, small: 24, title: 36 };   // ครึ่งพอยต์

const line: IBorderOptions = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
const dashed: IBorderOptions = { style: BorderStyle.DASHED, size: 8, color: "000000" };
const borders = (b: IBorderOptions) => ({ top: b, bottom: b, left: b, right: b });

// "**ตัวหนา** ปกติ\nบรรทัดใหม่" → TextRun หลายชิ้น
function runs(s: string, v: Vars, size: number, boldAll = false): TextRun[] {
  const out: TextRun[] = [];
  fillVars(s, v).replace(/\u2003+/g, "    ").split("\n").forEach((ln, i) => {
    ln.split(/(\*\*[^*]+\*\*)/).filter(Boolean).forEach((part, j) => {
      const bold = boldAll || /^\*\*[^*]+\*\*$/.test(part);
      out.push(new TextRun({ text: bold && part.startsWith("**") ? part.slice(2, -2) : part, bold, size, font: FONT, language: TH, break: i > 0 && j === 0 ? 1 : undefined }));
    });
    if (!ln) out.push(new TextRun({ text: "", size, font: FONT, break: i > 0 ? 1 : undefined }));
  });
  return out;
}

// exact = ความสูงบรรทัดตายตัว (twips) ใช้กับช่องตารางคะแนนที่ต้องเตี้ย และย่อหน้าเว้นระยะที่ไม่ควรกินบรรทัดเต็ม
const para = (children: (TextRun | ImageRun)[], o: { indent?: number; center?: boolean; after?: number; keepNext?: boolean; exact?: number; breakBefore?: boolean } = {}) =>
  new Paragraph({
    children, indent: o.indent ? { left: o.indent } : undefined, alignment: o.center ? AlignmentType.CENTER : undefined,
    spacing: o.exact ? { after: o.after ?? 0, line: o.exact, lineRule: LineRuleType.EXACT } : { after: o.after ?? 0, line: 250, lineRule: LineRuleType.AUTO },
    keepNext: o.keepNext, pageBreakBefore: o.breakBefore,
  });
// ช่องว่างหลังตาราง/กรอบ: สูง 1 pt ไม่ดันเนื้อหาจนล้นไปหน้าใหม่
const gap = (after: number) => para([], { exact: 20, after });

function table(b: Extract<Block, { t: "tbl" }>, v: Vars) {
  const size = b.sm ? SIZE.small : SIZE.table;
  const indent = INDENT[Math.min(b.i ?? 0, 4)];
  const total = CONTENT_TW - indent;
  const widths = b.w.map(w => Math.round((w / 100) * total));
  const cell = (c: Cell, head: boolean) => {
    const o = typeof c === "string" ? { x: c } : c;
    return new TableCell({
      children: [para(runs(o.x, v, size, head), { center: head, exact: b.sm && !head ? 270 : undefined })],
      columnSpan: o.cs, rowSpan: o.rs, verticalAlign: head ? VerticalAlign.CENTER : VerticalAlign.TOP,
      borders: borders(b.cards ? dashed : line),
      margins: b.cards ? { top: 160, bottom: 160, left: 200, right: 200 } : { top: 30, bottom: 30, left: 90, right: 90 },
    });
  };
  const rowH = b.cards ? 1700 : b.tall ? 800 : b.sm ? 330 : undefined;
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    indent: indent ? { size: indent, type: WidthType.DXA } : undefined,
    rows: [
      ...(b.head ?? []).map(r => new TableRow({ tableHeader: true, children: r.map(c => cell(c, true)) })),
      ...b.rows.map(r => new TableRow({ children: r.map(c => cell(c, false)), height: rowH ? { value: rowH, rule: HeightRule.ATLEAST } : undefined, cantSplit: true })),
    ],
  });
}

async function png(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob>((ok, bad) => canvas.toBlob(b => (b ? ok(b) : bad(new Error("encode"))), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

// บล็อก html (การ์ดสี ตารางเฉลย) → รูปเต็มความกว้างเนื้อหา
async function htmlImage(html: string, css: string) {
  const host = document.createElement("div");
  host.className = "lp-measure";
  const node = document.createElement("div");
  node.className = "lp-page lp-snip";
  node.style.cssText = `width:${CONTENT_PX}px;height:auto;padding:0;overflow:visible`;
  node.innerHTML = `<div class="lp-html">${html}</div>`;
  host.append(node);
  document.body.append(host);
  try {
    const h = Math.ceil(node.getBoundingClientRect().height) + 2;
    node.style.height = `${h}px`;
    const c = await nodeToCanvas(node, CONTENT_PX, h, css, 2);
    return new ImageRun({ type: "png", data: await png(c), transformation: { width: CONTENT_PX, height: h } });
  } finally { host.remove(); }
}

async function svgImage(svg: string, px: number) {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.includes("xmlns=") ? svg : svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"'))}`;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = c.height = px * 3;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return new ImageRun({ type: "png", data: await png(c), transformation: { width: px, height: px } });
}

export async function blocksToDocx(blocks: Block[], v: Vars, meta: DocxMeta, onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const css = await docCss();
  const out: (Paragraph | Table)[] = [];
  const DOTS = "........................................";
  for (let k = 0; k < blocks.length; k++) {
    const b = blocks[k];
    switch (b.t) {
      case "br":
        // ขึ้นหน้าใหม่ด้วย pageBreakBefore ของย่อหน้าเล็ก ๆ (ไม่ใช้ PageBreak ในย่อหน้าเต็มบรรทัด ซึ่งถ้าล้นจะเกิดหน้าว่าง)
        if (out.length) out.push(para([], { exact: 20, breakBefore: true }));
        break;
      case "box":
        out.push(new Table({
          width: { size: CONTENT_TW, type: WidthType.DXA }, columnWidths: [CONTENT_TW], layout: TableLayoutType.FIXED,
          rows: [new TableRow({ children: [new TableCell({
            borders: borders({ style: BorderStyle.SINGLE, size: 12, color: "000000" }),
            margins: { top: 100, bottom: 100, left: 160, right: 160 },
            children: b.x.map(x => para(runs(x, v, SIZE.title, true), { center: true })),
          })] })],
        }), gap(160));
        break;
      case "p":
        out.push(para(runs(b.x, v, SIZE.body), { indent: INDENT[Math.min(b.i ?? 0, 4)], center: !!b.c, keepNext: !!b.b, after: 20 }));
        break;
      case "tbl":
        out.push(table(b, v), gap(100));
        break;
      case "sign": {
        const name = !b.blank && v.teacher.trim() ? v.teacher.trim() : DOTS;
        const year = b.blank ? ".........." : v.year.trim() || "..........";
        out.push(gap(240));
        for (const t of [`ลงชื่อ${DOTS}${b.role}`, `(${name})`, `วันที่.......เดือน................ พ.ศ. ${year}`]) {
          out.push(new Paragraph({ children: runs(t, v, SIZE.body), alignment: AlignmentType.CENTER, indent: { left: 4200 }, spacing: { after: 0, line: 250, lineRule: LineRuleType.AUTO } }));
        }
        break;
      }
      case "qr":
        out.push(new Paragraph({
          indent: { left: INDENT[2] }, spacing: { after: 80 },
          children: [await svgImage(b.svg, 84), new TextRun({ text: `  ${b.x}`, bold: true, size: SIZE.table, font: FONT }), new TextRun({ text: b.url, size: SIZE.small, font: FONT, break: 1 })],
        }));
        break;
      case "html":
        out.push(new Paragraph({ children: [await htmlImage(b.x, css)], spacing: { after: 0 } }));
        break;
    }
    onProgress?.(k + 1, blocks.length);
  }
  const doc = new Document({
    compatabilityModeVersion: 15,   // Word 2013+ เหมือนไฟล์ต้นฉบับ (โหมดเก่าคิดระยะบรรทัดภาษาไทยแคบจนตัวอักษรทับกัน)
    creator: meta.author, lastModifiedBy: meta.author, title: meta.title, description: meta.description, keywords: meta.keywords,
    styles: { default: { document: { run: { font: FONT, size: SIZE.body, language: TH }, paragraph: { spacing: { line: 250, lineRule: LineRuleType.AUTO } } } } },
    sections: [{ properties: { page: { size: { width: PAGE.width, height: PAGE.height }, margin: PAGE.margin } }, children: out }],
  });
  return Packer.toBlob(doc);
}

