# FormAuto — CLAUDE.md

## Project overview

Web app ที่ช่วยครูสร้าง Google Forms ข้อสอบแบบอัตโนมัติ ผ่าน AI (Gemini) ที่อ่านไฟล์ข้อสอบ (.docx/.pdf/.txt) แล้ว generate form พร้อมเฉลยให้ทันที

**Stack:** React 19 + TypeScript + Vite  
**Services:** Supabase (auth/db), Gemini API (AI parse), Google Apps Script (create Form)  
**Deploy target:** Static frontend — ไม่มี backend server ของตัวเอง

## Architecture

```
Browser (React SPA)
  ├── Supabase        — license key auth, form_history table
  ├── Gemini API      — อ่านและแปลงไฟล์ข้อสอบเป็น JSON
  └── SCRIPT_URL      — Google Apps Script สร้าง Google Form จริงๆ
```

## Key files

- `src/App.tsx` — ทั้งแอปอยู่ในไฟล์เดียว (~1,050 บรรทัด)
- `vite.config.ts` — Vite config
- `.env` (ไม่อยู่ใน repo) — ต้องมี VITE_SUPABASE_URL, VITE_SUPABASE_KEY, VITE_SCRIPT_URL, VITE_GEMINI_KEY

## Known issue (production blocker)

`VITE_GEMINI_KEY` ถูก bundle ลงใน JS bundle → ใครก็เห็นได้  
ต้องย้ายการเรียก Gemini ไปไว้ฝั่ง server (Supabase Edge Function หรือ Vercel API route) ก่อน deploy จริง

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
