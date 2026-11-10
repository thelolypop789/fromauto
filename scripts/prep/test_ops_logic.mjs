// Unit tests for prep-ops slip rules + the owner helpers of prep-line-bot (node scripts/prep/test_ops_logic.mjs, from the repo root).
import ts from 'typescript';
import fs from 'fs';
const load = async (src, out) => {
  const js = ts.transpileModule(fs.readFileSync(src, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
  fs.writeFileSync(out, js); return import(out);
};
const O = await load('supabase/functions/prep-ops/logic.ts', '/tmp/prep_ops_logic.mjs');
const B = await load('supabase/functions/prep-line-bot/logic.ts', '/tmp/prep_line_bot_logic_ops.mjs');
let n = 0, bad = 0; const t = (name, c) => { n++; if (!c) { bad++; console.log('FAIL', name); } };

const order = { id: 7, amount: 89, created_at: '2026-11-10T13:20:00Z' };            // 20:20 ไทย
const good = { readable: true, is_transfer_slip: true, amount: 89, receiver_name: 'นาย พงศกร ด', receiver_account: 'xxx-x-x1234-x',
  sender_name: 'สมชาย', bank: 'KBank', paid_at: '2026-11-10T20:15:00+07:00', ref: '016314201512ABC12345', tamper_signs: false, tamper_note: null };
t('clean slip passes', O.slipReasons(order, good).length === 0);
t('no AI answer = suspicious', O.slipReasons(order, null).length === 1);
t('amount mismatch', O.slipReasons(order, { ...good, amount: 99 }).some(r => r.includes('ไม่ตรงกับออเดอร์ 89')));
t('amount 89.00 ok, 88.99 not', O.slipReasons(order, { ...good, amount: 89.0 }).length === 0 && O.slipReasons(order, { ...good, amount: 88.99 }).length === 1);
t('missing amount', O.slipReasons(order, { ...good, amount: null }).some(r => r.includes('ไม่พบยอด')));
t('receiver Thai / latin / masked', O.receiverOk('นาย พงศกร ด.') && O.receiverOk('MR. PONGSAKORN D') && O.receiverOk('Pongsarkon Dornkotkok'));
t('wrong receiver', O.slipReasons(order, { ...good, receiver_name: 'นาย สมศักดิ์ ก' }).some(r => r.includes('ชื่อผู้รับไม่ตรง')));
t('ถุงเงิน ชื่อร้าน (slip #333)', O.slipReasons(order, { ...good, receiver_name: 'ถุงเงิน (ซ้อมข้อสอบครูผู้ช่วย)', receiver_account: 'KN143990QP0389845IZ' }).length === 0);
t('กรุงไทย: รหัสร้านอยู่ในชื่อผู้รับ (slip #336)', O.slipReasons(order, { ...good, receiver_name: 'TUNGNGERN (somkosobkrupuchuai)', receiver_account: '010753700088205' }).length === 0);
t('TUNGNGERN อย่างเดียวไม่พอ', !O.receiverOk('TUNGNGERN (ร้านอื่น)', '010753700088205'));
t('merchant id alone', O.receiverOk('ร้านค้า', 'รหัสร้านค้า: KN143990QP0389845IZ') && !O.receiverOk('ร้านอื่น', 'KN000000'));
t('no receiver', !O.receiverOk(null) && !O.receiverOk(''));
t('paid 47h before ok', O.slipReasons(order, { ...good, paid_at: '2026-11-08T21:30:00+07:00' }).length === 0);
t('paid 49h before', O.slipReasons(order, { ...good, paid_at: '2026-11-08T19:00:00+07:00' }).some(r => r.includes('48 ชม.')));
t('paid after submit (+1h)', O.slipReasons(order, { ...good, paid_at: '2026-11-10T21:30:00+07:00' }).some(r => r.includes('หลังเวลาส่ง')));
t('bad date', O.slipReasons(order, { ...good, paid_at: 'เมื่อวาน' }).some(r => r.includes('ไม่พบวันเวลา')));
t('no ref / short ref', O.slipReasons(order, { ...good, ref: null }).some(r => r.includes('เลขอ้างอิง')) && O.cleanRef('12 3') === null);
t('ref normalised', O.cleanRef(' 0163 1420 abc ') === '01631420ABC');
t('tamper', O.slipReasons(order, { ...good, tamper_signs: true, tamper_note: 'ฟอนต์ยอดเงินต่าง' }).some(r => r.includes('ฟอนต์ยอดเงินต่าง')));
t('not a slip / unreadable', O.slipReasons(order, { ...good, is_transfer_slip: false, readable: false }).length === 2);
t('parseSlip from JSON string, "1,299.00 บาท"', O.parseSlip('{"readable":true,"amount":"1,299.00 บาท","ref":"AB123456","tamper_signs":false}').amount === 1299);
t('parseSlip garbage', O.parseSlip('not json') === null);
t('thaiTime', O.thaiTime(Date.parse('2026-11-10T13:05:00Z')) === '10/11 20:05 น.');
const c = O.confirmMessage('a'.repeat(24), 'สลิปออเดอร์ #7 · 89 บาท');
t('confirm template: 2 postbacks, labels ≤ 20, text ≤ 240', c.template.actions.length === 2 && c.template.actions.every(a => a.label.length <= 20 && a.data.length <= 300) && c.template.text.length <= 240);
t('approved one-liner', O.approvedText({ order_id: 334, amount: 69, package: 'B', term: 'round' }) === '✅ อนุมัติอัตโนมัติ #334 · ภาค ข+เอก รายรอบ · 69 บาท');
t('alert text lists reasons', O.slipAlertText({ order_id: 7, amount: 89, package: 'ALL', term: 'round', reasons: ['x', 'y'] }, good).includes('• y'));

t('postback ok', JSON.stringify(B.parsePostback('ops:' + 'ab'.repeat(12) + ':y')) === JSON.stringify({ token: 'ab'.repeat(12), approve: true }));
t('postback bad', B.parsePostback('ops:zz:y') === null && B.parsePostback(undefined) === null && B.parsePostback('ops:' + 'a'.repeat(24) + ':x') === null);
t('command forms', B.parseCommand('สั่ง: สรุปเช้า') === 'สรุปเช้า' && B.parseCommand('สั่ง:ซ่อนข้อ #12') === 'ซ่อนข้อ #12' && B.parseCommand(' สั่ง ： ลงทะเบียน') === 'ลงทะเบียน');
t('not a command', B.parseCommand('สั่งซื้อยังไง') === null && B.parseCommand('ฉันสั่ง: x') === null);
t('non-owner command falls through', B.commandReply({ error: 'not_owner' }) === null);
t('register code reply', B.commandReply({ register_code: '012345' }).includes('012345'));
t('queued but not configured', B.commandReply({ ok: true, command_id: 3, fired: false }).includes('ยังไม่ได้เชื่อม'));
t('decide replies', B.decideReply({ error: 'expired', title: 'x' }).includes('หมดอายุ') && B.decideReply({ ok: true, kind: 'slip', approved: true, title: 'x' }).includes('อนุมัติแล้ว')
  && B.decideReply({ error: 'used', status: 'approved', title: 'x' }).includes('ตัดสินไปแล้ว') && B.decideReply(null).includes('ไม่สำเร็จ'));
console.log(`${n - bad}/${n} passed`); if (bad) process.exit(1);
