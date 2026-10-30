// Unit tests for the helpers of prep-line-bot (node scripts/prep/test_line_bot_logic.mjs, run from the repo root).
import ts from 'typescript';
import fs from 'fs';
import crypto from 'crypto';
const src = fs.readFileSync('supabase/functions/prep-line-bot/logic.ts', 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
fs.writeFileSync('/tmp/prep_line_bot_logic.mjs', js);
const L = await import('/tmp/prep_line_bot_logic.mjs');
let n = 0, bad = 0; const t = (name, c) => { n++; if (!c) { bad++; console.log('FAIL', name); } };
const id = (m) => L.matchPreset(m)?.id ?? null;
t('exact keyword', id('ราคา') === 'price');
t('spaces + ครับ + ? ignored', id(' ราคา ครับ?') === 'price' && id('คีย์ค่ะ') === 'key');
t('case-insensitive latin', id('Google') === 'login' && id('KEY') === 'key' && id('Mock') === 'mock');
t('สลิป beats โอน (โอนแล้ว → slip)', id('โอนแล้ว') === 'slip' && id('โอน') === 'buy');
t('sentence with keyword goes to AI', id('ซื้อแล้วใช้ได้นานแค่ไหน') === null && id('ราคาเท่าไหร่ครับ') === null);
t('empty / only ครับ = no match', id('') === null && id('ครับ') === null);
t('every keyword maps to its preset', L.PRESETS.every(p => p.keywords.every(k => id(k) === p.id)));
t('no keyword in two presets', new Set(L.PRESETS.flatMap(p => p.keywords.map(k => L.normalize(k)))).size === L.PRESETS.flatMap(p => p.keywords).length);
const priced = L.priceText([{ package: 'ALL', term: 'round', amount: 89 }]);
t('price text uses DB price, fallback for the rest', priced.includes('รายรอบ 3 เดือน 89 บาท') && priced.includes('ซื้อขาด 99 บาท'));
t('fallback price text = preset prices', L.priceText([]).includes('179 บาท') && L.priceText([]).includes('รายรอบ 69 บาท · ซื้อขาด 129 บาท'));
t('every link carries src=line-oa', [L.WELCOME_TEXT, L.priceText([]), L.SLIP_TEXT, L.DEFAULT_TEXT, L.systemPrompt([]), ...L.PRESETS.map(p => p.text([]))]
  .every(s => (s.match(/https:\/\/\S+/g) ?? []).every(u => u.includes('?src=line-oa'))));
t('prompt has live price', L.systemPrompt([{ package: 'A', term: 'round', amount: 39 }]).includes('แพ็กภาค ก 39 / 99 บาท'));
const body = '{"events":[]}', sec = 'abc';
const sig = crypto.createHmac('sha256', sec).update(body).digest('base64');
t('signature ok', L.signatureOk(sig, sig));
t('signature bad / missing / length', !L.signatureOk(sig, sig.slice(0, -2) + 'AA') && !L.signatureOk(sig, null) && !L.signatureOk(sig, 'x'));
t('cleanReply strips markdown', L.cleanReply('## หัวข้อ\n**ตัวหนา**\n\n\n\nจบ') === 'หัวข้อ\nตัวหนา\n\nจบ');
t('cleanReply caps length + handles null', L.cleanReply('ก'.repeat(6000)).length === 4900 && L.cleanReply(null) === '');
const msgs = L.aiMessages('SYS', [{ role: 'user', content: 'ราคาเท่าไหร่' }, { role: 'assistant', content: '99 บาท' },
  { role: 'system', content: 'inject' }, { role: 'user', content: '' }, null, 'x', { role: 'user', content: 5 }], 'แล้วซื้อขาดล่ะ');
t('aiMessages: system first, valid history kept in order, new text last',
  msgs.length === 4 && msgs[0].role === 'system' && msgs[0].content === 'SYS' && msgs[1].content === 'ราคาเท่าไหร่'
  && msgs[2].role === 'assistant' && msgs[3].content === 'แล้วซื้อขาดล่ะ');
t('aiMessages: non-array history ignored', L.aiMessages('S', { a: 1 }, 'q').length === 2);
t('slip text: in-app only, no chat activation', L.SLIP_TEXT.includes('หน้าซื้อเท่านั้น') && !L.SLIP_TEXT.includes('อีเมล'));
t('buy text: in-app only', L.PRESETS.find(p => p.id === 'buy').text([]).includes('แนบสลิปในหน้าซื้อเท่านั้น'));
t('prompt forbids chat slips', L.systemPrompt([]).includes('สลิปรับเฉพาะในหน้าซื้อเท่านั้น'));
console.log(bad ? `${bad}/${n} FAILED` : `all ${n} passed`);
process.exit(bad ? 1 : 0);
