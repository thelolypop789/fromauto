// Unit tests for the helpers of prep-claude-review (node scripts/prep/test_claude_review_logic.mjs, from the repo root).
import ts from 'typescript';
import fs from 'fs';
const src = fs.readFileSync('supabase/functions/prep-claude-review/logic.ts', 'utf8');
fs.writeFileSync('/tmp/prep_claude_logic.mjs', ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText);
const L = await import('/tmp/prep_claude_logic.mjs');
let n = 0, bad = 0; const t = (name, c) => { n++; if (!c) { bad++; console.log('FAIL', name); } };
const q = { id: 7, topic: 'ช่างยนต์', subtopic: 'เครื่องยนต์', track: 'vec', grp: 'B3', stem: 'เพลาข้อเหวี่ยงหมุนกี่รอบต่อวัฏจักร', choices: ['1', '2', '3', '4'], answer: 1, explanation: '2 รอบ', law_ref: null };
const p = L.userPrompt([q, { ...q, id: 8, track: 'obec', grp: 'B1', topic: 'จิตวิทยา' }]);
t('prompt names the vec exam and the major', /สอศ\./.test(p) && /วิชาเอกช่างยนต์/.test(p) && /เฉลย: ข/.test(p));
t('non-major topic is not called วิชาเอก', /· จิตวิทยา/.test(p) && !/วิชาเอกจิตวิทยา/.test(p));
const fix = { stem: null, choices: null, answer: null, explanation: null };
const r = L.normalize([q], { results: [
  { id: 7, answer: 1, verdict: 'ok', confidence: 'high', issue: '', fix },
  { id: 7, answer: 2, verdict: 'fix', confidence: 'high', issue: 'dup', fix },   // second verdict for the same id dropped
  { id: 99, answer: 0, verdict: 'ok', confidence: 'high', issue: '', fix },      // not asked
  { id: 7, answer: 5, verdict: 'ok', confidence: 'high', issue: '', fix },
] });
t('one verdict per asked id', r.length === 1 && r[0].verdict === 'ok');
const f = L.normalize([q], { results: [{ id: 7, answer: 2, verdict: 'fix', confidence: 'weird', issue: ' เฉลยผิด ', fix: { stem: ' ', choices: ['a', 'b', 'c'], answer: 2, explanation: 'ใหม่' } }] })[0];
t('bad fix parts dropped, good kept', f.fix.stem === null && f.fix.choices === null && f.fix.answer === 2 && f.fix.explanation === 'ใหม่');
t('unknown confidence -> low, issue trimmed', f.confidence === 'low' && f.issue === 'เฉลยผิด');
t('garbage -> empty', L.normalize([q], null).length === 0 && L.normalize([q], { results: 'x' }).length === 0);
t('schema requires every field (structured outputs)', L.SCHEMA.properties.results.items.required.length === 6);
console.log(`${n - bad}/${n} passed`);
process.exit(bad ? 1 : 0);
