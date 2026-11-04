#!/usr/bin/env python3
"""สร้าง SQL นำเข้าโจทย์ที่ Claude เขียน (bank-scenario-2026.json, bank-news-2026.json) เข้า prep.questions

origin ในตารางรับได้แค่ sheet/template/ai/manual จึงใช้ 'manual' และเก็บป้ายชุดไว้ใน ref:
  โจทย์สถานการณ์  ref = 'claude-scenario-2026-11'   (โหมดท้าทายดึงจาก ref นี้)
  โจทย์ข่าว        ref = 'claude-news-2026-11 | <url แหล่งข่าว>'   (ซ่อนทั้งชุด: where ref like 'claude-news-2026-11%')
ซ้ำกับของเดิม (content_hash) ข้ามไป · Usage: python3 scripts/prep/import_claude_bank.py > /tmp/x.sql
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def lit(v):
    return "null" if v is None else "'" + str(v).replace("'", "''") + "'"


rows = []
for name, tag in (("bank-scenario-2026.json", "claude-scenario-2026-11"), ("bank-news-2026.json", "claude-news-2026-11")):
    for q in json.loads((ROOT / "content" / "prep" / name).read_text()):
        ref = tag if tag.startswith("claude-scenario") else f"{tag} | {q.get('ref')}"
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
