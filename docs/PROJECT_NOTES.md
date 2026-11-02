# PROJECT_NOTES — ความจำข้ามเซสซัน

> ไฟล์นี้สรุปสิ่งที่คุยและตัดสินใจกันในทุกเซสซัน เพื่อให้เซสซันใหม่ไม่ต้องอ่านประวัติแชท/สำรวจ repo ซ้ำ
> **อ่านคู่กับ `CLAUDE.md`** (CLAUDE.md = โครงสร้าง/คำสั่ง/กฎ; ไฟล์นี้ = ประวัติ, สถานะ, งานค้าง, ความชอบของเจ้าของ)
>
> **วิธีอัปเดต (เมื่อผู้ใช้สั่ง "อัปเดต notes"):** แก้ส่วน "สถานะล่าสุด", "งานค้าง", เพิ่มบรรทัดใน "บันทึกเซสซัน" (ใหม่สุดบนสุด, 1–3 บรรทัดต่อเซสซัน), ลบสิ่งที่เสร็จ/ล้าสมัย ให้ไฟล์ยาวไม่เกิน ~250 บรรทัด แล้ว commit + push ขึ้น `main`
>
> อัปเดตล่าสุด: 2026-11-02

---

## 1. เจ้าของและบริบท

- เจ้าของ: ครูโรงเรียนวังหลวงพิทยาสาร (สพม.หนองคาย) — แอดมิน FormAuto คือ `pongsarkon@wangluangpitt.ac.th`
- คุยภาษาไทย, ใช้มือถือ (iOS/Android) + desktop app สลับกัน → ตอบสั้น ชัด มีขั้นตอนเป็นข้อ
- ธุรกิจหลักตอนนี้คือ **SOBPREP** (`sobprep.com`, `/prep`) ขายแพ็กซ้อมสอบครูผู้ช่วย
- **วันสอบภาค ข: อาทิตย์ 15 พ.ย. 2569** → ช่วงนี้เน้น growth/โปรโมท/เนื้อหาวิชาเอก

## 2. ไทม์ไลน์ย่อ (จาก git)

| ช่วง | สิ่งที่ทำ |
|---|---|
| 29–30 พ.ค. 69 | FormAuto เปิดตัว: Gemini → Google Form, ย้าย Gemini ไป Edge Function, rate limit, admin ผ่าน Edge Function, ธีมม่วง |
| 4–5 ก.ย. | Google Auth ครู, sync Google Sheet ผลสอบ, dashboard คะแนน, ธีมแดง-ทองโรงเรียน |
| 26–27 ก.ย. | Dashboard 8 กลุ่มสาระ, item analysis, คลังข้อสอบ 2,176 ข้อ, ExamPlayer + LiveProctor |
| 1–6 ต.ค. | Executive Dashboard, SGS bridge (Vercel sin1, ปิด TLS check) |
| 15–16 ต.ค. | **เริ่ม /prep**: แพ็กเกจ, Thai QR, AI import, PWA, mock exam, daily quiz, ราคาใน DB, landing `/prep/welcome/`, rename เป็น SOBPREP, โดเมน sobprep.com, ปฏิทินสอบ |
| 17 ต.ค. | Facebook page queue (`prep-fb-agent`), AI triage รายงานข้อสอบ, analytics ตามเอก, ?src= tracking |
| 22 ต.ค. | สาย สอศ. (อาชีวะ), leaderboard, level/streak, mascot + โลโก้ใหม่, group packs, promo code |
| 24–26 ต.ค. | Readiness (ERI 6 สัญญาณ), install sheet, **Gemini อย่างเดียว (ลบ DeepSeek/Qwen)**, mind-map summaries ภาค ก/ข, ข้อสอบเก่า 2566, feedback tab, filter ตาม track |
| 29 ต.ค. | UX overhaul (URL routing, 5-tab nav, หน้า Buy), design system + dark mode, flashcards, สรุปอุตสาหกรรมศิลป์, owner dashboard, key revenue |
| 30–31 ต.ค. | **LINE OA bot** (`prep-line-bot`) + แชทในแอป + สรุปแชทรายวัน, โค้ด SOB10, QR ราคาหลังลด (39/59/89/119/169), daily cap 3,000/1,000, Gemini TTS (`prep-media`) |
| 1 พ.ย. | ระบบคลิปสรุป `scripts/prep/video` + skill `prep-summary-clip` |
| 2 พ.ย. | exam-season growth (upgrade credit round→lifetime, funnel qr_view, win-back, invite, post-exam follow-up), สรุปเอกไทย 16 ผัง, stats รายวัน, **summary reviewers** (ให้สิทธิ์ตรวจสรุปตามอีเมล/ขอบเขต) |

## 3. สถานะล่าสุดของระบบ (SOBPREP)

- **ราคา (fallback ใน config.ts; ของจริงใน `prep.prices`)**: ภาค ก 49/99 · ภาค ข+เอก 69/129 · ครบ 99/179 (รายรอบ 3 เดือน / ตลอดชีพ). โค้ด **SOB10** ลด 10 บาท → มี QR ราคาตายตัว 39/59/89/119/169
- ติดต่อ: LINE OA **@701pvghq**
- ฟรี: ทำข้อสอบฟรี 3 ชุด, สรุปฟรี 1 ผังต่อวิชา (ที่เหลือมีมงกุฎ); สรุปเสิร์ฟจาก DB เพื่อไม่ให้ผังล็อกหลุดถึงผู้ใช้ฟรี
- สรุปที่อนุมัติแล้ว: ภาค ก 26 ผัง, ภาค ข 19 ผัง, อุตสาหกรรมศิลป์ 10 ผัง; **เอกไทย 16 ผังยังเป็น "ร่าง"**
- คลังวิชาเอก: เพิ่ม 240 ข้อ (จีน 100, แนะแนว 70, สุขศึกษา 40, คหกรรม 30) **รันเข้า DB จริงแล้ว** `source='claude:authored'`; เป้า ~300 ข้อ/เอก
- ตัวสร้างข้อสอบด้วย Gemini (`prep-gen-questions`) ปิดอยู่ (`enabled=false`)
- AI ที่ใช้: **Gemini เท่านั้น** (ตัดสินใจ 25 ต.ค. — อย่าเสนอกลับไปใช้ DeepSeek/Claude API ในแอป)
- Tracking: ลิงก์โปรโมทใส่ `?src=...` ดูผลที่ แอดมิน → ภาพรวม → เปรียบเทียบ (ใช้แล้ว: `fb-thai`, `fb-thai-sum`)

## 4. งานค้าง / ต้องตัดสินใจ

- [ ] **อนุมัติสรุปเอกไทย** อย่างน้อย "ราชาศัพท์และระดับภาษา" (เป็นผังฟรี) **ก่อนโพสต์โปรโมทเอกไทย** — โพสต์/แคปชัน/คอมเมนต์ปักหมุดร่างไว้แล้วในเซสซัน 2 พ.ย.
- [ ] แก้เฉลยผิดข้อภาษาไทย **#3396, #3506**
- [ ] branch ยังไม่ merge เข้า main:
  - `prep-major-bank` (ไฟล์ JSON + generator ของ 240 ข้อ; ข้อมูลใน DB ใช้งานได้แล้ว)
  - `prep-soc-summaries` (สรุปสังคมศึกษา; **ยังไม่รัน migration**, ต้องอนุมัติรายผังหลังรัน)
  - `claude/a3-tort-summary-clip-oe0nmp` (คลิปสรุป a3-tort 94.6 วิ, 3 commits)
- [ ] เขียนข้อสอบเพิ่มให้ 4 เอก (จีน/แนะแนว/สุขศึกษา/คหกรรม) จนครบ ~300 ข้อ — รอผู้ใช้สั่ง
- [ ] คลิปสรุป: ยังไม่ทำ (1) ฝังคลิปในหน้าสรุปของแอป (2) เวอร์ชันสั้นสำหรับโซเชียล — ต้องถามก่อนเริ่ม
- [ ] FormAuto: Gmail login ล้มเพราะ OAuth app เป็น Internal → ต้องเปลี่ยนเป็น External + publish (อธิบายวิธีไปแล้ว 15 ต.ค.)
- [ ] ปัญหาเดิม: `api/lib/sgsHelper.ts` ปิด TLS check; README ยังเป็น template Vite; answer-conflict detector แบบ SQL ช้าเกินบน live data (ตอนนี้ใช้แบบรันในเบราว์เซอร์แทน)

## 5. ความชอบ/กฎที่ตกลงกันแล้ว

- **ภาษา/โทน**: UI และข้อความลูกค้าเป็นไทย; แคปชันโปรโมท "ไม่ยัดเยียด", มีตัวเลขจริงที่นับจากระบบ (เช่นจำนวนการ์ด/ผัง) — ห้ามแต่งตัวเลข
- **แบรนด์**: สีแดงเลือดหมู-ทอง (burgundy/gold), มาสคอตครูมีป้ายเช็ค; ภาพโปรโมทใช้ screenshot แอปจริง
- **คลิปสรุป**: เสียงผู้ชาย **Charon** (Gemini TTS), ไม่มีเสียงเอฟเฟกต์, ใช้ข้อเท็จจริงจากสรุปในแอปเท่านั้น, ห้ามเรียกว่า "ข้อสอบจริง", ห้ามลอกคลิป/เสียงคนอื่น — รายละเอียดใน `.claude/skills/prep-summary-clip/SKILL.md`
- **ข้อสอบที่ Claude เขียน**: ทุกข้อมีคำอธิบาย, กระจายตำแหน่งข้อถูก, ตรวจซ้ำกับคลังเดิม, ติด subtopic, ติด `source='claude:authored'`; ห้ามสร้างข้อที่อ้างไฟล์/บทอ่านที่ผู้เรียนไม่เห็น; ข้อสอบ "แนวข้อสอบ" ไม่ใช่ "ข้อสอบเก่า"
- **ฐานข้อมูลจริง**: รัน migration/เขียน DB จริงเฉพาะเมื่อผู้ใช้สั่งชัดเจน
- **LINE**: ส่งข้อความหาลูกค้า/broadcast เฉพาะเมื่อผู้ใช้สั่ง และทดสอบส่งหาบัญชีเจ้าของก่อนเสมอ; สลิปรับในแอปเท่านั้น (ไม่รับทาง LINE)
- งานใหม่ทำบน branch แล้ว merge ผ่าน PR (ประวัติส่วนใหญ่เป็นแบบนี้)

## 6. สภาพแวดล้อม cloud session

- proxy แนบ credential ให้แล้ว: `api.supabase.com` (Management API — รัน SQL/ดู DB ได้), `api.vercel.com`, `api.line.me` + `api-data.line.me` (LINE OA token) → ไม่ต้องขอ key
- secret ของ TTS ไม่อยู่ใน repo: `scripts/prep/video/setup.sh` ดึงจาก Supabase มาเก็บใน `.cache/` (git ignore); แคชเสียงไม่ข้ามเซสซัน (~2–3 นาที/คลิป)
- clone เป็น shallow — ถ้าต้องดูประวัติเก่าใช้ `git fetch --unshallow origin main`

## 7. บันทึกเซสซัน (ใหม่สุดบนสุด)

- **2026-11-02 · Repository discussion summary** — สร้างไฟล์นี้จาก git history + สรุปเซสซันทั้งหมด
- **2026-11-02 · App store scaling feasibility** — ภาพโปรโมทเอกไทย (448 การ์ด), แคปชัน, คอมเมนต์ปักหมุด `src=fb-thai`; รออนุมัติผังไทย
- **2026-10-15 → 11-02 · FormAuto /prep ระบบตั้งค่า** (เซสซันหลักยาวที่สุด) — สร้างระบบ /prep เกือบทั้งหมด; ล่าสุดทำโปรโมทเอกไทย 3 ภาพ `src=fb-thai-sum`, exam-season growth, summary reviewers
- **2026-11-01 · คลิปสรุป a3-tort** — คลิป 94.6 วิ, push `claude/a3-tort-summary-clip-oe0nmp`
- **2026-10-30 → 11-01 · ทดสอบไลน์** — LINE bot, แชทในแอป, TTS, skill `prep-summary-clip` (push main)
- **2026-10-30 · สรุปและข้อสอบเพิ่มเติม** — 240 ข้อวิชาเอกเข้า DB; สรุปสังคม branch `prep-soc-summaries` ยังไม่รัน
- **2026-10-30 · ขอแคปชั่น Clickbase** — แค่ clone อ่านอย่างเดียว
- **2026-10-29 → 30 · เรียนรู้โปรเจค** — อัปเดต CLAUDE.md, สอนตั้ง Network secret LINE OA (ค้างรอผู้ใช้ตั้งตอนนั้น ตอนนี้ใช้ได้แล้ว)
- **2026-05-30 → 10-15 · from auto** — สร้าง FormAuto ช่วงแรก; อธิบายแก้ Gmail login (OAuth Internal→External)
