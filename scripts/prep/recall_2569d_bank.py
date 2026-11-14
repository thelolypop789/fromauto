"""แนวข้อสอบ ครูผู้ช่วย สพฐ. รอบทั่วไป 2569 (ภาค ก ภาษาอังกฤษ, 14 พ.ย. 2569) — ชุด d

ที่มา: ภาพเฉลยของติวเตอร์ที่ผู้ใช้ส่งมา (ภาพเขียนว่า "เฉลยข้อสอบจริง" แต่ในระบบเรียกว่า "แนวข้อสอบ" เสมอ) — เขียนประโยคใหม่ หาเฉลยเอง
มีในคลังแล้ว ไม่เพิ่ม: enjoy + V-ing (#6152), We ___ dinner when the lights went out (ชุด c)
python3 scripts/prep/recall_2569d_bank.py → content/prep/bank-recall-2569d.json
"""
import json
import random
from pathlib import Path

from bankkit import Bank

ROOT = Path(__file__).resolve().parents[2]
TAG = "แนวข้อสอบ ครูผู้ช่วย สพฐ. รอบทั่วไป 2569 (จากผู้เข้าสอบ)"
b = Bank(seed=256917)

b.add("A2-VOCAB", "remember",
      "Which word is closest in meaning to \"widen\"?",
      "enlarge", ["develop", "renovate", "relocate"],
      "widen แปลว่า ทำให้กว้างขึ้น ขยาย ความหมายใกล้กับ enlarge (ทำให้ใหญ่ขึ้น) ส่วน develop คือพัฒนา renovate คือปรับปรุงซ่อมแซม และ relocate คือย้ายที่ตั้ง")

b.add("A2-GRAMMAR", "apply",
      "There isn't ___ space left on the bookshelf.",
      "much", ["many", "a few", "several"],
      "space (และ room ในความหมายว่า ที่ว่าง) เป็นคำนามนับไม่ได้ ประโยคปฏิเสธกับคำนามนับไม่ได้ใช้ much "
      "ส่วน many, a few และ several ใช้กับคำนามนับได้พหูพจน์")

b.add("A2-VOCAB", "apply",
      "Teachers must obtain permission before using the meeting room.\nThe word \"obtain\" is closest in meaning to ___.",
      "receive", ["grant", "request", "confirm"],
      "obtain แปลว่า ได้รับ ได้มา ในประโยคนี้หมายถึงต้องได้รับอนุญาตก่อนใช้ห้อง จึงใกล้กับ receive "
      "ส่วน grant คือให้อนุญาต (เป็นฝ่ายให้ ไม่ใช่ฝ่ายรับ) request คือขอ ซึ่งยังไม่ได้รับ และ confirm คือยืนยัน")

out = b.build(ROOT / "content" / "prep" / "bank-recall-2569d.json", TAG)
slots = [i % 4 for i in range(len(out))]
random.Random(25691117).shuffle(slots)
for q, pos in zip(out, slots):
    cor = q["choices"].pop(q["answer"])
    q["choices"].insert(pos, cor)
    q["answer"] = pos
for q in out:
    q["exam_tag"] = TAG
    q["source"] = "เรียบเรียงใหม่ · " + TAG
(ROOT / "content" / "prep" / "bank-recall-2569d.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
