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
const BEFORE = Date.parse('2026-11-15T23:59:00+07:00'), AFTER = Date.parse('2026-11-16T00:00:00+07:00');
const priced = L.priceText([{ package: 'ALL', term: 'round', amount: 89 }], BEFORE);
t('price text uses DB price, fallback for the rest', priced.includes('รายรอบ 3 เดือน 89 บาท') && priced.includes('ซื้อขาด ใช้ได้ทุกรอบสอบ 179 บาท') && !priced.includes('ภาค ก\n'));
t('price preset with live promos still shows pre-cutoff prices', (() => { const x = L.PRESETS.find(p => p.id === 'price').text([], [{ code: 'SOB10', amount_off: 10 }]); return Date.now() >= L.LIFETIME_UNTIL || (x.includes('ซื้อขาด') && !x.includes('รายปี 12 เดือน')); })());
t('fallback price text = preset prices', L.priceText([], BEFORE).includes('179 บาท') && L.priceText([], BEFORE).includes('รายรอบ 69 บาท · ซื้อขาด 129 บาท'));
t('every link carries src=line-oa', [L.WELCOME_TEXT, L.priceText([]), L.SLIP_TEXT, L.DEFAULT_TEXT, L.systemPrompt([]), ...L.PRESETS.map(p => p.text([]))]
  .every(s => (s.match(/https:\/\/\S+/g) ?? []).every(u => u.includes('?src=line-oa'))));
t('prompt has live price, ภาค ก closed', /แพ็กภาค ข \+ วิชาเอก[^;\n]*\b59\b/.test(L.systemPrompt([{ package: 'B', term: 'round', amount: 59 }])) && L.systemPrompt([]).includes('แพ็กภาค ก ปิดการขายแล้ว'));
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
const ctx = { me: { plan: 'paid', packages: [{ package: 'A', expires_at: '2027-01-30T00:00:00Z' }, { package: 'B', expires_at: null }] },
  orders: [{ package: 'ALL', term: 'round', amount: 99, status: 'pending', created_at: '2026-10-30T03:00:00Z', admin_note: null }],
  readiness: { overall: 64, answered: 320, sections: [{ section: 'A', pct: 70 }], focus: [{ name: 'กฎหมาย', subject: 'ภาค ข', pct: 41 }] } };
const ct = L.contextText(ctx);
t('context: packages with expiry / lifetime', ct.includes('แพ็กภาค ก (ถึง') && ct.includes('แพ็กภาค ข + วิชาเอก (ซื้อขาด)'));
t('context: order status in Thai', ct.includes('รอตรวจสลิป') && ct.includes('99 บาท'));
t('context: readiness + focus', ct.includes('ความพร้อมสอบ 64%') && ct.includes('กฎหมาย (ภาค ข, 41%)'));
const empty = L.contextText({ me: { plan: 'free', free_sets_used: 1, free_sets_limit: 3 }, orders: [], readiness: { overall: null } });
t('context: free user, no orders, no readiness', empty.includes('ชุดฟรีเหลือ 2 จาก 3') && empty.includes('ยังไม่มีคำสั่งซื้อ') && empty.includes('ยังทำข้อสอบไม่พอ'));
t('context: missing data does not throw', typeof L.contextText({}) === 'string');
const ap = L.appSystemPrompt([], ctx);
t('app prompt: in-app wording, LINE button, no line-oa links', ap.includes('ผู้ช่วยแชทในแอป') && ap.includes('คุยกับแอดมินทาง LINE') && !ap.includes('src=line-oa') && !ap.includes('พิมพ์คำว่า "แอดมิน"'));
t('app prompt: has customer data', ap.includes('รอตรวจสลิป'));
const day = { stats: { conversations: 2, line_conversations: 1, app_conversations: 1, messages: 3, ai: 2, preset: 1, handoff: 0, fallback: 0 },
  conversations: [{ channel: 'line', turns: [{ role: 'user', content: 'ราคา' }, { role: 'assistant', content: 'x', src: 'preset:price' }] },
    { channel: 'app', turns: [{ role: 'user', content: 'สลิปผ่านยัง' }, { role: 'assistant', content: 'รอตรวจ', src: 'ai' }] }] };
const tr = L.transcript(day);
t('transcript: both chats, preset tagged, ai untagged', tr.includes('แชท 1 (LINE)') && tr.includes('[preset:price]') && tr.includes('แชท 2 (ในแอป)') && !tr.includes('[ai]'));
t('transcript: capped', L.transcript({ stats: {}, conversations: Array.from({ length: 500 }, () => ({ channel: 'app', turns: [{ role: 'user', content: 'ก'.repeat(400) }] })) }).length <= 60000);
t('summary prompt: stats + no personal data rule', L.summaryPrompt('2026-10-30', day).includes('2 แชท (LINE 1, ในแอป 1)') && L.summaryPrompt('2026-10-30', day).includes('ห้ามใส่อีเมล'));
const T = (text) => ({ kind: 'text', text }), M = { kind: 'media', text: '' };
t('burst: one keyword → preset', JSON.stringify(L.planBurst([T('ราคา')])) === JSON.stringify({ type: 'preset', id: 'price', said: ['ราคา'] }));
t('burst: only pictures → slip', L.planBurst([M, M]).type === 'slip' && L.planBurst([M, M]).said.length === 2);
t('burst: แอดมิน anywhere → hand-off', L.planBurst([T('สวัสดีครับ'), T('แอดมิน')]).type === 'preset' && L.planBurst([T('สวัสดีครับ'), T('แอดมิน')]).id === 'admin');
const b = L.planBurst([T('สวัสดีครับ'), T('ราคา'), T('ซื้อขาดใช้ได้นานไหม')]);
t('burst: several texts → one AI question listing all', b.type === 'ai' && b.question.includes('- สวัสดีครับ') && b.question.includes('- ราคา') && b.question.includes('- ซื้อขาดใช้ได้นานไหม'));
t('burst: said keeps order', b.said.join('|') === 'สวัสดีครับ|ราคา|ซื้อขาดใช้ได้นานไหม');
const bm = L.planBurst([T('โอนแล้วครับ'), M]);
t('burst: text + picture → AI told about the picture', bm.type === 'ai' && bm.question.startsWith('โอนแล้วครับ') && bm.question.includes('แนบในหน้าซื้อเท่านั้น') && bm.said[1] === '[ส่งรูป/ไฟล์]');
t('burst: keyword + picture → AI (not the preset)', L.planBurst([T('ราคา'), M]).type === 'ai');
t('burst: one plain question → asked as is', L.planBurst([T('มีวิชาเอกดนตรีไหม')]).question === 'มีวิชาเอกดนตรีไหม');
const live = { code: 'SOB10', kind: 'amount', value: 10, packages: null, expires_at: '2026-11-14T17:00:00Z', active: true, left: 37 };
const gone = { ...live, active: false, left: 0 };
const pt = L.promoText([live], []);
t('promo: keywords → promo preset, "โค้ด" alone → AI', id('โปร') === 'promo' && id('SOB10') === 'promo' && id('ส่วนลดครับ') === 'promo' && id('โค้ด') === null && id('คีย์') === 'key');
t('promo text: prices after the code', pt.includes('เหลือ 89 บาท (จาก 99)') && !pt.includes('ภาค ก เหลือ') && pt.includes('ภาค ข + วิชาเอก เหลือ 59'));
t('promo text: left, until 14 พ.ย., link applies the code', pt.includes('เหลือ 37 สิทธิ์') && pt.includes('14 พ.ย.') && pt.includes('buy?promo=SOB10&src=line-oa'));
t('promo text: used up → no code offered', !L.promoText([gone], []).includes('SOB10') && L.promoText([gone], []).includes('ยังไม่มีโค้ดส่วนลด'));
t('promo preset uses live state', L.PRESETS.find(p => p.id === 'promo').text([], [live]).includes('SOB10'));
t('prompt: live code listed, dead code forbidden', L.systemPrompt([], [live]).includes('โค้ด SOB10: ลด 10 บาท ทุกแพ็ก เหลือ 37 สิทธิ์') && L.systemPrompt([], [gone]).includes('ห้ามเสนอโค้ดนี้'));
t('prompt: no promos', L.systemPrompt([]).includes('ไม่มีโค้ดส่วนลด'));
t('app prompt: promo link not line-oa', L.appSystemPrompt([], {}, [live]).includes('promo=SOB10&src=app-chat'));
t('percent code with package limit', L.promoText([{ ...live, kind: 'percent', value: 20, packages: ['ALL'] }], []).includes('เหลือ 79 บาท') && !L.promoText([{ ...live, kind: 'percent', value: 20, packages: ['ALL'] }], []).includes('ภาค ก เหลือ'));

// 2 พ.ย.: ข้อมูลจากสรุปแชท (โควตา ซื้อกลุ่ม แอป เปลี่ยนเอก) + ลิงก์ LINE เปิดเบราว์เซอร์นอก
const topics = [{ code: 'B3-THAI', section: 'B', grp: 'B3', name: 'ภาษาไทย', available: 1203 }, { code: 'B3-CHN', section: 'B', grp: 'B3', name: 'ภาษาจีน', available: 100 },
  { code: 'B3-X', section: 'B', grp: 'B3', name: 'ว่าง', available: 0 }, { code: 'A1-X', section: 'A', grp: 'A1', name: 'ภาค ก', available: 999 }];
const lp = L.systemPrompt([], [live], topics), ap2 = L.appSystemPrompt([], {}, [live], topics);
t('LINE links open the external browser', [L.WELCOME_TEXT, L.SLIP_TEXT, L.PRESETS.find(p => p.id === 'buy').text([])].every(x => x.includes('openExternalBrowser=1')) && lp.includes('openExternalBrowser=1'));
t('promo link keeps external flag and promo', L.promoText([live], []).includes('promo=SOB10&src=line-oa&openExternalBrowser=1'));
t('app prompt has no external flag', !ap2.includes("openExternalBrowser") && ap2.includes("src=app-chat"));
t('major counts: B3 with questions only, biggest first', L.majorLines(topics) === 'ภาษาไทย 1,203, ภาษาจีน 100');
t('major counts: vocational majors are labelled', L.majorLines([{ code: 'B3-V-ELEC', section: 'B', grp: 'B3', name: 'ช่างไฟฟ้ากำลัง', available: 205, track: 'vec' }]) === 'ช่างไฟฟ้ากำลัง (สอศ.) 205');
t('prompt lists major counts', lp.includes('ภาษาไทย 1,203'));
t('prompt: daily quota, never unlimited answers', lp.includes('1,000 ข้อ/วัน') && lp.includes('3,000 ข้อ/วัน') && lp.includes('ห้ามบอกว่าไม่จำกัด'));
t('prompt: group buy, change major, web app, not-yet features', ['2 คน ลด 20%', 'เปลี่ยนวิชาเอก', 'ไม่มีใน App Store', 'ยังไม่มี: ลบชุด'].every(x => lp.includes(x)));
t('presets: แอป → install, ซื้อกลุ่ม → group', id('โหลดแอปค่ะ') === 'install' && id('ซื้อกลุ่ม') === 'group' && id('ซื้อคู่ครับ') === 'group');
t('slip reply: steps + Failed to fetch tip', L.SLIP_TEXT.includes('Failed to fetch') && L.SLIP_TEXT.includes('ไม่ต้องโอนซ้ำ'));
t('lifetime: sold until 15 Nov 23:59 Bangkok only', L.lifetimeOpen(BEFORE) && !L.lifetimeOpen(AFTER));
t('lifetime: price text says the last day, then drops lifetime', L.priceText([], BEFORE).includes('ขายถึง 15 พ.ย. 69') && !L.priceText([], AFTER).includes('ซื้อขาด'));
const after16 = [{ package: 'ALL', term: 'year', amount: 219 }, { package: 'ALL', term: 'round', amount: 129 }, { package: 'B', term: 'year', amount: 169 }, { package: 'B', term: 'round', amount: 99 }];
t('new prices from 16 Nov: yearly + 3 months, no ภาค ก', L.priceText(after16, AFTER).includes('รายปี 12 เดือน 219 บาท') && L.priceText(after16, AFTER).includes('รายรอบ 3 เดือน 129 บาท') && L.priceText(after16, AFTER).includes('รายปี 169 บาท · 3 เดือน 99 บาท') && !L.priceText(after16, AFTER).includes('ภาค ก\n•') && !L.priceText(after16, AFTER).includes('📘'));
t('before 16 Nov: announces the new yearly price, no ภาค ก pack', L.priceText([], BEFORE).includes('รายปี 219 บาท') && !L.priceText([], BEFORE).includes('📘'));
console.log(bad ? `${bad}/${n} FAILED` : `all ${n} passed`);
process.exit(bad ? 1 : 0);
