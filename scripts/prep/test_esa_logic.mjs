// Unit tests for the helpers of prep-esa-watch (node scripts/prep/test_esa_logic.mjs, from the repo root).
import ts from 'typescript';
import fs from 'fs';
const src = fs.readFileSync('supabase/functions/prep-esa-watch/logic.ts', 'utf8');
fs.writeFileSync('/tmp/prep_esa_logic.mjs', ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText);
const L = await import('/tmp/prep_esa_logic.mjs');
let n = 0, bad = 0; const t = (name, c) => { n++; if (!c) { bad++; console.log('FAIL', name); } };

// คัดหัวข้อ
t('ภาค ค', L.isRecruit('ประกาศรายชื่อผู้มีสิทธิเข้ารับการประเมิน ภาค ค ตำแหน่งครูผู้ช่วย สังกัด สพฐ. ปี พ.ศ. 2569'));
t('ผู้ผ่าน', L.isRecruit('ประกาศ สพป.จันทบุรี เขต 2 เรื่อง รายชื่อผู้ผ่านการเลือกสรรเป็นครูผู้ช่วย กรณีทั่วไป'));
t('รายงานตัว', L.isRecruit('เรียกผู้สอบแข่งขันได้รายงานตัวเพื่อบรรจุและแต่งตั้ง'));
t('รายงานตัว topic', L.topicOf('เรียกผู้สอบแข่งขันได้รายงานตัวเพื่อบรรจุและแต่งตั้ง') === 'report');
t('ลูกจ้างไม่เอา', !L.isRecruit('รับสมัครลูกจ้างชั่วคราว ตำแหน่งครูผู้ช่วย (อัตราจ้าง)'));
t('พนักงานราชการไม่เอา', !L.isRecruit('ประกาศรับสมัครพนักงานราชการ ตำแหน่งครูผู้ช่วย'));
t('ข่าวทั่วไปไม่เอา', !L.isRecruit('ผอ.สพป. ประชุมผู้บริหารสถานศึกษา ครั้งที่ 2/2569'));
t('ขึ้นบัญชี', L.isRecruit('ประกาศขึ้นบัญชีผู้สอบแข่งขันได้ ตำแหน่งครูผู้ช่วย'));
// ชนิด
t('topic eligible', L.topicOf('รายชื่อผู้มีสิทธิเข้ารับการประเมิน ภาค ค') === 'eligible');
t('topic result', L.topicOf('ประกาศผลการสอบแข่งขัน ครูผู้ช่วย') === 'result');
t('topic report', L.topicOf('เรียกผู้สอบแข่งขันได้รายงานตัว') === 'report');
t('topic apply', L.topicOf('ประกาศรับสมัครสอบแข่งขัน ครูผู้ช่วย') === 'apply');
t('ผู้สอบผ่าน = result', L.topicOf('รายชื่อผู้สอบผ่านภาค ก และ ภาค ข เพื่อมีสิทธิเข้ารับการประเมิน ภาค ค การสอบแข่งขัน') === 'result');
t('ห้องสอบ = other', L.topicOf('ประกาศ เรื่อง อาคารและห้องสอบแข่งขันเพื่อบรรจุ ครูผู้ช่วย') === 'other');
t('ข่าวกิจกรรมไม่เอา', !L.isRecruit('สพม.ชลบุรี ระยอง ลงพื้นที่ตรวจเยี่ยมและให้กำลังใจผู้เข้าสอบ "ครูผู้ช่วย" ภาค ข ปี 2569'));
t('ประชุมไม่เอา', !L.isRecruit('ประชุมซักซ้อมความเข้าใจการสอบแข่งขันครูผู้ช่วย สังกัด สพฐ. ปี 2569'));
t('พัฒนาอย่างเข้มไม่เอา', !L.isRecruit('ประกาศรายชื่อผู้เข้ารับการประเมินเตรียมความพร้อมและพัฒนาอย่างเข้ม ตำแหน่งครูผู้ช่วย'));
t('ไม่มีคำว่าประกาศไม่เอา', !L.isRecruit('สรรหาข้าราชการครูและบุคลากรทางการศึกษาตำแหน่งครูผู้ช่วย ภาค ข'));
t('ชื่อการสอบไม่ใช่เรียกบรรจุ', L.topicOf('ประกาศ อ.ก.ค.ศ. เรื่อง รายชื่อผู้ผ่านภาค ก และ ภาค ข เพื่อมีสิทธิเข้ารับการประเมินภาค ค ในการสอบแข่งขันเพื่อบรรจุและแต่งตั้ง') === 'result');
t('topic result beats eligible', L.topicOf('ประกาศรายชื่อผู้ผ่านการประเมิน ภาค ค (ผู้มีสิทธิ)') === 'result');

// charset
t('tis-620 header', L.charsetOf('text/html; charset=TIS-620', '') === 'windows-874');
t('meta charset', L.charsetOf('text/html', '<meta http-equiv="Content-Type" content="text/html; charset=windows-874">') === 'windows-874');
t('utf8 default', L.charsetOf(null, '<html>') === 'utf-8');

// RSS
const rss = `<?xml version="1.0"?><rss version="2.0"><channel><title>สพม.นครพนม</title>
<item><title><![CDATA[ประกาศรายชื่อผู้ผ่านการประเมิน ภาค ค ตำแหน่งครูผู้ช่วย &amp; บัญชี]]></title><link>https://www.sesaonkp.go.th/archives/43995</link><pubDate>Tue, 17 Nov 2026 08:10:00 +0000</pubDate></item>
<item><title>กิจกรรมวันลอยกระทง</title><link>https://www.sesaonkp.go.th/archives/43990</link></item></channel></rss>`;
t('isRss', L.isRss('application/rss+xml; charset=UTF-8', rss));
t('isRss html no', !L.isRss('text/html', '<html><body>rss</body></html>'));
const items = L.parseFeed(rss, 'https://www.sesaonkp.go.th/');
t('feed 2 items', items.length === 2);
t('feed cdata+entity', items[0].title === 'ประกาศรายชื่อผู้ผ่านการประเมิน ภาค ค ตำแหน่งครูผู้ช่วย & บัญชี');
t('feed date', items[0].posted_at === '2026-11-17T08:10:00.000Z');
t('feed filter', L.recruitItems(items).length === 1);
const atom = `<feed><entry><title>ประกาศผลการสอบแข่งขัน ครูผู้ช่วย</title><link href="/news/1"/><updated>2026-11-18T01:00:00Z</updated></entry></feed>`;
t('atom', L.parseFeed(atom, 'https://x.go.th/')[0]?.url === 'https://x.go.th/news/1');

// HTML
const html = `<ul><li><a href="/news.php?id=12">ประกาศรายชื่อผู้มีสิทธิเข้ารับการประเมิน ภาค ค ครูผู้ช่วย</a></li>
<li><a href="news.php?id=12">ประกาศรายชื่อผู้มีสิทธิเข้ารับการประเมิน ภาค ค ครูผู้ช่วย</a></li>
<li><a href="javascript:void(0)">ประกาศ สอบแข่งขันครูผู้ช่วย (ลิงก์เสีย)</a></li>
<li><a href="#top">ขึ้นบน</a></li><li><a href="/a.pdf" title="ประกาศเรียกบรรจุและแต่งตั้ง ครูผู้ช่วย"><img src="x.png"></a></li></ul>`;
const hi = L.parseHtmlLinks(html, 'https://www.chan2.go.th/');
t('html dedupe + abs', hi.length === 2 && hi[0].url === 'https://www.chan2.go.th/news.php?id=12');
t('html img title', hi[1].title === 'ประกาศเรียกบรรจุและแต่งตั้ง ครูผู้ช่วย');
t('html js link dropped', !hi.some((i) => i.url.startsWith('javascript')));
t('numeric entity', L.decodeEntities('&#3588;&#x0E23;') === 'คร');

// ข้อความ LINE
const rows = Array.from({ length: 60 }, (_, i) => ({ site: `สพป.ทดสอบ เขต ${i % 7}`, title: 'ประกาศรายชื่อผู้มีสิทธิเข้ารับการประเมิน ภาค ค ตำแหน่งครูผู้ช่วย สังกัดสำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน', url: `https://x${i}.go.th/archives/${i}`, topic: 'eligible' }));
const d = L.digestText(rows, 'https://sobprep.com/prep/news/');
t('digest under LINE limit', d.length < 5000);
t('digest counts', d.includes('60 เรื่อง') && d.includes('7 เขต') && d.includes('…และอีก'));
t('digest small', !L.digestText(rows.slice(0, 2), '').includes('…และอีก'));

console.log(`${n - bad}/${n} passed`);
if (bad) process.exit(1);
