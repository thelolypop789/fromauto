#!/usr/bin/env python3
"""สร้าง SQL นำเข้าโจทย์ที่ Claude เขียน (bank-scenario-2026.json, bank-news-2026.json) เข้า prep.questions

origin ในตารางรับได้แค่ sheet/template/ai/manual จึงใช้ 'manual' และเก็บป้ายชุดไว้ใน ref:
  โจทย์สถานการณ์  ref = 'claude-scenario-2026-11'   (โหมดท้าทายดึงจาก ref นี้)
  โจทย์ข่าว        ref = 'claude-news-2026-11 | <url แหล่งข่าว>'   (ซ่อนทั้งชุด: where ref like 'claude-news-2026-11%')
  วิชาเอกเติมคลัง   ref = 'claude-major-2026-11'
ซ้ำกับของเดิม (content_hash) ข้ามไป · Usage: python3 scripts/prep/import_claude_bank.py [bank-xxx.json ...] > x.sql
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def lit(v):
    return "null" if v is None else "'" + str(v).replace("'", "''") + "'"


import sys

# ไม่ระบุไฟล์ = ชุดแรก (สถานการณ์ + ข่าว) · ระบุชื่อไฟล์ใน content/prep เพื่อนำเข้าเฉพาะรอบใหม่ เช่น bank-pisa-2026.json
FILES = {"bank-scenario-2026.json": "claude-scenario-2026-11", "bank-news-2026.json": "claude-news-2026-11",
         "bank-pisa-2026.json": "claude-scenario-2026-11", "bank-pisa2-2026.json": "claude-scenario-2026-11",
         "bank-round3-2026.json": "claude-scenario-2026-11", "bank-news2-2026.json": "claude-news-2026-11",
         "bank-round4-2026.json": "claude-scenario-2026-11", "bank-round5-2026.json": "claude-scenario-2026-11",
         "bank-round5b-2026.json": "claude-scenario-2026-11",
         # วิชาเอกที่คลังบาง (17 พ.ย. 2569): ref เดียวทั้งชุด ซ่อน/ถอนได้ด้วย where ref = 'claude-major-2026-11'
         "bank-major-sci-2026-11.json": "claude-major-2026-11", "bank-major-agri-2026-11.json": "claude-major-2026-11",
         "bank-major-early-2026-11.json": "claude-major-2026-11", "bank-major-eng-2026-11.json": "claude-major-2026-11",
         "bank-major-math-2026-11.json": "claude-major-2026-11"}
picked = sys.argv[1:] or ["bank-scenario-2026.json", "bank-news-2026.json"]
rows = []
for name, tag in ((n, FILES[n]) for n in picked):
    for q in json.loads((ROOT / "content" / "prep" / name).read_text()):
        ref = f"{tag} | {q.get('ref')}" if tag.startswith("claude-news") else tag
        choices = json.dumps(q["choices"], ensure_ascii=False)
        rows.append("(" + ", ".join([lit(q["topic"]), lit(q.get("subtopic")), lit(q["level"]), lit(q["stem"]), lit(choices) + "::jsonb",
                                     str(int(q["answer"])), lit(q["explanation"]), lit(q.get("law_ref")), lit(ref)]) + ")")

print("insert into prep.questions (topic, subtopic, level, stem, choices, answer, explanation, law_ref, ref, origin, source, status, content_hash)")
print("select v.topic, v.subtopic, v.level, trim(v.stem), v.choices, v.answer, v.explanation, v.law_ref, v.ref, 'manual', 'claude:authored', 'approved',")
print("       prep.content_hash(trim(v.stem), v.choices)")
print("from (values")
print(",\n".join(rows))
print(") as v(topic, subtopic, level, stem, choices, answer, explanation, law_ref, ref)")
print("on conflict (content_hash) do nothing;")
