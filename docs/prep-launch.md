# FormAuto Prep (/prep) — คู่มือตั้งค่าและเปิดระบบ

ระบบซ้อมข้อสอบครูผู้ช่วยอยู่ที่ `/prep` แยก bundle / session / ตารางจากระบบครูเดิม
(ชื่อเมนูใน Supabase/Vercel อาจต่างเล็กน้อยตามเวอร์ชัน ให้ดูคำที่ใกล้เคียง)

ลำดับที่แนะนำ: **0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10**

---

## 0. ตรวจว่ารัน SQL สำเร็จ (Supabase → SQL Editor)

ต้องรัน migration 3 ไฟล์ตามลำดับ: `..._prep_schema.sql`, `..._prep_topics_seed.sql`, `..._prep_admin_check.sql`
รันคำสั่งนี้ ผลที่ถูกต้องคือ `tables = 12, topics = 35, fns = 19`

```sql
select
  (select count(*) from pg_tables where schemaname = 'prep')                              as tables,
  (select count(*) from prep.topics)                                                       as topics,
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
                                  and proname like 'prep\_%')                              as fns;
```

ถ้าตัวเลขไม่ตรง แปลว่าไฟล์ใดไฟล์หนึ่งไม่ได้รันหรือรันไม่ครบ (ไฟล์ schema รันซ้ำไม่ได้ ถ้าติด error "already exists" แปลว่ารันไปแล้ว)

ตรวจความปลอดภัย: ฟังก์ชันต้องไม่เปิดให้คนที่ไม่ล็อกอินเรียก

```sql
select proname from pg_proc
where pronamespace = 'public'::regnamespace and proname like 'prep\_%'
  and has_function_privilege('anon', oid, 'execute');
```

ต้องได้แถวเดียวคือ `prep_topics` (หน้าล็อกอินไม่ใช้ แต่ปลอดภัย: ส่งแค่ชื่อหมวด)

## 1. ปิดไม่ให้ schema `prep` เปิดผ่าน API

Supabase → **Project Settings → Data API** (หรือ API) → ช่อง **Exposed schemas**
ต้องมีแค่ `public` (และ `graphql_public` ถ้ามีอยู่เดิม) **ห้ามมี `prep`** แล้วกด Save

## 2. ใส่ตัวแปรใน Vercel แล้ว deploy

Vercel → โปรเจกต์ → **Settings → Environment Variables** ต้องมี (ติ๊กทั้ง Production และ Preview)

| ชื่อ | ค่า |
|---|---|
| `VITE_SUPABASE_URL` | URL โปรเจกต์ Supabase (มีอยู่แล้ว) |
| `VITE_SUPABASE_KEY` | anon key (มีอยู่แล้ว) |
| `VITE_PREP_EMAIL_LOGIN` | `off` — **ถ้ายังไม่ตั้ง SMTP (ข้อ 5)** ให้ซ่อนช่องล็อกอินด้วยอีเมล เหลือแต่ปุ่ม Google |

แก้ตัวแปรแล้วต้อง **Redeploy** (Deployments → ⋯ → Redeploy) เพราะตัวแปร `VITE_*` ถูกฝังตอน build

ทดสอบจาก branch `claude/git-auto-review-VwDUZ`: Vercel สร้าง **Preview deployment** ให้เองเมื่อ push
(Deployments → เลือกอันที่ branch นี้ → Visit) ใช้ `<preview-url>/prep` ทดสอบก่อน merge เข้า main
ถ้าไม่เห็น preview: Settings → Git → ตรวจว่าเชื่อม GitHub repo และเปิด Preview Deployments อยู่

## 3. อนุญาต URL ใน Supabase (ไม่งั้นล็อกอิน Google แล้วเด้งผิดที่)

Supabase → **Authentication → URL Configuration → Redirect URLs → Add URL** เพิ่ม

- `https://<โดเมน production>/prep`
- `https://<ชื่อ-preview>.vercel.app/prep` (ของ preview ที่จะทดสอบ หรือใส่ wildcard `https://*-<ชื่อทีม>.vercel.app/**`)

**Site URL** ปล่อยตามเดิม (ของระบบครู) ส่วน Google provider เปิดอยู่แล้วจากระบบครู ไม่ต้องตั้งใหม่
(callback ของ Google Cloud ชี้ที่ `https://<project>.supabase.co/auth/v1/callback` อยู่แล้ว)

## 4. ล็อกอินครั้งแรก แล้วตั้งตัวเองเป็นแอดมิน

1. เปิด `<url>/prep` → **เข้าสู่ระบบด้วย Google** (ใช้บัญชี Google ที่จะเป็นแอดมิน)
2. กลับ Supabase → SQL Editor รัน (แก้อีเมล)

```sql
insert into prep.admins (user_id)
select id from auth.users where email = 'อีเมลของคุณ@gmail.com';
```

ต้องขึ้น `INSERT 0 1` (ถ้า `0 0` แปลว่าอีเมลไม่ตรงกับที่ล็อกอิน)
3. รีเฟรชหน้า `/prep` → ต้องเห็นแท็บ **แอดมิน** เพิ่มขึ้น

## 5. อีเมลล็อกอิน (ไม่บังคับ — ข้ามได้ถ้าเปิดตัวด้วย Google ก่อน)

อีเมลในตัวของ Supabase ส่งได้แค่ถึงสมาชิกทีมโปรเจกต์ (~2 ฉบับ/ชม.) ผู้ใช้ทั่วไปจะไม่ได้รับรหัส ตัวเลือก:

- **A. ข้ามไปก่อน (แนะนำสำหรับวันเปิดตัว):** ตั้ง `VITE_PREP_EMAIL_LOGIN=off` (ข้อ 2) ผู้ใช้ล็อกอินด้วย Google
- **B. Brevo (ไม่ต้องมีโดเมน):** สมัคร brevo.com → Senders → เพิ่มและยืนยันอีเมลผู้ส่ง → SMTP & API → สร้าง SMTP key (ผู้ส่งเป็น Gmail อาจเข้าสแปม)
- **C. Resend (ต้องมีโดเมนที่ยืนยันแล้ว):** ส่งหาคนทั่วไปได้เมื่อยืนยันโดเมน (เพิ่ม DNS ตามที่ Resend บอก)

เมื่อได้ SMTP: Supabase → **Authentication → Emails → SMTP Settings** → เปิด **Enable custom SMTP** แล้วกรอก Host/Port/User/Password/Sender
(Resend: `smtp.resend.com` พอร์ต 465 user `resend` password = API key · Brevo: `smtp-relay.brevo.com` พอร์ต 587)

จากนั้น **Authentication → Emails → Templates** แก้ 2 อัน (**Confirm signup** และ **Magic link**) ให้มีรหัสในเนื้อหา:

```html
<h2>รหัสเข้าสู่ระบบ</h2>
<p>รหัส 6 หลักของคุณคือ: <b>{{ .Token }}</b></p>
```

แล้วลบ `VITE_PREP_EMAIL_LOGIN` (หรือตั้งเป็นค่าอื่นที่ไม่ใช่ `off`) + Redeploy

## 6. Deploy Edge Function `prep-import` (ต้องใช้ตอนนำเข้าด้วย AI)

ทำผ่านเว็บ Supabase ได้ ไม่ต้องใช้ CLI (ใช้บน iPad ได้)

1. เปิดไฟล์ `supabase/functions/prep-import/deploy-single-file.ts` ใน GitHub (branch เดียวกัน) → กด **Raw** → คัดลอกทั้งไฟล์
2. Supabase → **Edge Functions → Deploy a new function → Via Editor**
3. ตั้งชื่อ **`prep-import`** (ต้องตรงตัว) → ลบโค้ดตัวอย่างทั้งหมด → วางโค้ดที่คัดลอก → **Deploy**
4. ตรวจ **Edge Functions → Secrets** ว่ามี `GEMINI_KEY` อยู่ (ใช้ตัวเดียวกับ `parse-exam`) ถ้าไม่มีให้เพิ่ม
5. ตัวเลือก: เพิ่ม secret `PREP_IMPORT_MODEL` เพื่อเปลี่ยนโมเดลของระดับ "ประหยัด" (ค่าเริ่มต้น `gemini-3.5-flash-lite`)
   ระดับ "ละเอียดสุด" (ค่าเริ่มต้นในหน้าแอดมิน) ใช้ Gemini Pro และถอยไปใช้ Flash อัตโนมัติถ้าโมเดลไม่พร้อม
6. ปล่อย **Verify JWT** เปิดไว้ตามค่าเริ่มต้น

ถ้าใช้ CLI: `supabase functions deploy prep-import` (ใช้ไฟล์ `index.ts` + `logic.ts` ได้เลย)
หลังแก้โค้ดใน `index.ts`/`logic.ts` ให้รัน `python3 scripts/prep/bundle_import_fn.py` เพื่อสร้างไฟล์ single-file ใหม่

ไฟล์ที่รองรับ (เลือกหลายไฟล์พร้อมกันได้): PDF, Word `.docx` (อ่านตารางและรูปในไฟล์ด้วย), รูปถ่าย/สแกน PNG JPG WebP HEIC, TXT
ไฟล์ `.doc` แบบเก่าต้องบันทึกเป็น `.docx` หรือ PDF ก่อน · รูปหลายรูปถูกอ่านต่อกันเป็นชุดเดียวตามลำดับที่เลือก

ทดสอบ: ล็อกอินเป็นแอดมินที่ `/prep` → แอดมิน → นำเข้า AI → อัปโหลดไฟล์ .txt สั้นๆ ที่มีเนื้อหา → ต้องได้ร่างข้อสอบ
(ถ้าขึ้น "ไม่มีสิทธิ์แอดมิน" แปลว่าข้อ 4 ยังไม่สำเร็จ ถ้าขึ้น Gemini error ให้ดู Edge Functions → prep-import → Logs)

## 7. นำเข้าคลังข้อสอบที่เตรียมไว้ (1,040 ข้อ)

ดาวน์โหลดไฟล์จาก GitHub (เปิดไฟล์ → Raw → บันทึกลง Files) แล้วอัปโหลดที่ **แอดมิน → นำเข้า JSON**:

| ไฟล์ | จำนวน | ผล |
|---|---|---|
| `content/prep/bank-approved.json` | 737 | เผยแพร่ทันที |
| `content/prep/bank-review.json` | 303 | เข้าคิว "ตรวจข้อสอบ" |

เลือกที่มา "ข้อสอบเก่า / เอกสารสรุป" นำเข้าซ้ำได้ ข้อซ้ำถูกข้ามอัตโนมัติ
(ทำความสะอาดแล้ว 15 ต.ค. 2569: ข้อที่ถามเลขมาตรา/เลขฎีกา 254 ข้อมี `"status": "hidden"` ในไฟล์ และคำอธิบายที่อ้าง "ชีท" ถูกเขียนใหม่ ข้อมูลก่อนแก้อยู่ใน `content/prep/backup-before-cleanup-2026-10-15.json`)
ข้อที่สร้างด้วยโค้ดสร้างเพิ่มได้: `python3 scripts/prep/gen_quant.py out.json --seed 2 --scale 3` (เลือกที่มา "สร้างด้วยโค้ด")

## 8. ตรวจ 303 ข้อรอตรวจ

แอดมิน → **ตรวจข้อสอบ** แก้โจทย์/ตัวเลือก/เฉลยในช่องได้ แล้วกด **อนุมัติ** (เผยแพร่) หรือ **ซ่อน**
เน้นข้อที่มีอ้างอิงกฎหมาย (เลขมาตรา โทษ ปี) เทียบกับต้นฉบับ ข้อที่ยังไม่อนุมัติจะไม่ขึ้นในชุดของผู้ใช้
แสดงทีละ 30 ข้อ กด "โหลดชุดถัดไป" เพื่อทำต่อ

## 9. ตั้งหน้าซื้อ

แก้ `src/prep/config.ts` (ราคา เลขบัญชี/พร้อมเพย์ ช่องทางติดต่อ ลิงก์ LINE) แล้ว commit + deploy
(ถ้าไม่ตั้ง หน้า "อัปเกรด" จะไม่บอกวิธีซื้อ)

ขายและออกคีย์: แอดมิน → **คีย์** → ใส่หมายเหตุ (ชื่อ/ยอด/เวลาโอน) → สร้าง → ส่งคีย์ให้ผู้ซื้อ
**เช็กยอดเงินเข้าในแอปธนาคารก่อนทุกครั้ง** คีย์แสดงครั้งเดียว ใช้ได้ครั้งเดียวและผูกกับบัญชีที่กรอก

## 10. ทดสอบก่อนประกาศ (ใช้บัญชี Google อีกบัญชีหนึ่ง ไม่ใช่แอดมิน)

- [ ] ล็อกอิน → สร้างชุด 10 ข้อ → ทำข้อสอบ เห็นเฉลย+คำอธิบายหลังตอบ
- [ ] ปิดแอปกลางทาง → เปิดใหม่ → "ทำต่อ" ต่อจากข้อเดิม
- [ ] ส่งผล → "ทำเฉพาะข้อผิด" → วนจนเคลียร์ได้
- [ ] สร้างครบ 3 ชุด → ชุดที่ 4 ถูกปฏิเสธ ทำซ้ำชุดเดิมยังได้
- [ ] แดชบอร์ดขึ้นตัวเลข (ต้องทำหมวดละ ≥ 10 ข้อ ผลจึงน่าเชื่อถือ)
- [ ] สร้างคีย์ด้วยแอดมิน → บัญชีนี้กรอกคีย์ → เป็นสมาชิก สร้างชุดได้เกิน 40 ข้อ
- [ ] เปิดบนมือถือจริง ตรวจหน้าตา

## ก่อนเปิดขายจริง

- Vercel Pro (Hobby ห้ามใช้เชิงพาณิชย์) และ Supabase Pro (มี backup)
- หน้าเงื่อนไขการใช้งาน / นโยบายความเป็นส่วนตัว (PDPA)
- ตรวจลิขสิทธิ์ชีทต้นฉบับ: ทุกข้อบันทึกชื่อไฟล์ต้นทางไว้ ซ่อนทั้งไฟล์ได้ด้วย SQL
  `update prep.questions set status = 'hidden' where source = 'ชื่อไฟล์';`

## สถาปัตยกรรมสั้นๆ

- ตารางทั้งหมดอยู่ใน schema `prep` (ไม่เปิดผ่าน API) — เบราว์เซอร์เรียกได้เฉพาะฟังก์ชัน `public.prep_*`
- เฉลยส่งกลับเฉพาะข้อที่ตอบแล้ว, ตรวจคะแนนและโควต้าฟรี 3 ชุดในฐานข้อมูล
- แอดมินคือบัญชีใน `prep.admins` (ไม่ใช้ License Key ของ FormAuto)
