# FormAuto — CLAUDE.md

## Project overview

repo เดียว มี 2 แอปแยก bundle/session กัน (entry เลือกใน `src/main.tsx` ตาม pathname):

1. **FormAuto (`/`)** — ช่วยครูสร้าง Google Forms ข้อสอบอัตโนมัติ: Gemini อ่านไฟล์ (.docx/.pdf/.txt) แล้วสร้างฟอร์มพร้อมเฉลย + ระบบสอบออนไลน์ (`ExamPlayer`, `LiveProctorModal`), คลังข้อสอบ (`QuestionBank`), dashboard ผู้บริหาร (`ExecutiveDashboard`), สมุดคะแนน SGS (`SgsGradebook`)
2. **SOBPREP (`/prep`, entry `prep.html`)** — แอปซ้อมข้อสอบครูผู้ช่วย ขายเป็นแพ็ก (ก / ข+วิชาเอก / ครบ) รายรอบ 3 เดือนหรือตลอดชีพ จ่าย Thai QR แล้วยืนยันคีย์ทาง LINE (`src/prep/config.ts`) มีโหมดสอบจำลอง, quiz รายวัน, leaderboard, readiness/study plan, สรุปเนื้อหา, ข้อสอบเก่า, ปฏิทินสอบ, PWA และหลังบ้านแอดมิน (`Admin*.tsx`)

**Stack:** React 19 + TypeScript 6 + Vite 8, Supabase (auth/db/edge functions), Gemini API, Google Apps Script, Vercel (region sin1)

## Architecture

```
Browser (React SPA, lazy chunk ต่อแอป)
  ├── Supabase (RPC + RLS)            — auth, form_history, schema `prep` (เรียกผ่าน RPC prep_* เท่านั้น ห้าม expose schema ผ่าน Data API)
  ├── Supabase Edge Functions (Deno)  — proxy Gemini ซ่อน key (secret GEMINI_KEY)
  ├── Vercel functions /api/sgs/*     — bridge ไประบบ SGS สพฐ. (cookie jar, scrape ASPX)
  └── SCRIPT_URL (Google Apps Script) — สร้าง Google Form จริง
```

## Key files

- `src/main.tsx` — เลือก App หรือ PrepApp, reload เมื่อ chunk เก่าหาย
- `src/App.tsx` — แอปครูทั้งหมดในไฟล์เดียว (~9,000 บรรทัด)
- `src/prep/PrepApp.tsx` — shell ของ /prep (ทุกหน้ามี URL ผ่าน `router.ts`: pushState/popstate, ปุ่มย้อนกลับ, `useBackClose` ให้ back ปิด dialog; ยืนยัน/แจ้งเตือนใช้ `ask()`/`notify()` ใน `dialog.ts` แทน alert/confirm); `api.ts` = Supabase client (storageKey `fromauto-prep-auth`) + types + wrapper RPC; `config.ts` = ร้าน/แพ็กเกจ/QR; `levels.ts` = XP/เลเวลมาสคอต
- `supabase/functions/` — `parse-exam`, `admin-action`, `sgs-bridge` (แอปครู); `prep-import`, `prep-ai-review`, `prep-gen-questions`, `prep-report-ai`, `prep-fb-agent`, `prep-subtopic-tag`, `prep-line-bot` (prep; LINE OA webhook: คำสำคัญ → ข้อความพรีเซต, ที่เหลือ Gemini ตอบ; logic แยกใน `logic.ts` มีเทสต์ใน `scripts/prep/test_*.mjs`)
- `supabase/migrations/` — ~70 ไฟล์ ตั้งชื่อ `YYYYMMDDHHMMSS_*.sql` รันตามลำดับ; ของ prep ขึ้นต้น `prep_`
- `api/sgs/*`, `api/lib/sgsHelper.ts` — Vercel functions SGS (vite.config.ts mount middleware เดียวกันตอน dev)
- `content/prep/*.json` — คลังข้อสอบ; `content/summaries/*.ts` — สรุปเนื้อหา; `docs/` — คู่มือเปิดระบบ + blueprint วิชาเอก/อาชีวะ
- `scripts/prep/` — generator (landing, หน้า sample, ข้อสอบเชิงปริมาณ, QR, bundle prep-import เป็นไฟล์เดียว)
- `vercel.json` — rewrite `/prep*` → `prep.html`, header ความปลอดภัย, redirect `sobprep.com` → `/prep/welcome/`
- `.env` (ไม่อยู่ใน repo) — `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`, `VITE_SCRIPT_URL`; ตัวเลือก `VITE_GEMINI_API_KEY`, `VITE_PREP_EMAIL_LOGIN=off` (ซ่อนล็อกอินอีเมล, ต้อง redeploy เพราะฝังตอน build)

## Commands

`npm run dev` · `npm run build` (tsc -b && vite build) · `npm run lint` · เทสต์ logic: `node scripts/prep/test_*_logic.mjs`

## Conventions / gotchas

- ข้อความ UI และคอมเมนต์ธุรกิจเป็นภาษาไทย; แก้ `prep-import/index.ts` หรือ `logic.ts` แล้วรัน `python3 scripts/prep/bundle_import_fn.py` เพื่อสร้าง `deploy-single-file.ts` ใหม่
- ฟังก์ชัน `prep_*` ต้องไม่เปิดให้ `anon` เรียก (ยกเว้น `prep_topics`); migration ใหม่ต้องคง RLS/grant นี้
- migration schema รันซ้ำไม่ได้ — เพิ่มไฟล์ใหม่ อย่าแก้ไฟล์เก่า
- ราคาจริงอยู่ใน DB (`prep.prices`); ค่าใน `config.ts` เป็น fallback; QR ราคาใหม่ทำด้วย `scripts/prep/make_qr.py`
- ปัญหาที่รู้: `api/lib/sgsHelper.ts` ปิดตรวจ TLS (`NODE_TLS_REJECT_UNAUTHORIZED=0`); README ยังเป็น template Vite

## Deploy checklist

1. `supabase secrets set GEMINI_KEY=<your-key>`
2. รัน migration ใหม่ใน Supabase; `supabase functions deploy <name>` (หรือวางไฟล์ single-file ผ่านเว็บ)
3. Vercel: ตั้ง env `VITE_*` แล้ว redeploy; ตรวจ Redirect URLs ของ Supabase Auth
4. รายละเอียดเปิดระบบ /prep: `docs/prep-launch.md`

## Scrutinize — ใช้ทุกครั้งก่อนทำ code change

ก่อน implement การเปลี่ยนแปลงใดๆ ให้รัน workflow นี้ตามลำดับ:

### 1. Intent
- บอกเป้าหมายใน 1 ประโยค ด้วยคำของตัวเอง
- ถาม: มีวิธีง่ายกว่า/เล็กกว่า/สง่างามกว่านี้ไหม? (ไม่ทำเลย / ใช้สิ่งที่มีอยู่แล้ว / แก้ที่ layer อื่น)
- ถ้ามีทางเลือกที่ดีกว่า — บอกก่อนลงมือ

### 2. Trace
- เดิน code path จริงตั้งแต่ entry point → call sites → state mutated → exit
- ดูโค้ดรอบๆ diff ด้วย ไม่ใช่แค่บรรทัดที่เปลี่ยน
- จด surprise ทุกอย่าง (unexpected branch, dead code, state ที่ไม่คาดคิด)

### 3. Verify
- ยืนยันว่า code path ที่ trace มาทำได้จริงตามที่อ้าง
- หา edge cases: null/empty, concurrent, partial failure, ordering assumptions
- ดูว่า silently เปลี่ยนอะไรไหม (performance, error semantics, contract ของ caller อื่น)

### 4. Report
- เรียง finding ตาม severity: blocker → major → nit
- ทุก finding: **what** (file:line) + **why it matters** + **evidence** + **suggested change**
- จบด้วย verdict 1 บรรทัด: ship / fix-then-ship / rework / reject + เหตุผลหลัก

### Rules
- ไม่ rubber-stamp — ถ้าไม่เจออะไร บอกว่า trace อะไรไปบ้าง
- Cite หรือไม่นับ — ทุก claim อ้าง file:line
- ถ้า step 1-2 เจอปัญหาจริง — นำก่อน อย่า pad ด้วย style nits
