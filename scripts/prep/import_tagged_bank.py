#!/usr/bin/env python3
"""สร้าง SQL นำเข้าชุดโจทย์ที่มีป้ายแนวข้อสอบ (exam_tag) ในตัว เช่น bank-soc-2569-deep.json, bank-ia-2569.json

ต่างจาก import_claude_bank.py ตรงที่ใช้ exam_tag / ref / source จากไฟล์ JSON ตรง ๆ (หน้า /prep/past จัดกลุ่มตาม exam_tag)
origin 'manual' · status 'approved' · ซ้ำกับของเดิม (content_hash) ข้ามไป
Usage: python3 scripts/prep/import_tagged_bank.py bank-xxx.json [...] > x.sql && python3 scripts/prep/ops/ops.py sql x.sql
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def lit(v):
    return "null" if v is None else "'" + str(v).replace("'", "''") + "'"


rows = []
for name in sys.argv[1:]:
    for q in json.loads((ROOT / "content" / "prep" / name).read_text()):
        assert q.get("exam_tag") and q.get("ref") and q.get("source"), (name, q["stem"][:40])
        choices = json.dumps(q["choices"], ensure_ascii=False)
        rows.append("(" + ", ".join([lit(q["topic"]), lit(q.get("subtopic")), lit(q["level"]), lit(q["stem"]), lit(choices) + "::jsonb",
                                     str(int(q["answer"])), lit(q["explanation"]), lit(q.get("law_ref")), lit(q["ref"]),
                                     lit(q["source"]), lit(q["exam_tag"])]) + ")")
if not rows:
    sys.exit("ระบุไฟล์ใน content/prep อย่างน้อยหนึ่งไฟล์")

print("insert into prep.questions (topic, subtopic, level, stem, choices, answer, explanation, law_ref, ref, source, exam_tag, origin, status, content_hash)")
print("select v.topic, v.subtopic, v.level, trim(v.stem), v.choices, v.answer, v.explanation, v.law_ref, v.ref, v.source, v.exam_tag, 'manual', 'approved',")
print("       prep.content_hash(trim(v.stem), v.choices)")
print("from (values")
print(",\n".join(rows))
print(") as v(topic, subtopic, level, stem, choices, answer, explanation, law_ref, ref, source, exam_tag)")
print("on conflict (content_hash) do nothing;")
