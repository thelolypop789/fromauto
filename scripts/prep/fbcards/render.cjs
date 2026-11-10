// การ์ดอินโฟกราฟิกโพสต์เพจ SOBPREP (1080×1350) จาก cards.json → out/*.png
// node scripts/prep/fbcards/render.cjs   (ใช้ Playwright + ฟอนต์ Prompt จาก Google Fonts, มาสคอตจาก src/prep/mascot)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const OUT = path.join(HERE, 'out');
const MASCOT = n => 'file://' + path.resolve(HERE, '../../../src/prep/mascot', n + '.webp');
const data = JSON.parse(fs.readFileSync(path.join(HERE, 'cards.json'), 'utf8'));
const L = ['ก', 'ข', 'ค', 'ง'];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const br = s => esc(s).replace(/\n/g, '<br>');
const pct = (c, i) => Math.round((100 * c[i]) / c.reduce((a, b) => a + b, 0));

const CSS = `
* { box-sizing: border-box; margin: 0; }
body { width: 1080px; height: 1350px; font-family: "Prompt", sans-serif; color: #FFF7E6; overflow: hidden;
  background: radial-gradient(130% 90% at 100% 0%, #A3263B 0%, #7C1728 45%, #4A0B16 100%); position: relative; }
body::before { content: ""; position: absolute; width: 760px; height: 760px; right: -300px; top: -320px; border-radius: 50%;
  background: radial-gradient(circle, rgba(243,217,138,.20), rgba(243,217,138,0) 65%); }
.wrap { position: absolute; inset: 0; padding: 64px 68px 56px; display: flex; flex-direction: column; }
.top { display: flex; justify-content: space-between; align-items: center; }
.brand { font-weight: 700; font-size: 34px; letter-spacing: 2px; color: #F3D98A; }
.brand small { display: block; font-size: 22px; font-weight: 500; letter-spacing: 0; color: #FFF7E6; opacity: .8; }
.pill { font-size: 30px; font-weight: 600; padding: 10px 28px; border-radius: 99px; background: linear-gradient(160deg, #F6DE8D, #E5BE4E 55%, #C9A227); color: #4A0B16; }
.gold { color: #F3D98A; }
.foot { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.foot .cta { font-size: 32px; font-weight: 600; line-height: 1.35; }
.foot .cta small { display: block; font-size: 25px; font-weight: 500; opacity: .85; }
.mascot { width: 230px; height: 230px; object-fit: contain; filter: drop-shadow(0 16px 20px rgba(0,0,0,.35)); }
/* quiz */
.hero { margin-top: 40px; font-size: 46px; font-weight: 600; line-height: 1.2; }
.hero b { display: block; font-size: 128px; font-weight: 700; line-height: 1.05; color: #F3D98A; }
.topic { margin-top: 18px; font-size: 26px; opacity: .85; }
.qcard { margin-top: 26px; background: #FFF7E6; color: #3A0912; border-radius: 36px; padding: 40px 44px; box-shadow: 0 18px 40px rgba(0,0,0,.28); }
.stem { font-size: 38px; font-weight: 600; line-height: 1.42; }
.ch { margin-top: 22px; display: grid; gap: 14px; }
.ch div { font-size: 32px; line-height: 1.35; padding: 14px 22px; border-radius: 18px; background: #F5E7CC; display: flex; gap: 16px; }
.ch div b { color: #8E1B2E; min-width: 34px; }
/* answer */
.ans { margin-top: 36px; font-size: 44px; font-weight: 600; }
.ans b { font-size: 112px; color: #F3D98A; display: block; line-height: 1.05; }
.ans b.long { font-size: 52px; line-height: 1.3; margin-top: 8px; }
.bars { margin-top: 22px; display: grid; gap: 14px; }
.bar { display: grid; grid-template-columns: 52px 1fr 92px; grid-template-rows: auto 30px; align-items: center; column-gap: 16px; row-gap: 6px; font-size: 30px; }
.bar .lab { grid-row: 1 / 3; }
.bar .v { grid-row: 1 / 3; }
.bar .lab { font-weight: 700; text-align: center; }
.bar .track { grid-column: 2; grid-row: 2; height: 30px; border-radius: 4px; background: rgba(255,247,230,.12); position: relative; overflow: hidden; }
.bar .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 0 4px 4px 0; background: rgba(255,247,230,.42); }
.bar .txt { grid-column: 2; grid-row: 1; font-size: 26px; line-height: 1.3; color: #FFF7E6; opacity: .9; }
.bar.key .fill { background: linear-gradient(90deg, #E5BE4E, #F6DE8D); }
.bar.key .txt { color: #F3D98A; opacity: 1; font-weight: 600; }
.bar .v { text-align: right; font-weight: 600; }
.bar.key .v, .bar.key .lab { color: #F3D98A; }
.note { font-size: 24px; opacity: .75; margin-top: 10px; }
.why { margin-top: 26px; background: #FFF7E6; color: #3A0912; border-radius: 30px; padding: 32px 38px; font-size: 32px; line-height: 1.5; }
.why b { color: #8E1B2E; }
/* feature */
.kick { margin-top: 48px; display: inline-block; font-size: 36px; font-weight: 600; color: #F3D98A; }
.title { margin-top: 6px; font-size: 84px; font-weight: 700; line-height: 1.15; }
.stats { margin-top: 44px; display: grid; gap: 18px; }
.stat { display: flex; align-items: baseline; gap: 22px; background: rgba(255,247,230,.08); border: 2px solid rgba(243,217,138,.35); border-radius: 26px; padding: 22px 32px; }
.stat b { font-size: 76px; font-weight: 700; color: #F3D98A; min-width: 240px; line-height: 1; }
.stat span { font-size: 34px; font-weight: 500; }
.rows { margin-top: 30px; display: grid; gap: 12px; }
.rows div { font-size: 34px; display: flex; gap: 16px; align-items: center; }
.rows div::before { content: "✓"; color: #4A0B16; background: #F3D98A; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; font-size: 26px; font-weight: 700; flex: none; }
.steps { margin-top: 48px; display: grid; gap: 20px; }
.step { display: flex; gap: 26px; align-items: center; background: #FFF7E6; color: #3A0912; border-radius: 28px; padding: 26px 32px; }
.step i { font-style: normal; width: 84px; height: 84px; border-radius: 50%; flex: none; display: grid; place-items: center; font-size: 46px; font-weight: 700; background: #8E1B2E; color: #F3D98A; }
.step b { font-size: 44px; display: block; line-height: 1.2; }
.step span { font-size: 30px; color: #6E1423; }
.check { margin-top: 36px; display: grid; gap: 14px; }
.check div { font-size: 36px; background: #FFF7E6; color: #3A0912; border-radius: 22px; padding: 14px 26px; display: flex; gap: 20px; align-items: center; }
.check div::before { content: ""; width: 40px; height: 40px; border-radius: 10px; border: 4px solid #8E1B2E; flex: none; }
.sub { margin-top: 40px; font-size: 40px; line-height: 1.55; opacity: .95; }
.big { width: 470px; height: 470px; object-fit: contain; align-self: center; margin-top: auto; filter: drop-shadow(0 24px 30px rgba(0,0,0,.35)); }
`;

const head = (pill) => `<div class="top"><div class="brand">SOBPREP<small>ซ้อมสอบครูผู้ช่วย</small></div>${pill ? `<span class="pill">${esc(pill)}</span>` : ''}</div>`;
const page = body => `<!doctype html><html lang="th"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700&display=block" rel="stylesheet">
<style>${CSS}</style></head><body><div class="wrap">${body}</div></body></html>`;

function quizCard(q) {
  const p = pct(q.counts, q.answer);
  const n = q.counts.reduce((a, b) => a + b, 0);
  return page(`${head(`เหลือ ${q.left} วัน`)}
    <div class="hero">ข้อนี้คนตอบถูกแค่<b>${p}%</b></div>
    <div class="topic">${esc(q.topic)} · จากคนทำจริง ${n} คนในแอป</div>
    <div class="qcard"><div class="stem">${esc(q.stem)}</div>
      <div class="ch">${q.choices.map((c, i) => `<div><b>${L[i]}.</b><span>${esc(c)}</span></div>`).join('')}</div></div>
    <div class="foot"><div class="cta">คิดว่าข้อไหน? คอมเมนต์มาเลย<small>เฉลยพร้อมเหตุผล ตอนเที่ยงในคอมเมนต์</small></div>
      <img class="mascot" src="${MASCOT('none-think')}"></div>`);
}

function answerCard(q) {
  const n = q.counts.reduce((a, b) => a + b, 0);
  return page(`${head('เฉลย')}
    <div class="ans">เฉลยข้อ<b class="${q.choices[q.answer].length > 18 ? 'long' : ''}">${L[q.answer]}. ${esc(q.choices[q.answer])}</b></div>
    <div class="bars">${q.choices.map((c, i) => `<div class="bar ${i === q.answer ? 'key' : ''}"><span class="lab">${L[i]}</span>
      <span class="txt">${esc(c)}</span><span class="track"><span class="fill" style="width:${Math.max(2, pct(q.counts, i))}%"></span></span>
      <span class="v">${pct(q.counts, i)}%</span></div>`).join('')}</div>
    <div class="note">คนในแอปเลือกแต่ละข้อ (${n} คน)</div>
    <div class="why"><b>เพราะ</b> ${esc(q.why)}</div>
    <div class="foot"><div class="cta">ข้อแบบนี้มีอีก 12,000+ ข้อ<small>ลองฟรี 3 ชุด · sobprep.com</small></div>
      <img class="mascot" src="${MASCOT('teacher-happy')}"></div>`);
}

function featureCard(f) {
  let mid = '';
  if (f.stats) mid += `<div class="stats">${f.stats.map(([b, s]) => `<div class="stat"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join('')}</div>`;
  if (f.steps) mid += `<div class="steps">${f.steps.map(([b, s], i) => `<div class="step"><i>${i + 1}</i><div><b>${esc(b)}</b><span>${esc(s)}</span></div></div>`).join('')}</div>`;
  if (f.checklist) mid += `<div class="check">${f.checklist.map(c => `<div>${esc(c)}</div>`).join('')}</div>`;
  if (f.rows && f.rows.length) mid += `<div class="rows">${f.rows.map(r => `<div>${esc(r)}</div>`).join('')}</div>`;
  const cta = f.nosale ? 'ขอให้ทุกคนทำได้เต็มที่ครับ<small>สอบ ภาค ก เสาร์ 14 · ภาค ข อาทิตย์ 15 พ.ย.</small>'
    : 'ลองฟรี 3 ชุด ลิงก์ในคอมเมนต์<small>sobprep.com · LINE @701pvghq</small>';
  return page(`${head(f.nosale ? 'สอบพรุ่งนี้' : 'สอบ 14–15 พ.ย.')}
    <div class="kick">${esc(f.kicker)}</div><div class="title">${br(f.title)}</div>${mid}
    <div class="foot"><div class="cta">${cta}</div><img class="mascot" src="${MASCOT(f.mascot)}"></div>`);
}

function cheerCard(c) {
  return page(`${head('SOBPREP เป็นกำลังใจ')}
    <div class="kick">${esc(c.kicker)}</div><div class="title">${br(c.title)}</div>
    <div class="sub">${esc(c.sub)}</div><img class="big" src="${MASCOT(c.mascot)}">`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const jobs = [];
  for (const q of data.quiz) {
    jobs.push([`${q.day}-am-quiz.png`, quizCard(q)]);
    jobs.push([`${q.day}-am-answer.png`, answerCard(q)]);
  }
  for (const f of data.feature) jobs.push([f.file || `${f.day}-pm-${f.nosale ? 'checklist' : 'feature'}.png`, featureCard(f)]);
  for (const c of data.cheer) jobs.push([`${c.day}-${c.time.replace(':', '')}-cheer.png`, cheerCard(c)]);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  for (const [name, html] of jobs) {
    const tmp = path.join(OUT, '_card.html');
    fs.writeFileSync(tmp, html);
    await p.goto('file://' + tmp, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    // the card must fit: flag overflow instead of silently clipping
    const over = await p.evaluate(() => document.querySelector('.wrap').scrollHeight > 1350);
    await p.screenshot({ path: path.join(OUT, name) });
    console.log((over ? 'OVERFLOW ' : 'ok       ') + name);
  }
  fs.unlinkSync(path.join(OUT, '_card.html'));
  await b.close();
})();
