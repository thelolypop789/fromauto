"""แนวข้อสอบ ครูผู้ช่วย สพฐ. รอบทั่วไป 2569 (ภาค ก ภาษาอังกฤษ, 14 พ.ย. 2569) จากผู้เข้าสอบ — ชุด i

ที่มา: ภาพเฉลยของติวเตอร์สองแหล่งที่ผู้ใช้ส่งมา (เรียกว่า "แนวข้อสอบ" เสมอ) — enjoy + V-ing
ชุด d ไม่ได้ใส่เพราะคลังมีข้อแนวเดียวกัน (#6152) แต่ข้อนั้นไม่มีแท็ก 2569 จึงเพิ่มฉบับที่ออกสอบไว้ในแท็ก
ข้ออื่นในภาพชุดนี้มีแล้ว: dinner / were having (ชุด c), my keys (ชุด c — ปรับเป็น have lost ตามข้อสอบ), must (ชุด e),
โน้ต Kru Nick 8 ประเด็น (ชุด a, b, g)
python3 scripts/prep/recall_2569i_bank.py → content/prep/bank-recall-2569i.json
"""
import json
import random
from pathlib import Path

from bankkit import Bank

ROOT = Path(__file__).resolve().parents[2]
TAG = "แนวข้อสอบ ครูผู้ช่วย สพฐ. รอบทั่วไป 2569 (จากผู้เข้าสอบ)"
b = Bank(seed=256922)

b.add("A2-GRAMMAR", "apply",
      "My grandparents enjoy ___ in the park on Sunday mornings.",
      "walking", ["walk", "walked", "to walk"],
      "กริยา enjoy ต้องตามด้วยกริยาเติม -ing (gerund) เสมอ เช่น enjoy walking, enjoy reading "
      "จึงใช้ walk, walked หรือ to walk ตามหลัง enjoy ไม่ได้")

OUT = ROOT / "content" / "prep" / "bank-recall-2569i.json"
out = b.build(OUT, TAG)
rng = random.Random(25691122)
for q in out:
    pos = rng.randrange(4)
    cor = q["choices"].pop(q["answer"])
    q["choices"].insert(pos, cor)
    q["answer"] = pos
    q["exam_tag"] = TAG
    q["source"] = "เรียบเรียงใหม่ · " + TAG
OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
