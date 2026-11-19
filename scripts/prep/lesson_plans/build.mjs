// แผนสำเร็จรูป: ประกอบเนื้อหาแผน (content/lesson-plans/<slug>.json) เข้ากับรูปแบบแผน (_formats.json)
// เป็นเอกสารแบบบล็อกต่อรูปแบบ แล้วเขียน
//   1) migration upsert เนื้อหาเข้า prep.lesson_plans (รันซ้ำได้ เพราะ upsert ตาม slug)
//   2) หน้าสื่อออนไลน์ static public/prep/media/<slug>/index.html (ใบความรู้ให้นักเรียนสแกน QR — เปิดได้ไม่ต้องล็อกอิน)
//
// ใช้: node scripts/prep/lesson_plans/build.mjs [slug ...] [--out supabase/migrations/<ts>_prep_lesson_plans_content.sql]
// ไม่ระบุ slug = ทุกไฟล์; ไม่ระบุ --out = เขียน scratch ที่ scripts/prep/lesson_plans/out.sql
//
// รูปแบบบล็อก (ตัวแสดงผลอยู่ที่ src/prep/plans/planDoc.ts):
//   {t:'box', x:[บรรทัด]}                      กรอบหัวแผน
//   {t:'p', x, i?, c?, b?}                      ย่อหน้า (i = ระดับย่อหน้า, c = กึ่งกลาง, b = หัวข้อ ไม่ให้ค้างท้ายหน้า)
//   {t:'tbl', w, head?, rows, sm?, tall?, cards?}  ตาราง (เซลล์ = ข้อความ หรือ {x, cs, rs}); ตัดข้ามหน้าเป็นแถว
//   {t:'sign', role}                            ช่องลงชื่อ
//   {t:'qr', svg, x, url}                       QR สื่อออนไลน์
//   {t:'br'}                                    ขึ้นหน้าใหม่
// ข้อความใช้ **ตัวหนา** ได้; ตัวแปร {{teacher}} {{term}} {{year}} แทนค่าตอนแสดงผล (ฝั่งเบราว์เซอร์)
import fs from "node:fs";
import path from "node:path";
import QRCode from "qrcode";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const DIR = path.join(ROOT, "content/lesson-plans");
const SITE = "https://sobprep.com";
const FORMATS = JSON.parse(fs.readFileSync(path.join(DIR, "_formats.json"), "utf8"));

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const out = outIdx >= 0 ? args.splice(outIdx, 2)[1] : path.join(ROOT, "scripts/prep/lesson_plans/out.sql");
const slugs = args.length ? args : fs.readdirSync(DIR).filter(f => f.endsWith(".json") && !f.startsWith("_")).map(f => f.replace(/\.json$/, ""));

const fill = (s, L) => s.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in L && typeof L[k] !== "object" ? String(L[k]) : m));

// "  ข้อความ" → ย่อหน้าระดับ 1; "!c " = กึ่งกลาง; {table} → ตาราง; {br} → ขึ้นหน้าใหม่
function lines(arr, L, base = 0) {
  return arr.flatMap(item => {
    if (typeof item === "string") {
      let s = item, c = false;
      const lead = s.match(/^ */)[0].length;
      s = s.slice(lead);
      if (s.startsWith("!c ")) { c = true; s = s.slice(3); }
      const b = { t: "p", x: fill(s, L) };
      const i = base + Math.floor(lead / 2);
      if (i) b.i = i;
      if (c) b.c = 1;
      if (/^\*\*[^*]+\*\*$/.test(s)) b.b = 1;      // ทั้งบรรทัดตัวหนา = หัวข้อ
      return b;
    }
    if (item.br) return { t: "br" };
    if (item.cases) return caseBlocks(L);
    if (item.table) {
      const t = item.table;
      const cell = v => (typeof v === "string" ? fill(v, L) : v);
      const b = { t: "tbl", w: t.w, rows: t.rows.map(r => r.map(cell)) };
      if (t.head) b.head = t.head.map(r => r.map(cell));
      if (t.tall) b.tall = 1;
      if (t.cards) b.cards = 1;
      if (base) b.i = base;
      return b;
    }
    throw new Error("unknown line " + JSON.stringify(item));
  });
}

const h = x => ({ t: "p", x: `**${x}**`, b: 1 });
const p = (x, i = 0) => (i ? { t: "p", x, i } : { t: "p", x });

// เกณฑ์ระดับคุณภาพ 3 ระดับ (ตามแผนต้นฉบับ: 12 → 9/5/1, 15 → 11/6/1)
function levels(max) {
  const top = Math.ceil(max * 0.7), mid = Math.ceil(max * 0.35);
  return [
    h("เกณฑ์การประเมิน"),
    p(`นักเรียนที่ได้รับการประเมิน ${top} – ${max} คะแนน ถือว่า ระดับคุณภาพ ดีมาก`, 1),
    p(`นักเรียนที่ได้รับการประเมิน ${mid} – ${top - 1} คะแนน ถือว่า ระดับคุณภาพ ดี`, 1),
    p(`นักเรียนที่ได้รับการประเมิน 1 – ${mid - 1} คะแนน ถือว่า ระดับคุณภาพ ปรับปรุง`, 1),
  ];
}

// แบบบันทึกคะแนน 20 คน: เลขที่ | ชื่อ-สกุล | เกณฑ์... | รวม | ระดับคุณภาพ | ผ่าน | ไม่ผ่าน
function scoreSheet(title, intro, criteria) {
  const n = criteria.length, max = 3 * n;
  const crit = Math.floor(53 / n);
  return [
    { t: "p", x: `**${title}**`, c: 1, b: 1 },
    p(`**คำชี้แจง** ${intro}`),
    {
      t: "tbl", sm: 1,
      w: [5, 15, ...criteria.map(() => crit), 7, 8, 6, 6].map((v, i, a) => (i === 1 ? v + (100 - a.reduce((s, x) => s + x, 0)) : v)),
      head: [
        [{ x: "เลขที่", rs: 2 }, { x: "ชื่อ-สกุล", rs: 2 }, ...criteria, `รวมคะแนน (${max})`, { x: "ระดับคุณภาพ", rs: 2 }, { x: "ผ่าน", rs: 2 }, { x: "ไม่ผ่าน", rs: 2 }],
        [...criteria.map(() => "3"), String(max)],
      ],
      rows: Array.from({ length: 20 }, (_, k) => [String(k + 1), "", ...criteria.map(() => ""), "", "", "", ""]),
    },
    ...levels(max),
  ];
}

function rubric(title, rows) {
  return [
    { t: "p", x: `**${title}**`, c: 1, b: 1 },
    {
      t: "tbl", sm: 1, w: [22, 26, 26, 26],
      head: [[{ x: "ประเด็นการประเมิน", rs: 2 }, { x: "เกณฑ์การประเมิน", cs: 3 }], ["3", "2", "1"]],
      rows,
    },
  ];
}

function sign(role) { return { t: "sign", role }; }

const DOTLINE = "....................................................................................................................................................";
const dots = (n, i = 1) => Array.from({ length: n }, () => p(DOTLINE, i));
const stripKPA = x => x.replace(/\s*\((Knowledge|Process|Attitude)\)\s*$/, "");

// ส่วนท้ายที่ใช้ร่วมกันทุกรูปแบบ: แบบประเมินใบงาน + แบบสังเกตพฤติกรรม
function sharedForms(L) {
  return [
    { t: "br" },
    ...scoreSheet(L.worksheet_rubric.title, "ให้ครูประเมินผลงานใบงานโดยให้คะแนนในช่องที่ตรงกับผลงานของนักเรียน", L.worksheet_rubric.criteria.map(c => c[0])),
    ...rubric(`รายละเอียดเกณฑ์การให้คะแนน (Rubric) ${L.worksheet_rubric.title}`, L.worksheet_rubric.criteria),
    { t: "br" },
    ...scoreSheet("แบบสังเกตพฤติกรรมรายบุคคล", "ให้ครูสังเกตพฤติกรรมของนักเรียนระหว่างเรียนและลงคะแนนในช่องที่ตรงกับพฤติกรรมของนักเรียน", L.behavior_rubric.map(c => c[0])),
    ...rubric("รายละเอียดเกณฑ์การให้คะแนน (Rubric) แบบสังเกตพฤติกรรมรายบุคคล", L.behavior_rubric),
  ];
}
function modelForm(F, S) {
  return [
    { t: "br" },
    ...scoreSheet(F.form, F.form_intro, F.criteria.map((c, k) => `${k + 1}. ${c}`)),
    ...rubric(F.rubric_title, S.rubric.map((r, k) => [`${k + 1}. ${F.criteria[k]}`, ...r])),
  ];
}
const opinion = (who, role) => [h(`ความคิดเห็นของ${who}`), ...dots(3, 1), { t: "sign", role, blank: 1 }];   // ผู้ลงนามอื่น: เว้นชื่อว่าง

// ---------- การ์ดเคสคนไข้ (การ์ดสีมีภาพ พิมพ์หน้าละ 2 ใบ) + เฉลยสำหรับครู ----------
// ภาพ (SVG) และข้อความมาจาก content/lesson-plans/<slug>.json → cases[] (เนื้อหาที่เราเขียนเอง ไม่ใช่ข้อมูลผู้ใช้)
const ICON_PIN = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" fill="currentColor"/></svg>';
const ICON_STETH = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M6 3v6a5 5 0 0 0 10 0V3"/><path d="M11 14v2a4 4 0 0 0 8 0v-3"/><circle cx="19" cy="11" r="2"/></svg>';
const ICON_BOLT = '<svg viewBox="0 0 22 22" width="16" height="16"><path d="M13 1 3 13h7l-2 8 11-13h-7z" fill="#F0A04B"/></svg>';
const LEVEL = ["", "ง่าย", "ปานกลาง", "ท้าทาย"];
function caseCard(c, n, L) {
  const e = x => esc(fill(x, L));
  const dots = [1, 2, 3].map(k => `<i${k <= c.level ? ' class="on"' : ""}></i>`).join("");
  return `<div class="lpc" style="--c:${c.color}">`
    + `<div class="lpc-h"><div><small>การ์ดเคสคนไข้</small><b>เคสที่ ${n}</b></div><span class="lpc-team">${ICON_STETH}ทีมหมอหลอดไฟ</span></div>`
    + `<div class="lpc-b"><div class="lpc-art">${c.art.replaceAll('font-family="Prompt,', 'font-family="PromptDoc,Prompt,').replaceAll('font-family="Sarabun,', 'font-family="SarabunDoc,Sarabun,')}<div class="lpc-cap">${e(c.caption)}</div></div>`
    + `<div class="lpc-info"><div class="lpc-place">${ICON_PIN}<span>สถานที่: <b>${e(c.place)}</b></span></div>`
    + `<div class="lpc-sym"><small>อาการสำคัญ</small><b>${e(c.symptom)}</b></div>`
    + `<div class="lpc-his"><small>ประวัติจากผู้แจ้ง</small>${c.history.map((x, k) => `<div><span>${k + 1}</span>${e(x)}</div>`).join("")}</div>`
    + `<div class="lpc-lv">ระดับความยาก <span>${dots}</span> <b>${LEVEL[c.level]}</b></div></div></div>`
    + `<div class="lpc-steps">${[["วินิจฉัย", "สาเหตุน่าจะเป็นอะไร"], ["วางแผนตรวจ", "จากจุดง่ายไปจุดยาก"], ["ตัดสินใจ", "ซ่อม หรือ เปลี่ยนใหม่"]]
      .map(([a, b], k) => `<div><span>${k + 1}</span><p><b>${a}</b>${b}</p></div>`).join("")}</div>`
    + `<div class="lpc-f">${ICON_BOLT}ตัดไฟหรือถอดปลั๊กก่อนตรวจทุกครั้ง · บันทึกคำตอบลงใบงาน "หมอหลอดไฟ" ส่วนที่ 2</div></div>`;
}
function caseBlocks(L) {
  const cards = L.cases.map((c, k) => ({ t: "html", x: caseCard(c, k + 1, L) }));
  const cut = { t: "html", x: '<div class="lpc-cut"><span>ตัดตามเส้นประ</span></div>' };
  const out = [];
  cards.forEach((c, k) => { out.push(k % 2 ? cut : { t: "br" }, c); });
  const rows = L.cases.map((c, k) => `<tr><td class="n">${k + 1}</td><td>${esc(c.cause)}</td><td>${esc(c.fix)}</td></tr>`).join("");
  out.push({ t: "br" }, {
    t: "html", x: `<div class="lpc-key"><h3>เฉลยการ์ดเคสคนไข้ (สำหรับครู)</h3>`
      + `<table><thead><tr><th>เคส</th><th>สาเหตุที่น่าจะเป็น</th><th>แนวทางแก้ไข</th></tr></thead><tbody>${rows}</tbody></table>`
      + `<div class="lpc-tip"><b>วิธีใช้:</b> พิมพ์การ์ดบนกระดาษ A4 สี ตัดตามเส้นประ ได้การ์ดขนาดประมาณ A5 แจกกลุ่มละ 1 ใบ ถ้ามีมากกว่า ${L.cases.length} กลุ่มให้ใช้เคสซ้ำได้ `
      + `เคสระดับ "ท้าทาย" เหมาะกับกลุ่มที่ทำงานเสร็จเร็ว</div></div>`,
  });
  return out;
}

// ---------- รูปแบบที่ 1: PhenoBL (ตามไฟล์ต้นฉบับของเจ้าของ) ----------
function phenobl(L, F, S, X) {
  const head = [
    { t: "box", x: ["แผนการจัดการเรียนรู้ระดับปฏิบัติการ", F.title_line, `ของนักเรียนชั้น${L.grade_full}`] },
    { t: "p", x: `**${L.learning_area} ชั้น${L.grade_full}**` },
    { t: "p", x: `**หน่วยการเรียนรู้ที่ ${L.unit_no} ${L.unit_title} รายวิชา${L.subject} (${L.course_code})**` },
    { t: "p", x: `**แผนการจัดการเรียนรู้ที่ ${L.plan_no} เรื่อง ${L.title} เวลา ${X.time}**` },
    { t: "p", x: "**ผู้สอน {{teacher}} ภาคเรียนที่ {{term}} / {{year}}**" },
  ];
  const preview = [
    ...head,
    h("1. มาตรฐานการเรียนรู้"),
    ...L.standards.flatMap(s => [p(s.std), p("ตัวชี้วัด", 1), ...s.indicators.map(x => p(x, 2))]),
    h("2. สาระสำคัญ"), p(L.essence, 1),
    h("3. จุดประสงค์การเรียนรู้"),
    p(`เมื่อนักเรียนเรียนรู้เรื่อง "${L.title}" แล้ว นักเรียนสามารถ`, 1),
    ...L.objectives.map((x, k) => p(`3.${k + 1} ${x}`, 1)),
    h("4. สาระการเรียนรู้"),
    p("4.1 ด้านองค์ความรู้ (Knowledge)", 1), ...lines(L.knowledge, L, 2),
    p("4.2 ด้านทักษะและกระบวนการ (Process)", 1),
    p(`1) ${F.process_head}`, 2), ...F.criteria.map((c, k) => p(`1.${k + 1} ${c}`, 3)),
    ...L.process_extra.map((x, k) => p(`${k + 2}) ${x}`, 2)),
    p("4.3 ด้านเจตคติ (Attitude)", 1), ...lines(L.attitude, L, 2),
  ];
  const locked = [
    h(F.section5),
    { t: "p", x: `**${X.periodLabel} (${X.total} นาที)**`, i: 1, b: 1 },
    ...S.steps.flatMap(s => [{ t: "p", x: `**${s.label.join(" ")}** (${s.minutes} นาที)`, i: 1, b: 1 }, ...lines(s.lines, L, 1)]),
    h("6. สื่อการเรียนรู้"),
    ...X.materials.map((x, k) => p(`6.${k + 1} ${x}`, 1)), X.qr,
    h("7. การวัดและประเมินผล"),
    { t: "tbl", w: [34, 20, 28, 18], head: [["สิ่งที่จะวัด", "วิธีการวัด", "เครื่องมือที่ใช้วัด", "เกณฑ์วัด"]], rows: X.assess },
    h("8. บันทึกหลังการจัดการเรียนรู้"),
    ...["8.1 ด้านแผนการจัดการเรียนรู้", "8.2 ด้านพฤติกรรมครู", "8.3 ด้านพฤติกรรมนักเรียนและผลการเรียนรู้", "8.4 อุปสรรค ปัญหา และข้อเสนอแนะ"].flatMap(x => [p(x, 1), ...dots(2)]),
    sign("ผู้สอน"),
    ...sharedForms(L), ...modelForm(F, S),
    { t: "br" },
    { t: "p", x: "**แบบสรุปผลลัพธ์การเรียนรู้ของผู้เรียน**", c: 1, b: 1 },
    {
      t: "tbl", sm: 1, w: [6, 22, 11, 9, 11, 9, 11, 9, 6, 6],
      head: [
        [{ x: "เลขที่", rs: 2 }, { x: "ชื่อ-สกุล", rs: 2 }, { x: "ด้านความรู้ (K)", cs: 2 }, { x: "ด้านกระบวนการ (P)", cs: 2 }, { x: "ด้านเจตคติ (A)", cs: 2 }, { x: "สรุปผลการประเมิน", cs: 2 }],
        ["พฤติกรรมรายบุคคล (15)", "ผลการประเมิน", "คะแนนใบงาน (12)", "ผลการประเมิน", "พฤติกรรมรายบุคคล (15)", "ผลการประเมิน", "ผ่าน", "ไม่ผ่าน"],
      ],
      rows: Array.from({ length: 20 }, (_, k) => [String(k + 1), "", "", "", "", "", "", "", "", ""]),
    },
    sign("ครูผู้สอน/ผู้ประเมิน"),
    { t: "br" },
    head[0],
    { t: "p", x: "**แบบบันทึกกิจกรรมการเรียนการสอน**", c: 1, b: 1 },
    { t: "p", x: `**แผนการจัดการเรียนรู้ที่ ${L.plan_no} เรื่อง ${L.title} เวลา ${X.total} นาที**` },
    { t: "p", x: "**ผู้สอน {{teacher}} สอนวันที่....../......../{{year}}**" },
    h("1. การจัดกิจกรรมการเรียนการสอนบรรลุเป้าหมายของบทเรียนในกิจกรรมนั้น (Aim of the Lesson)"), ...dots(2),
    h(F.log_q2),
    { t: "tbl", w: [30, 70], tall: 1, head: [["ขั้นตอนการจัดการเรียนรู้", "แนวคิดของนักเรียน"]], rows: S.steps.map(s => [s.label.join("\n"), ""]) },
    h("3. แนวทางการพัฒนาชั้นเรียน/ข้อเสนอแนะ"), ...dots(2),
    sign("ผู้สอน"),
    ...X.appendix,
  ];
  return { preview, locked };
}

// ---------- รูปแบบที่ 2: Active Learning (ออกแบบย้อนกลับ: เป้าหมาย → หลักฐาน → กิจกรรมแยกบทบาทครู/นักเรียน) ----------
function active(L, F, S, X) {
  const info = {
    t: "tbl", w: [22, 28, 22, 28], rows: [
      ["**กลุ่มสาระการเรียนรู้**", L.learning_area.replace(/^กลุ่มสาระการเรียนรู้/, ""), "**รายวิชา / รหัสวิชา**", `${L.subject} / ${L.course_code}`],
      ["**ชั้น**", L.grade_full, "**เวลา**", X.time],
      ["**หน่วยการเรียนรู้ที่**", `${L.unit_no} ${L.unit_title}`, "**เรื่อง**", L.title],
      ["**ผู้สอน**", "{{teacher}}", "**ภาคเรียน / ปีการศึกษา**", "{{term}} / {{year}}"],
    ],
  };
  const preview = [
    { t: "box", x: [`แผนการจัดการเรียนรู้ที่ ${L.plan_no}`, F.title_line, `เรื่อง ${L.title}`] },
    info,
    h("ส่วนที่ 1 เป้าหมายการเรียนรู้ (Learning Goals)"),
    p("**1.1 มาตรฐานการเรียนรู้และตัวชี้วัด**", 1),
    ...L.standards.flatMap(s => [p(s.std, 2), ...s.indicators.map(x => p(`- ${x}`, 2))]),
    p("**1.2 สาระสำคัญ (Big Idea)**", 1), p(L.essence, 2),
    p("**1.3 จุดประสงค์การเรียนรู้**", 1),
    ...L.objectives.map((x, k) => p(`${["ด้านความรู้ (K)", "ด้านทักษะ/กระบวนการ (P)", "ด้านเจตคติ (A)"][k] ?? ""} : ${stripKPA(x)}`, 2)),
    p("**1.4 สาระการเรียนรู้**", 1), ...lines(L.knowledge, L, 2),
    p("**1.5 ทักษะที่มุ่งพัฒนา**", 1),
    ...F.criteria.map(c => p(`- ${c}`, 2)), ...L.process_extra.map(c => p(`- ${c}`, 2)),
    h("ส่วนที่ 2 หลักฐานการเรียนรู้ (Evidence of Learning)"),
    {
      t: "tbl", w: [22, 34, 44], head: [["ประเภท", "หลักฐาน", "เครื่องมือ / เกณฑ์"]],
      rows: L.evidence.map(e => [e[0], e[1], e[2]]),
    },
  ];
  const locked = [
    h("ส่วนที่ 3 กิจกรรมการเรียนรู้เชิงรุก (Active Learning)"),
    {
      t: "tbl", w: [17, 33, 33, 17], head: [["ขั้นตอน / เวลา", "บทบาทครู", "บทบาทนักเรียน", "สื่อ / การประเมิน"]],
      rows: S.steps.map(s => [`**${s.label[0]}**\n${s.label[1]}\n${s.label[2]}\n(${s.minutes} นาที)`, s.teacher.join("\n"), s.student.join("\n"), s.media.join("\n")]),
    },
    h("ส่วนที่ 4 สื่อและแหล่งเรียนรู้"),
    ...X.materials.map((x, k) => p(`${k + 1}. ${x}`, 1)), X.qr,
    h("ส่วนที่ 5 การวัดและประเมินผล"),
    { t: "tbl", w: [34, 20, 28, 18], head: [["จุดประสงค์", "วิธีการ", "เครื่องมือ", "เกณฑ์การผ่าน"]], rows: X.assess },
    h("ส่วนที่ 6 บันทึกหลังการสอน (After Action Review)"),
    {
      t: "tbl", w: [28, 72], tall: 1, head: [["ประเด็น", "ผลที่เกิดขึ้น"]],
      rows: [["ผลการเรียนรู้ด้านความรู้ (K)", ""], ["ผลการเรียนรู้ด้านทักษะ/กระบวนการ (P)", ""], ["ผลการเรียนรู้ด้านเจตคติ (A)", ""],
             ["สิ่งที่เป็นไปตามแผน / ไม่เป็นไปตามแผน", ""], ["ปัญหาและแนวทางพัฒนาครั้งต่อไป", ""]],
    },
    sign("ผู้สอน"),
    ...opinion("หัวหน้ากลุ่มสาระการเรียนรู้", "หัวหน้ากลุ่มสาระการเรียนรู้"),
    ...opinion("ผู้บริหารสถานศึกษา", "ผู้อำนวยการโรงเรียน"),
    ...sharedForms(L), ...modelForm(F, S),
    ...X.appendix,
    ...lines(S.appendix ?? [], L),
  ];
  return { preview, locked };
}

// ---------- รูปแบบที่ 3: 5E (แบบฟอร์มแผนมาตรฐาน 10 หัวข้อ) ----------
function fiveE(L, F, S, X) {
  const preview = [
    { t: "box", x: [`แผนการจัดการเรียนรู้ที่ ${L.plan_no}`, `หน่วยการเรียนรู้ที่ ${L.unit_no} ${L.unit_title}`] },
    { t: "p", x: `**${L.learning_area}**   **รายวิชา${L.subject}**   **รหัสวิชา ${L.course_code}**` },
    { t: "p", x: `**ชั้น${L.grade_full}**   **เรื่อง ${L.title}**   **เวลา ${X.time}**` },
    { t: "p", x: "**ภาคเรียนที่ {{term}} ปีการศึกษา {{year}}**   **ผู้สอน {{teacher}}**" },
    { t: "p", x: `**รูปแบบการสอน** ${F.full} (5E Inquiry-based Learning)` },
    h("1. สาระสำคัญ / ความคิดรวบยอด"), p(L.essence, 1),
    h("2. มาตรฐานการเรียนรู้ / ตัวชี้วัด"),
    ...L.standards.flatMap(s => [p(s.std, 1), ...s.indicators.map(x => p(x, 2))]),
    h("3. จุดประสงค์การเรียนรู้"),
    ...L.objectives.map((x, k) => p(`3.${k + 1} ${["ด้านความรู้ (K)", "ด้านทักษะ/กระบวนการ (P)", "ด้านคุณลักษณะ (A)"][k] ?? ""} ${stripKPA(x)}`, 1)),
    h("4. สาระการเรียนรู้"), ...lines(L.knowledge, L, 1),
    h("5. สมรรถนะสำคัญของผู้เรียน"), ...L.competencies.map((c, k) => p(`5.${k + 1} ${c}`, 1)),
    h("6. คุณลักษณะอันพึงประสงค์"), ...L.traits.map((c, k) => p(`6.${k + 1} ${c}`, 1)),
  ];
  const locked = [
    h("7. กิจกรรมการเรียนรู้ (รูปแบบการสอนแบบสืบเสาะหาความรู้ 5E)"),
    ...S.steps.flatMap(s => [{ t: "p", x: `**${s.label.join(" ")}** (${s.minutes} นาที)`, i: 1, b: 1 }, ...lines(s.lines, L, 1)]),
    h("8. สื่อการเรียนรู้ / แหล่งเรียนรู้"),
    ...X.materials.map((x, k) => p(`8.${k + 1} ${x}`, 1)), X.qr,
    h("9. การวัดและประเมินผล"),
    { t: "tbl", w: [34, 20, 28, 18], head: [["จุดประสงค์การเรียนรู้", "วิธีการวัด", "เครื่องมือที่ใช้", "เกณฑ์การประเมิน"]], rows: X.assess },
    h("10. บันทึกหลังการจัดการเรียนรู้"),
    p("10.1 ผลการจัดการเรียนรู้", 1),
    p("นักเรียนทั้งหมด ........ คน ผ่านจุดประสงค์ ........ คน คิดเป็นร้อยละ ........ ไม่ผ่าน ........ คน คิดเป็นร้อยละ ........", 2),
    p("10.2 ปัญหา / อุปสรรค", 1), ...dots(2, 2),
    p("10.3 แนวทางแก้ไข / ข้อเสนอแนะ", 1), ...dots(2, 2),
    sign("ผู้สอน"),
    ...opinion("หัวหน้ากลุ่มสาระการเรียนรู้", "หัวหน้ากลุ่มสาระการเรียนรู้"),
    ...opinion("รองผู้อำนวยการฝ่ายวิชาการ", "รองผู้อำนวยการฝ่ายวิชาการ"),
    ...opinion("ผู้อำนวยการสถานศึกษา", "ผู้อำนวยการโรงเรียน"),
    ...sharedForms(L), ...modelForm(F, S),
    { t: "br" },
    ...scoreSheet("แบบประเมินคุณลักษณะอันพึงประสงค์", "ให้ครูประเมินคุณลักษณะของนักเรียนระหว่างเรียนและลงคะแนนในช่องที่ตรงกับพฤติกรรมของนักเรียน", L.traits.map((t, k) => `${k + 1}. ${t.split(" ")[0]}`)),
    ...X.appendix,
    ...lines(S.appendix ?? [], L),
  ];
  return { preview, locked };
}

const TEMPLATES = { phenobl, active, "5e": fiveE };

async function build(slug) {
  const L = JSON.parse(fs.readFileSync(path.join(DIR, `${slug}.json`), "utf8"));
  const mediaUrl = `${SITE}/prep/media/${slug}/`;
  const qrSvg = await QRCode.toString(mediaUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
  const formats = {};

  for (const [key, F0] of Object.entries(FORMATS)) {
    const S = L.formats[key];
    if (!S) continue;
    const F = Object.fromEntries(Object.entries(F0).map(([k, v]) => [k, typeof v === "string" ? fill(v, L) : v.map(x => fill(x, L))]));
    const total = S.steps.reduce((s, x) => s + x.minutes, 0);
    if (total !== L.minutes * L.periods) throw new Error(`${slug}/${key}: เวลารวม ${total} นาที ไม่เท่ากับ ${L.minutes * L.periods}`);
    if (S.rubric.length !== F.criteria.length) throw new Error(`${slug}/${key}: rubric ${S.rubric.length} ข้อ แต่รูปแบบมี ${F.criteria.length} เกณฑ์`);
    const X = {
      total,
      time: L.periods > 1 ? `${L.periods} คาบเรียน (${total} นาที)` : `1 คาบเรียน (${L.minutes} นาที)`,
      periodLabel: L.periods > 1 ? `คาบที่ 1–${L.periods}` : "คาบที่ 1",
      materials: [...L.materials.map(x => fill(x, L)), `สื่อออนไลน์: ${L.media.title}`],
      qr: { t: "qr", svg: qrSvg, x: L.media.caption, url: mediaUrl },
      assess: L.assessment.map(r => r.map(c => c.replace("{{model_form}}", F.form))),
      appendix: lines(L.appendix, L),
    };
    const { preview, locked } = TEMPLATES[key](L, F, S, X);
    formats[key] = {
      name: F.name, full: F.full, desc: F.desc,
      steps: S.steps.map(s => ({ name: s.label.join(" "), minutes: s.minutes })),
      preview, locked,
    };
  }

  writeMedia(slug, L, mediaUrl);
  return { L, formats, mediaUrl };
}

// ---------- หน้าสื่อออนไลน์ (static) ----------
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const inline = s => esc(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
// หน้าสื่อที่ออกแบบเอง (มีภาพประกอบ) อยู่ที่ content/lesson-plans/media/<slug>.html → คัดลอกตามนั้น
// ถ้าไม่มี สร้างหน้าข้อความธรรมดาจากหัวข้อ knowledge ให้
function writeMedia(slug, L, url) {
  const custom = path.join(DIR, "media", `${slug}.html`);
  if (fs.existsSync(custom)) {
    const dir = path.join(ROOT, "public/prep/media", slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(custom, path.join(dir, "index.html"));
    return;
  }
  const body = L.knowledge.map(item => {
    if (typeof item === "string") {
      const lead = item.match(/^ */)[0].length;
      const s = item.trim();
      if (!lead && /^\d+\.\s/.test(s)) return `<h2>${inline(s)}</h2>`;
      return `<p class="i${Math.floor(lead / 2)}">${inline(s)}</p>`;
    }
    if (item.table) {
      const t = item.table;
      const tr = (r, tag) => `<tr>${r.map(c => `<${tag}>${inline(String(c)).replace(/\n/g, "<br>")}</${tag}>`).join("")}</tr>`;
      return `<div class="tw"><table>${(t.head ?? []).map(r => tr(r, "th")).join("")}${t.rows.map(r => tr(r, "td")).join("")}</table></div>`;
    }
    return "";
  }).join("\n");
  const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(L.media.title)}</title>
<meta name="description" content="${esc(`ใบความรู้ ${L.subject} ${L.grade} หน่วยที่ ${L.unit_no} ${L.unit_title} เรื่อง ${L.title}`)}">
<link rel="canonical" href="${url}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
<style>
:root{--ink:#1f1a17;--muted:#6b625c;--line:#e7ddd5;--brand:#b4232c;--bg:#fbf8f5;--card:#fff}
@media (prefers-color-scheme:dark){:root{--ink:#f1ece8;--muted:#b9afa8;--line:#3a332f;--brand:#f0636b;--bg:#171412;--card:#211d1a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.7 Sarabun,system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:20px 16px 48px}
.k{font-size:13px;color:var(--brand);font-weight:700;letter-spacing:.02em}
h1{font-size:24px;line-height:1.35;margin:4px 0 6px}.meta{color:var(--muted);font-size:14px;margin-bottom:18px}
h2{font-size:19px;margin:26px 0 8px;padding-top:14px;border-top:1px solid var(--line)}
p{margin:6px 0}.i1{padding-left:18px}.i2{padding-left:36px}
.tw{overflow-x:auto;margin:10px 0}table{border-collapse:collapse;width:100%;min-width:520px;background:var(--card);font-size:15px}
th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}th{background:color-mix(in srgb,var(--brand) 10%,var(--card))}
</style></head><body><main>
<div class="k">ใบความรู้ · ${esc(L.subject)} ${esc(L.grade)}</div>
<h1>${esc(L.title)}</h1>
<div class="meta">หน่วยการเรียนรู้ที่ ${L.unit_no} ${esc(L.unit_title)} · รายวิชา${esc(L.subject)} (${esc(L.course_code)})</div>
${body}
</main></body></html>
`;
  const dir = path.join(ROOT, "public/prep/media", slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
}

// ---------- SQL ----------
const q = s => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const dollar = obj => { const j = JSON.stringify(obj); if (j.includes("$lp$")) throw new Error("$lp$ in content"); return `$lp$${j}$lp$::jsonb`; };

const parts = [`-- สร้างโดย scripts/prep/lesson_plans/build.mjs — อย่าแก้มือ แก้ที่ content/lesson-plans/*.json แล้วรันใหม่
-- upsert ตาม slug: รันซ้ำได้; แผนใหม่ = ยังไม่เผยแพร่ (แอดมินตรวจแล้วกดเผยแพร่ในแอป); อัปเดตแผนเดิมไม่เปลี่ยนสถานะเผยแพร่
`];
for (const slug of slugs) {
  const { L, formats, mediaUrl } = await build(slug);
  parts.push(`insert into prep.lesson_plans (slug, grp, subject, course_code, grade, unit_no, unit_title, plan_no, title, periods, minutes, summary, price, sort, media_url, formats, published)
values (${q(slug)}, ${q(L.group)}, ${q(L.subject)}, ${q(L.course_code)}, ${q(L.grade)}, ${L.unit_no}, ${q(L.unit_title)}, ${L.plan_no}, ${q(L.title)}, ${L.periods}, ${L.minutes}, ${q(L.summary)}, ${L.price}, ${L.sort}, ${q(mediaUrl)},
  ${dollar(formats)}, false)
on conflict (slug) do update set grp = excluded.grp, subject = excluded.subject, course_code = excluded.course_code, grade = excluded.grade,
  unit_no = excluded.unit_no, unit_title = excluded.unit_title, plan_no = excluded.plan_no, title = excluded.title, periods = excluded.periods,
  minutes = excluded.minutes, summary = excluded.summary, price = excluded.price, sort = excluded.sort, media_url = excluded.media_url,
  formats = excluded.formats, updated_at = now();
`);
  console.log(`${slug}: ${Object.keys(formats).join(", ")}`);
}
fs.writeFileSync(path.isAbsolute(out) ? out : path.join(ROOT, out), parts.join("\n"));
console.log("wrote", out);
