// ตัวแสดงผลเอกสารแผนการสอน: บล็อกจาก scripts/prep/lesson_plans/build.mjs → หน้า A4 (DOM) ที่ตัดหน้าเอง
// หน้าเดียวกันใช้ทั้งพรีวิวบนจอและเป็นต้นฉบับภาพของ PDF (planPdf.ts) จึงต้องไม่มี transform ที่ตัวหน้าเอง
// (ย่อขนาดบนจอที่กล่องครอบ .lp-fit แทน)

export type Cell = string | { x: string; cs?: number; rs?: number };
export type Block =
  | { t: "box"; x: string[] }
  | { t: "p"; x: string; i?: number; c?: number; b?: number }
  | { t: "tbl"; w: number[]; head?: Cell[][]; rows: Cell[][]; sm?: number; tall?: number; cards?: number; i?: number }
  | { t: "sign"; role: string; blank?: number }   // blank = ผู้ลงนามคนอื่น (หัวหน้ากลุ่มสาระ/ผู้บริหาร): เว้นชื่อและปีให้เขียนเอง
  | { t: "qr"; svg: string; x: string; url: string }
  | { t: "br" };

export type Vars = { teacher: string; term: string; year: string };

// A4 ที่ 96 dpi และระยะขอบตามไฟล์ต้นฉบับ (บน 2.29 ซม. ขวา 1.9 ล่าง 1.94 ซ้าย 2.54)
export const PAGE_W = 794, PAGE_H = 1123;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const DOTS = "..................................................";

function text(s: string, v: Vars) {
  const filled = s
    .replace(/\{\{teacher\}\}/g, v.teacher.trim() || DOTS)
    .replace(/\{\{term\}\}/g, v.term.trim() || "......")
    .replace(/\{\{year\}\}/g, v.year.trim() || "..........");
  return esc(filled).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

function cellEl(tag: "td" | "th", c: Cell, v: Vars) {
  const o = typeof c === "string" ? { x: c } : c;
  const e = el(tag, undefined, text(o.x, v));
  if (o.cs) e.colSpan = o.cs;
  if (o.rs) e.rowSpan = o.rs;
  return e;
}

function block(b: Exclude<Block, { t: "br" } | { t: "tbl" }>, v: Vars): HTMLElement {
  switch (b.t) {
    case "box": return el("div", "lp-box", b.x.map(x => `<div>${text(x, v)}</div>`).join(""));
    case "p": {
      const e = el("p", `lp-p${b.i ? ` i${Math.min(b.i, 4)}` : ""}${b.c ? " c" : ""}`, text(b.x, v));
      if (b.b) e.dataset.kwn = "1";      // หัวข้อ: ไม่ปล่อยค้างท้ายหน้า
      return e;
    }
    case "sign": {
      const line = "........................................";
      const name = !b.blank && v.teacher.trim() ? `(${esc(v.teacher.trim())})` : `(${line})`;
      const year = b.blank ? ".........." : esc(v.year.trim() || "..........");
      return el("div", "lp-sign", `<div>ลงชื่อ${line}${esc(b.role)}</div><div>${name}</div><div>วันที่.......เดือน................ พ.ศ. ${year}</div>`);
    }
    case "qr": {
      const e = el("div", "lp-qr");
      const box = el("div", "lp-qr-img");
      box.innerHTML = b.svg;      // สร้างจาก build.mjs (qrcode) ไม่ใช่ข้อมูลผู้ใช้
      e.append(box, el("div", "lp-qr-t", `<b>${esc(b.x)}</b><br><span>${esc(b.url)}</span>`));
      return e;
    }
  }
}

function tableShell(b: Extract<Block, { t: "tbl" }>, v: Vars) {
  const t = el("table", `lp-t${b.sm ? " sm" : ""}${b.tall ? " tall" : ""}${b.cards ? " cards" : ""}${b.i ? ` i${Math.min(b.i, 4)}` : ""}`);
  const cg = el("colgroup");
  for (const w of b.w) { const c = el("col"); c.style.width = `${w}%`; cg.append(c); }
  t.append(cg);
  if (b.head) {
    const th = el("thead");
    for (const r of b.head) { const tr = el("tr"); r.forEach(c => tr.append(cellEl("th", c, v))); th.append(tr); }
    t.append(th);
  }
  const tb = el("tbody");
  t.append(tb);
  return { t, tb };
}

// วางบล็อกลงหน้า A4 ใน host (ต้องอยู่ใน DOM และโหลดฟอนต์แล้ว เพื่อวัดความสูงได้จริง)
// opts.fresh = เริ่มหน้าใหม่ก่อนบล็อกแรก (ต่อจากหน้าที่มีอยู่แล้ว)
export function paginate(blocks: Block[], v: Vars, host: HTMLElement): HTMLElement[] {
  const pages: HTMLElement[] = [];
  let body!: HTMLElement;
  const newPage = () => {
    const page = el("div", "lp-page");
    body = el("div", "lp-body");
    page.append(body);
    host.append(page);
    pages.push(page);
  };
  // เผื่อท้ายหน้า 14px: ภาพใน PDF อาจตัดบรรทัดต่างจากจอเล็กน้อย
  const fits = () => {
    const last = body.lastElementChild as HTMLElement | null;
    return !last || last.offsetTop + last.offsetHeight <= body.clientHeight - 14;
  };
  // ย้ายหัวข้อที่ค้างท้ายหน้าไปหน้าใหม่ด้วย (ถ้าทั้งหน้ามีแต่หัวข้อ ปล่อยไว้)
  const breakKeepingHeads = () => {
    const carry: Element[] = [];
    let last = body.lastElementChild as HTMLElement | null;
    while (last && last.dataset.kwn) { carry.unshift(last); last = last.previousElementSibling as HTMLElement | null; }
    if (carry.length === body.children.length) carry.length = 0;
    carry.forEach(c => c.remove());
    newPage();
    carry.forEach(c => body.append(c));
  };
  newPage();

  for (const b of blocks) {
    if (b.t === "br") { if (body.children.length) newPage(); continue; }
    if (b.t === "tbl") {
      let { t, tb } = tableShell(b, v);
      body.append(t);
      for (const r of b.rows) {
        const tr = el("tr");
        r.forEach(c => tr.append(cellEl("td", c, v)));
        tb.append(tr);
        if (fits()) continue;
        tr.remove();
        if (!tb.children.length) { t.remove(); breakKeepingHeads(); }
        else newPage();
        ({ t, tb } = tableShell(b, v));      // ตารางต่อหน้าใหม่ พร้อมหัวตารางซ้ำ
        body.append(t);
        tb.append(tr);
      }
      continue;
    }
    const e = block(b, v);
    body.append(e);
    if (fits()) continue;
    e.remove();
    if (!body.children.length) { body.append(e); continue; }     // บล็อกเดียวยาวเกินหน้า: ปล่อยล้น (ไม่ควรเกิด)
    breakKeepingHeads();
    body.append(e);
  }
  if (pages.length > 1 && !body.children.length) { pages.pop()?.remove(); }
  return pages;
}

// ฟอนต์ของเอกสาร: Sarabun (ไทย+ละติน, 400/700) แปลงเป็น data URL ใช้ชื่อ "SarabunDoc"
// ใช้ชุดเดียวกันทั้งบนจอและตอนถ่ายภาพหน้าเป็น PDF (html-to-image ฝัง CSS นี้ลงภาพ) ตัวอักษรจึงตัดบรรทัดตรงกันทุกจุด
// ถ้าใช้ฟอนต์จาก stylesheet ของหน้าเว็บ ภาพใน PDF จะตัดบรรทัดต่างจากที่วัดไว้ แล้วเกิดช่องว่าง/ข้อความล้น
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap";
let fontCss: Promise<string> | null = null;
export function docFontCss() {
  fontCss ??= (async () => {
    const css = await (await fetch(FONT_CSS)).text();
    const faces = css.split(/(?=\/\*\s*[\w-]+\s*\*\/)/).filter(b => /^\/\*\s*(thai|latin)\s*\*\//.test(b));
    const out = await Promise.all(faces.map(async face => {
      const url = face.match(/url\((https:[^)]+)\)/)?.[1];
      if (!url) return "";
      const blob = await (await fetch(url)).blob();
      const data = await new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = bad; r.readAsDataURL(blob); });
      return face.replace(url, data).replace(/font-family:\s*'Sarabun'/, "font-family: 'SarabunDoc'");
    }));
    return out.join("\n");
  })().catch(e => { fontCss = null; throw e; });
  return fontCss;
}

export async function fontsReady() {
  try {
    if (!document.getElementById("lp-font")) {
      const st = document.createElement("style");
      st.id = "lp-font";
      st.textContent = await docFontCss();
      document.head.append(st);
    }
    await Promise.all(["400", "700"].map(w => document.fonts.load(`${w} 15px SarabunDoc`, "กขค abc")));
  } catch { /* โหลดฟอนต์ไม่ได้: ใช้ Sarabun ของหน้าเว็บแทน (PDF อาจตัดบรรทัดต่างเล็กน้อย) */ }
}
