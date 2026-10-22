// Unit tests for the helpers of prep-gen-questions (node scripts/prep/test_gen_logic.mjs, run from the repo root).
import ts from 'typescript';
import fs from 'fs';
const src = fs.readFileSync('supabase/functions/prep-gen-questions/logic.ts', 'utf8');
fs.writeFileSync('/tmp/prep_gen_logic.mjs', ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText);
const L = await import('/tmp/prep_gen_logic.mjs');
let n = 0, bad = 0; const t = (name, c) => { n++; if (!c) { bad++; console.log('FAIL', name); } };
const ok = { level: 'apply', stem: 'ข้อใดเป็นการปฐมพยาบาลเบื้องต้นสำหรับแผลถลอก', choices: ['ล้างด้วยน้ำสะอาด', 'ทาน้ำปลา', 'ปิดด้วยใบไม้', 'ทิ้งไว้เฉยๆ'], answer: 0, explanation: 'ล้างแผลให้สะอาดก่อนเสมอ' };
t('valid draft kept', L.cleanDraft(ok).d?.answer === 0);
t('prefix stripped', L.cleanDraft({ ...ok, choices: ['ก. ล้างด้วยน้ำสะอาด', 'ข. ทาน้ำปลา', 'ค. ปิดด้วยใบไม้', 'ง. ทิ้งไว้เฉยๆ'] }).d?.choices[0] === 'ล้างด้วยน้ำสะอาด');
t('3 choices dropped', !!L.cleanDraft({ ...ok, choices: ['a', 'b', 'c'] }).drop);
t('duplicate choices dropped', !!L.cleanDraft({ ...ok, choices: ['ก', 'ก', 'ข', 'ค'] }).drop);
t('"all of the above" dropped', !!L.cleanDraft({ ...ok, choices: ['ล้างแผล', 'ทายา', 'พันผ้า', 'ถูกทุกข้อ'] }).drop);
t('section-number recall dropped', !!L.cleanDraft({ ...ok, stem: 'ตามมาตรา 5 ห้ามทำสิ่งใดต่อไปนี้ในสถานศึกษา' }).drop);
t('refers to picture dropped', !!L.cleanDraft({ ...ok, stem: 'จากรูปข้างต้น อวัยวะที่ระบุคืออะไร' }).drop);
t('answer out of range dropped', !!L.cleanDraft({ ...ok, answer: 4 }).drop);
t('missing explanation dropped', !!L.cleanDraft({ ...ok, explanation: '' }).drop);
t('unknown level -> remember', L.cleanDraft({ ...ok, level: 'x' }).d?.level === 'remember');
// shuffle keeps the key on its choice, for every random sequence
let keyOk = true;
for (let s = 0; s < 200; s++) {
  let x = s + 1; const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  const sh = L.shuffleChoices(ok, rnd);
  if (sh.choices[sh.answer] !== ok.choices[ok.answer] || new Set(sh.choices).size !== 4) keyOk = false;
}
t('shuffle keeps the key', keyOk);
const drafts = [ok, { ...ok, stem: 'ข้อสองที่มีเฉลยเป็นข้อแรก ใช่หรือไม่' }, { ...ok, stem: 'ข้อสามไม่แน่ใจ' }, { ...ok, stem: 'ข้อสี่ผู้ตรวจไม่ตอบ' }];
const r = L.accept(drafts, [{ id: 0, answer: 0, sound: true }, { id: 1, answer: 2, sound: true }, { id: 2, answer: 0, sound: false, issue: 'กำกวม' }]);
t('accept: only agreed + sound', r.kept.length === 1 && r.kept[0] === ok);
t('accept: reasons', r.rejected.length === 3 && r.rejected[1].why === 'กำกวม' && /ต่างจากเฉลย/.test(r.rejected[0].why) && /ไม่ตอบ/.test(r.rejected[2].why));
t('parseJson fenced', L.parseJson('```json\n{"a":1}\n```').a === 1);
t('parseJson with chatter', L.parseJson('นี่คือผล {"a":2} จบ').a === 2);
const w = { subtopic: 'B3-HEALTH-BODY', topic: 'B3-HEALTH', major: 'สุขศึกษา', name: 'ระบบอวัยวะ', kind: 'content', keywords: 'ระบบ', need: 5, stems: ['ข้อเก่า 1'], sibling_names: ['โรค', 'สุขภาพจิต'] };
t('prompt has the facts guard and old stems', /ห้ามแต่งตัวเลข/.test(L.generatePrompt(w, 10)) && /ข้อเก่า 1/.test(L.generatePrompt(w, 10)));
t('pedagogy prompt asks for classroom situations', /สถานการณ์ในห้องเรียน/.test(L.generatePrompt({ ...w, kind: 'pedagogy' }, 5)));
t('verify prompt hides the key', !/เฉลย:/.test(L.verifyPrompt(w, [ok])) && /\[0\]/.test(L.verifyPrompt(w, [ok])));
t('prompt asks for equal-length choices', /ยาวและละเอียดใกล้เคียงกัน/.test(L.generatePrompt(w, 5)));
t('obec major prompt keeps the old wording', L.generatePrompt(w, 5).startsWith('คุณเป็นผู้เขียนข้อสอบครูผู้ช่วย (ก.ค.ศ. ภาค ข วิชาเอกสุขศึกษา)') && /หลักสูตรแกนกลาง/.test(L.generatePrompt(w, 5)));
const wv = { ...w, major: 'ช่างไฟฟ้ากำลัง', grp: 'B3', track: 'vec', kind: 'pedagogy' };
t('vec prompt names สอศ. and ปวช./ปวส.', /สอศ\./.test(L.generatePrompt(wv, 5)) && /ปวช\. และ ปวส\./.test(L.generatePrompt(wv, 5)) && !/หลักสูตรแกนกลาง/.test(L.generatePrompt(wv, 5)) && /โรงฝึกงาน/.test(L.generatePrompt(wv, 5)));
t('vec verify prompt checks against the vocational curriculum', /ปวช\. และ ปวส\./.test(L.verifyPrompt(wv, [ok])));
t('non-major topic is a หมวด, not a วิชาเอก', /หมวดหลักสูตรอาชีวศึกษา/.test(L.generatePrompt({ ...wv, grp: 'B1', major: 'หลักสูตรอาชีวศึกษา' }, 5)) && !/วิชาเอกหลักสูตร/.test(L.generatePrompt({ ...wv, grp: 'B1', major: 'หลักสูตรอาชีวศึกษา' }, 5)));
console.log(`${n - bad}/${n} passed`);
process.exit(bad ? 1 : 0);
