"""แนวข้อสอบอุตสาหกรรมศิลป์ 2569 (ยากและลึก) — 200 ข้อ จากฟีดแบ็กผู้เข้าสอบภาค ข 15 พ.ย. 2569

ที่มา: คอมเมนต์ผู้สอบในกลุ่มเอกอุตสาหกรรมศิลป์ (เจ้าของส่งภาพมา) — สัดส่วนหมวดตามที่ผู้สอบนับ: ก่อสร้าง 19 ไฟฟ้า 17 ยนต์ 15 กล 15 เชื่อม 13 อื่น ๆ 21
- ref="recall" = ประเด็นที่ผู้สอบเล่า (23 ข้อ เขียนใหม่ หาเฉลยเอง) → exam_tag แนวข้อสอบ 2569 (จากผู้เข้าสอบ)
- ที่เหลือ = แต่งเพิ่มตามแนวเดียวกัน (ลึก/คำนวณ/อ่านรหัส) → exam_tag แนวข้อสอบอุตสาหกรรมศิลป์ 2569 (ยากและลึก)
- ทุกข้อติดหัวข้อย่อยตามสาขาช่าง (ใหม่: B3-INDART-MACH งานช่างกลโรงงาน)
- ประเด็นที่ผู้สอบเล่าแต่คลังมีอยู่แล้ว: ลำดับจุดระเบิด #2924, เทอร์โมพลาสติก/เทอร์โมเซต #2275 #2276, ต่อเดือย #2059 → ติดป้าย 2569 ให้ข้อเดิม
- ไม่ได้ใส่ (ข้อมูลไม่พอ): สัญลักษณ์ ST ในงานเขียนแบบ, ระยะออฟเซ็ตงานเขียนแบบ
python3 scripts/prep/ia2569_bank.py → content/prep/bank-ia-2569.json
"""
import json
import random
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bankkit import Bank
from ia2569 import auto, elec, fixes, mach, mason, metal, others

ROOT = Path(__file__).resolve().parents[2]
TAG_RECALL = "แนวข้อสอบ ครูผู้ช่วย สพฐ. รอบทั่วไป 2569 (จากผู้เข้าสอบ)"
TAG_DEEP = "แนวข้อสอบอุตสาหกรรมศิลป์ 2569 (ยากและลึก)"
b = Bank(seed=2569151)
for m in (mason, elec, auto, mach, metal, others):
    m.add(b)
b.shorter.update(fixes.SHORTER)
b.longer.update(fixes.LONGER)
recall_stems = {q["stem"] for q in b.q if q["ref"] == "recall"}
for q in b.q:
    q["ref"] = None
OUT = ROOT / "content" / "prep" / "bank-ia-2569.json"
out = b.build(OUT, TAG_DEEP)
for q in out:
    rec = q["stem"] in recall_stems
    q["exam_tag"] = TAG_RECALL if rec else TAG_DEEP
    q["ref"] = "ia2569-recall" if rec else "ia2569-deep"
    q["source"] = ("เรียบเรียงใหม่ · " + TAG_RECALL) if rec else ("claude:authored · " + TAG_DEEP)
OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
print("recall", sum(q["exam_tag"] == TAG_RECALL for q in out), "· by sub", dict(Counter(q["subtopic"] for q in out)))
print("answer pos", dict(Counter(q["answer"] for q in out)))
