// ตัวช่วยที่ไม่แตะเครือข่ายของ prep-esa-watch (มีเทสต์ใน scripts/prep/test_esa_logic.mjs)

export type Item = { title: string; url: string; posted_at: string | null };

// หัวข้อที่เกี่ยวกับการสอบ/บรรจุครูผู้ช่วย และต้องเป็น "ประกาศ" (ไม่ใช่ข่าวกิจกรรม เช่น ลงพื้นที่ให้กำลังใจ ประชุมซักซ้อม)
const RECRUIT = /ครูผู้ช่วย|ภาค\s*ค|สอบแข่งขัน|บรรจุและแต่งตั้ง|เรียกบรรจุ|บัญชีผู้(?:ผ่าน|สอบ)|ขึ้นบัญชี/;
const ANNOUNCE = /ประกาศ|รายชื่อ|บัญชี|รายงานตัว|ผลการ|รับสมัคร|กำหนด(?:การ|วัน)|เรียก|แจ้ง|ยกเลิก|เลื่อน|แก้ไข/;
const NOT_RECRUIT = new RegExp([
  "ลูกจ้าง|อัตราจ้าง|พนักงานราชการ|ธุรการ|จ้างเหมา|นักการภารโรง|ครูพี่เลี้ยง|ย้าย|รองผู้อำนวยการ|ผู้บริหารสถานศึกษา|วิทยฐานะ",
  "ลงพื้นที่|ตรวจเยี่ยม|ให้กำลังใจ|ประชุม|ซักซ้อม|อบรม|เตรียมความพร้อมและพัฒนาอย่างเข้ม|ปฐมนิเทศ|ต้อนรับ|มอบ(?:นโยบาย|เกียรติบัตร)|แสดงความยินดี",
].join("|"));

export function isRecruit(title: string): boolean {
  const t = title.replace(/\s+/g, " ");
  return RECRUIT.test(t) && ANNOUNCE.test(t) && !NOT_RECRUIT.test(t);
}

// ชนิดประกาศ ใช้จัดกลุ่มในข้อความแจ้งเตือน/หน้ารวมลิงก์
export function topicOf(title: string): string {
  const t = title.replace(/\s+/g, " ");
  // "การสอบแข่งขันเพื่อบรรจุและแต่งตั้ง" เป็นชื่อการสอบ ไม่ใช่การเรียกบรรจุ
  if (/รายงานตัว|เรียกบรรจุ|เรียกตัว|ลำดับที่\s*\d+\s*(?:ถึง|-)/.test(t)) return "report";
  if (/ผู้(?:สอบ)?ผ่าน|สอบผ่าน|ผู้ได้รับการ(?:คัดเลือก|เลือกสรร)|ผลการ(?:สอบ|คัดเลือก|ประเมิน)|ขึ้นบัญชี|บัญชีผู้/.test(t)) return "result";
  if (/ผู้มีสิทธิ/.test(t)) return "eligible";
  if (/รับสมัคร/.test(t)) return "apply";
  return "other";
}

export const TOPIC_TH: Record<string, string> = {
  report: "เรียกรายงานตัว/บรรจุ", result: "ประกาศผล", eligible: "ผู้มีสิทธิ", apply: "รับสมัคร", other: "ประกาศอื่น",
};

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}

export function cleanText(s: string): string {
  return decodeEntities(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

// ชื่อ charset จาก header/meta → ชื่อที่ TextDecoder รู้จัก (เว็บราชการเก่าหลายเว็บยังใช้ TIS-620)
export function charsetOf(contentType: string | null, head: string): string {
  const m = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType ?? "") ?? /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head);
  const c = (m?.[1] ?? "utf-8").toLowerCase();
  return /tis-?620|iso-?8859-?11|windows-?874|x-windows-874/.test(c) ? "windows-874" : c === "utf8" ? "utf-8" : c;
}

export function absUrl(href: string, base: string): string | null {
  try {
    const u = new URL(decodeEntities(href.trim()), base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

export function isRss(contentType: string | null, body: string): boolean {
  return /xml|rss/i.test(contentType ?? "") && /<rss[\s>]|<feed[\s>]/i.test(body.slice(0, 2000));
}

function isoDate(s: string | undefined): string | null {
  if (!s) return null;
  const d = new Date(s.trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// RSS 2.0 (WordPress /feed/) และ Atom
export function parseFeed(xml: string, base: string): Item[] {
  const out: Item[] = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  for (const b of blocks) {
    const title = cleanText(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(b)?.[1] ?? "");
    const rawLink = /<link[^>]*>([\s\S]*?)<\/link>/i.exec(b)?.[1]?.trim() || /<link[^>]*href=["']([^"']+)["']/i.exec(b)?.[1] || "";
    const url = absUrl(cleanText(rawLink), base);
    const date = /<(?:pubDate|published|updated|dc:date)[^>]*>([\s\S]*?)<\//i.exec(b)?.[1];
    if (title && url) out.push({ title: title.slice(0, 300), url, posted_at: isoDate(date) });
  }
  return out;
}

// หน้าเว็บทั่วไป: ลิงก์ทุกอันที่ข้อความยาวพอเป็นหัวข้อข่าว (กรองคำสำคัญทีหลัง)
export function parseHtmlLinks(html: string, base: string): Item[] {
  const seen = new Set<string>();
  const out: Item[] = [];
  const re = /<a\b[^>]*?href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let title = cleanText(m[2]);
    if (title.length < 12) title = cleanText(/title\s*=\s*["']([^"']+)["']/i.exec(m[0])?.[1] ?? title);
    const url = absUrl(m[1], base);
    if (!url || title.length < 12 || title.length > 400 || seen.has(url)) continue;
    seen.add(url);
    out.push({ title: title.slice(0, 300), url, posted_at: null });
  }
  return out;
}

// หน้าแรกที่เป็นแค่ตัวพาไปหน้าอื่น (meta refresh / document.location) — ระบบเว็บกลางของ สพท. หลายเขต:
// index → "intro"/"event.php" → หน้าจริงที่ /frontpage
export function shellTargets(html: string, base: string): string[] {
  if (html.length > 6000) return [];
  const code = html.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[\s;>])\/\/[^\n]*/g, "$1");
  const raw: string[] = [];
  if (/อินโทรจากส่วนกลาง|event\.php|["']intro["']/.test(html)) raw.push("frontpage");
  for (const m of code.matchAll(/(?:document\.|window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']|location\.replace\(\s*["']([^"']+)["']/g)) raw.push(m[1] ?? m[2]);
  const meta = /<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*url=([^"'>\s]+)/i.exec(html);
  if (meta) raw.push(meta[1]);
  const out: string[] = [];
  for (const r of raw) {
    const u = absUrl(r, base);
    if (u && u !== absUrl(base, base) && !out.includes(u)) out.push(u);
  }
  return out.slice(0, 2);
}

export function recruitItems(items: Item[]): Item[] {
  const seen = new Set<string>();
  return items.filter((i) => isRecruit(i.title) && !seen.has(i.url) && seen.add(i.url));
}

// ข้อความ LINE ถึงเจ้าของ (ไม่เกิน ~4,500 ตัวอักษร; LINE จำกัด 5,000)
export type Found = { site: string; title: string; url: string; topic: string };
export function digestText(rows: Found[], pageUrl: string): string {
  const sites = new Set(rows.map((r) => r.site)).size;
  let s = `🔔 เว็บเขตพื้นที่มีประกาศครูผู้ช่วยใหม่ ${rows.length} เรื่อง จาก ${sites} เขต\n`;
  let shown = 0;
  for (const r of rows) {
    const line = `\n• ${r.site} — ${TOPIC_TH[r.topic] ?? ""}\n${r.title.slice(0, 110)}\n${r.url}\n`;
    if (s.length + line.length > 4300) break;
    s += line;
    shown++;
  }
  if (shown < rows.length) s += `\n…และอีก ${rows.length - shown} เรื่อง`;
  return s + (pageUrl ? `\n\nรวมทุกเขต: ${pageUrl}` : "");
}
