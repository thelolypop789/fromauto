// Unit tests for the helpers of prep-ai-review (node scripts/prep/test_ai_review_logic.mjs, from the repo root).
import ts from 'typescript';
import fs from 'fs';
const src = fs.readFileSync('supabase/functions/prep-ai-review/logic.ts', 'utf8');
fs.writeFileSync('/tmp/prep_ai_logic.mjs', ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText);
const L = await import('/tmp/prep_ai_logic.mjs');
let n = 0, bad = 0; const t = (name, c) => { n++; if (!c) { bad++; console.log('FAIL', name); } };
const q = { id: 7, topic: 'ช่างยนต์', subtopic: 'เครื่องยนต์', track: 'vec', grp: 'B3', stem: 'เพลาข้อเหวี่ยงหมุนกี่รอบ', choices: ['1', '2', '3', '4'], answer: 1, explanation: '2 รอบ', law_ref: null };
const B = (answer, confidence = 'high', flags = []) => ({ id: 7, answer, confidence, flags, note: '' });
const J = (verdict, confidence = 'high', fix = {}) => ({ id: 7, verdict, confidence, issue: verdict === 'ok' ? '' : 'ปัญหา', fix: { stem: null, choices: null, answer: null, explanation: null, ...fix } });

// prompts
t('blind prompt hides the key', !/เฉลย/.test(L.blindPrompt([q])) && /สอศ\./.test(L.blindPrompt([q])));
const jp = L.judgePrompt([q], { Pro: new Map([[7, B(2, 'medium', ['ambiguous'])]]), Flash: new Map() });
t('judge prompt has key and both experts', /เฉลย: ข/.test(jp) && /Pro: ตอบ ค/.test(jp) && /Flash: ไม่ได้ตอบ/.test(jp));

// combine rules
t('ok only when everyone agrees with the key', L.combine(q, { Pro: B(1), Flash: B(1) }, J('ok')).verdict === 'ok');
t('ok has high confidence with two models', L.combine(q, { Pro: B(1), Flash: B(1) }, J('ok')).confidence === 'high');
t('single model ok is only medium', L.combine(q, { Pro: B(1) }, J('ok')).confidence === 'medium');
t('one blind answer off the key -> not ok, low confidence', (() => { const v = L.combine(q, { Pro: B(1), Flash: B(2) }, J('ok')); return v.verdict === 'fix' && v.confidence === 'low' && /Flash ตอบ ค/.test(v.issue); })());
t('both blind agree against key -> fix, suggests their answer', (() => { const v = L.combine(q, { Pro: B(2), Flash: B(2) }, J('fix', 'high', { answer: 2 })); return v.verdict === 'fix' && v.answer === 2 && v.fix.answer === 2 && v.confidence === 'high'; })());
t('a flag blocks ok', L.combine(q, { Pro: B(1, 'high', ['multiple_correct']), Flash: B(1) }, J('ok')).verdict === 'fix');
t('missing context -> hide', L.combine(q, { Pro: B(null, 'low', ['missing_context']), Flash: B(1) }, J('ok')).verdict === 'hide');
t('low confidence blocks ok', L.combine(q, { Pro: B(1, 'low'), Flash: B(1) }, J('ok')).verdict === 'fix');
t('judge unsure blocks ok', L.combine(q, { Pro: B(1), Flash: B(1) }, J('ok', 'low')).verdict === 'fix');
t('model that did not answer blocks ok', L.combine(q, { Pro: B(1), Flash: undefined }, J('ok')).verdict === 'fix');
t('no judge blocks ok', L.combine(q, { Pro: B(1), Flash: B(1) }, undefined).verdict === 'fix');
t('judge hide wins', L.combine(q, { Pro: B(1), Flash: B(1) }, J('hide')).verdict === 'hide');
t('ok carries no fix and no issue', (() => { const v = L.combine(q, { Pro: B(1), Flash: B(1) }, J('ok', 'high', { answer: 3 })); return v.issue === '' && v.fix.answer === null; })());

// parsing
t('parseJson strips fences and prose', L.parseJson('ผล:\n```json\n{"results":[]}\n```').results.length === 0);
const rb = L.readBlind([q], { results: [{ id: 7, answer: 5, confidence: 'x', flags: ['ambiguous', 'bogus'] }, { id: 7, answer: 1 }, { id: 9, answer: 1 }] });
t('readBlind: one per id, bad answer -> null, unknown flags dropped', rb.size === 1 && rb.get(7).answer === null && rb.get(7).confidence === 'low' && rb.get(7).flags.join() === 'ambiguous');
const rj = L.readJudge([q], { results: [{ id: 7, verdict: 'fix', confidence: 'high', issue: ' x ', fix: { choices: ['a', 'a', 'b', 'c'], answer: 2, explanation: ' e ' } }] });
t('readJudge: duplicate choices rejected, rest kept', rj.get(7).fix.choices === null && rj.get(7).fix.answer === 2 && rj.get(7).fix.explanation === 'e');

// cost
t('deepseek peak doubles', Math.abs(L.costUSD('deepseek-v4-pro', { prompt_tokens: 1e6, completion_tokens: 0 }, new Date('2026-10-21T02:00:00Z')) - 1.32) < 1e-9);
t('deepseek off-peak on weekend', Math.abs(L.costUSD('deepseek-v4-pro', { prompt_tokens: 0, completion_tokens: 1e6 }, new Date('2026-10-24T02:00:00Z')) - 1.98) < 1e-9);
t('flash price', Math.abs(L.costUSD('deepseek-flash', { prompt_tokens: 1e6, completion_tokens: 1e6 }, new Date('2026-10-24T02:00:00Z')) - 0.75) < 1e-9);
console.log(`${n - bad}/${n} passed`);
process.exit(bad ? 1 : 0);
