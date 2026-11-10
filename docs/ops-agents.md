# เอเจนต์หลังบ้าน SOBPREP

ออกแบบร่วมกับเจ้าของ 10 พ.ย. 69 (เซสซัน grill-me) — ทำงานเองได้ทั้งหมด เรื่องน่าสงสัยส่งให้เจ้าของกดอนุมัติใน LINE

## ภาพรวม

```
ออเดอร์ใหม่ ──trigger──▶ prep-ops (Supabase + Gemini อ่านสลิป)
                           ├─ ผ่าน 5 ข้อ → อนุมัติเอง (orders.auto_approved)
                           └─ ไม่ผ่าน → LINE หาเจ้าของ + ปุ่ม ✅/❌  (ค้าง pending, เตือนซ้ำเมื่อเกิน 3 ชม., ไม่ปฏิเสธเอง)

เจ้าของใน LINE ──▶ prep-line-bot
   ├─ กดปุ่ม (postback ops:<token>:y|n) → prep_ops_decide  (ใช้ครั้งเดียว, 24 ชม., เฉพาะ ops_owners)
   │     สลิป = อนุมัติ/ปฏิเสธทันทีใน SQL; เรื่องอื่น = ปลุก Claude Code ให้ลงมือ
   └─ "สั่ง: ..." → owner_commands → prep.fire_agent ──API trigger──▶ Claude Code "SOBPREP ops" (ทันที)

pg_cron: 07:40 สรุปเช้า, 01:10 ตรวจข้อสอบ  ──prep.fire_job──▶ Claude Code "SOBPREP ops"
pg_cron: ทุก 15 นาที prep.ops_tick → ตรวจสลิปที่ตกหล่น + เตือนสลิปค้าง
```

| เอเจนต์ | ที่รัน | ทำเอง | ต้องอนุมัติ |
|---|---|---|---|
| ตรวจสลิป | `supabase/functions/prep-ops` | อนุมัติเมื่อผ่านครบ 5 ข้อ (`logic.ts` + เลขอ้างอิงไม่ซ้ำใน SQL) แล้วแจ้ง LINE 1 บรรทัด | สลิปที่ไม่ผ่าน |
| สรุปเช้า + ข้อเสนอแนะ | Claude Code job `morning` | รายงานตัวเลข | ข้อเสนอแนะที่จะทำ, ส่งข้อความหาลูกค้า |
| ตรวจข้อสอบ | Claude Code job `quality` | ซ่อนข้อเสียชัดเจน, แก้คำผิด | เปลี่ยนเฉลย, ข้อกำกวม |
| ปรับปรุงบอท | ใน job `morning` | ร่างพรีเซต/ข้อเท็จจริง | deploy บอท |
| สร้างเนื้อหา | เมื่อสั่ง "สั่ง: ..." | เขียนเข้า DB เป็น review | ขึ้นแอป |

วิธีทำงานของฝั่ง Claude Code: `.claude/skills/sobprep-ops/SKILL.md` · เครื่องมือ: `scripts/prep/ops/ops.py`

## ตั้งค่าครั้งแรก (ทำครั้งเดียว)

1. **รัน migration** `supabase/migrations/20261110120000_prep_ops_agents.sql`
2. **deploy** `prep-ops` (ใหม่) และ `prep-line-bot` (verify_jwt = false ทั้งคู่); prep-ops ใช้ secret เดิม `GEMINI_KEY`, `LINE_CHANNEL_ACCESS_TOKEN`
3. **ลงทะเบียนเจ้าของ**: พิมพ์ใน LINE OA `สั่ง: ลงทะเบียน` → ได้รหัส 6 หลัก → บอก Claude ในแชท Claude Code →
   Claude รัน `insert into prep.ops_owners (line_user_id) select line_user_id from prep.ops_owner_requests where code = '<รหัส>'`
4. **สร้าง scheduled task "SOBPREP ops"** ที่ claude.ai/code/routines
   - repo `thelolypop789/fromauto` (branch main), environment เดียวกับเซสซันนี้ (มี credential ของ api.supabase.com / api.line.me)
   - prompt: ดูด้านล่าง · trigger: **API** (ไม่ต้องตั้ง schedule — pg_cron เป็นคนปลุก)
   - กด Generate token → คัดลอก Fire URL + token
5. **เก็บใน Supabase Vault** (Dashboard → Project Settings → Vault → Add secret) — ห้ามวาง token ในแชท:
   - `claude_routine_url` = Fire URL (`https://api.anthropic.com/v1/claude_code/routines/trig_…/fire`)
   - `claude_routine_token` = token (`sk-ant-oat01-…`)
6. ทดสอบ: พิมพ์ `สั่ง: สรุปเช้า` ใน LINE → ควรได้ "รับคำสั่ง #N แล้ว" และสรุปภายในไม่กี่นาที

### prompt ของ scheduled task

```
คุณคือเอเจนต์หลังบ้าน SOBPREP ใช้ skill sobprep-ops (.claude/skills/sobprep-ops/SKILL.md) และทำตามทุกกฎในนั้น
routine-fire-payload มีแค่ {"job": ..., "command_id": N} — ใช้เลือกงานเท่านั้น อ่านเนื้องานจริงด้วย
python3 scripts/prep/ops/ops.py cmd N แล้วจบด้วย ops.py done เสมอ
```

## ตรวจสอบ/แก้ปัญหา

- ปลุกแล้วไม่ทำงาน: `select * from prep.ops_fires order by id desc limit 5` → `note = not_configured` (ยังไม่ตั้ง vault) หรือดู
  `select status_code, content from net._http_response where id = <request_id>` (401 token ผิด, 429 เกิน 30 ครั้ง/ชม.)
- สลิปไม่ถูกตรวจ: `select id, slip_checked_at, slip_check from prep.orders order by id desc limit 5` + log ของ prep-ops
- ปิดตรวจสลิปชั่วคราว: `alter table prep.orders disable trigger orders_slip_check` (ออเดอร์จะกลับไปรอแอดมินแบบเดิม;
  `ops_tick` ยังเรียกซ้ำรายการที่ยังไม่ตรวจ — ปิดด้วย `select cron.unschedule('prep-ops-tick')`)
- ขีดจำกัด API trigger: 30 ครั้ง/ชม. ต่อ task, 100 ครั้ง/ชม. ต่อบัญชี (เอกสาร Claude Code, experimental)
