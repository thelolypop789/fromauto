"""แนวข้อสอบ ครูผู้ช่วย สพฐ. รอบทั่วไป 2569 (ภาค ก ภาษาอังกฤษ, 14 พ.ย. 2569) — ชุด e

ที่มา: ภาพเฉลยของติวเตอร์ที่ผู้ใช้ส่งมา (เรียกว่า "แนวข้อสอบ" เสมอ) — เขียนประโยคใหม่ หาเฉลยเอง
มีแล้ว ไม่เพิ่ม: turn off the light (ชุด c), widen (ชุด d), I ___ my keys (ชุด c — ภายหลังปรับ id 15407 เป็นฉบับข้อสอบ
lose / lost / am losing / have lost เฉลย have lost ตามภาพติวเตอร์สองแหล่ง)
python3 scripts/prep/recall_2569e_bank.py → content/prep/bank-recall-2569e.json
"""
import json
import random
from pathlib import Path

from bankkit import Bank

ROOT = Path(__file__).resolve().parents[2]
TAG = "แนวข้อสอบ ครูผู้ช่วย สพฐ. รอบทั่วไป 2569 (จากผู้เข้าสอบ)"
b = Bank(seed=256918)

b.add("A2-GRAMMAR", "apply",
      "You ___ wear a helmet when you ride a motorcycle. It's the law.",
      "must", ["might", "could", "would rather"],
      "It's the law บอกว่าเป็นข้อบังคับตามกฎหมาย จึงใช้ must (ต้อง) ส่วน might/could แสดงความเป็นไปได้ และ would rather แสดงความชอบมากกว่า")

b.add("A2-GRAMMAR", "apply",
      "Nina speaks English ___ than her brother.",
      "more fluently", ["fluent", "fluently", "more fluent"],
      "คำที่ขยายกริยา speaks ต้องเป็นคำวิเศษณ์ (fluently) และมี than จึงต้องใช้ขั้นกว่า more fluently "
      "ส่วน fluent และ more fluent เป็นคำคุณศัพท์ ขยายกริยาไม่ได้")

b.add("A2-GRAMMAR", "apply",
      "If the temperature ___ below zero tonight, the pond will freeze.",
      "drops", ["dropped", "will drop", "drop"],
      "ประโยคเงื่อนไขแบบที่ 1 (เรื่องที่อาจเกิดขึ้นจริงในอนาคต) ใช้ If + present simple, ... will + V1 "
      "ประธาน the temperature เป็นเอกพจน์ กริยาจึงเติม s เป็น drops (ห้ามใช้ will ในประโยค if)")

b.add("A2-GRAMMAR", "apply",
      "Choose the grammatically correct sentence.",
      "The soup tastes delicious.", ["The soup tastes deliciously.", "The soup taste delicious.", "The soup is taste delicious."],
      "taste ในความหมายว่า มีรสชาติ เป็น linking verb ต้องตามด้วยคำคุณศัพท์ (delicious) ไม่ใช่คำวิเศษณ์ (deliciously) "
      "ประธาน the soup เป็นเอกพจน์ กริยาจึงเป็น tastes และไม่ต้องมี is นำหน้า")

b.add("A2-GRAMMAR", "apply",
      "Which sentence uses there is / there are correctly?",
      "There is a new notice on the board.", ["There are a new notice on the board.", "There have a new notice on the board.", "There is new notices on the board."],
      "a new notice เป็นคำนามเอกพจน์ จึงใช้ There is ถ้าเป็นพหูพจน์ต้องเป็น There are new notices "
      "และภาษาอังกฤษไม่ใช้ There have ในความหมายว่า มี")

b.add("A2-GRAMMAR", "apply",
      "We cancelled the picnic ___ it was raining heavily.",
      "because", ["but", "unless", "although"],
      "ประโยคหลังเป็นเหตุผลของประโยคแรก (ยกเลิกปิกนิกเพราะฝนตกหนัก) จึงใช้ because "
      "but แปลว่า แต่ unless แปลว่า เว้นแต่ และ although แปลว่า แม้ว่า ซึ่งขัดกับความหมาย")

b.add("A2-VOCAB", "apply",
      "The students worked together to ___ the classroom before the parents arrived.",
      "tidy", ["enter", "attend", "damage"],
      "tidy (v.) แปลว่า จัดให้เป็นระเบียบ ทำให้เรียบร้อย เหมาะกับการเตรียมห้องก่อนผู้ปกครองมา "
      "enter คือเข้าไป attend คือเข้าร่วม และ damage คือทำให้เสียหาย")

b.add("A2-VOCAB", "apply",
      "The teacher asked the students to ___ their answers before handing in the test.",
      "review", ["collect", "compare", "explain"],
      "review แปลว่า ทบทวน ตรวจดูอีกครั้ง ซึ่งเป็นสิ่งที่ควรทำก่อนส่งข้อสอบ "
      "collect คือรวบรวม compare คือเปรียบเทียบ (การเทียบคำตอบกับเพื่อนไม่เหมาะในการสอบ) และ explain คืออธิบาย")

b.add("A2-VOCAB", "apply",
      "The farmer removed the weeds from the garden.\nThe word \"removed\" is closest in meaning to ___.",
      "took away", ["put in", "looked after", "gave up"],
      "remove แปลว่า เอาออก กำจัด ความหมายใกล้กับ take away (เอาออกไป) ในประโยคนี้คือถอนวัชพืชออก "
      "ส่วน put in คือใส่หรือปลูกลงไป looked after คือดูแล และ gave up คือเลิก ยอมแพ้")

b.add("A2-VOCAB", "apply",
      "The night market was very crowded on Saturday.\nThe word \"crowded\" is closest in meaning to ___.",
      "full", ["empty", "quiet", "closed"],
      "crowded แปลว่า แออัด มีคนจำนวนมาก ความหมายใกล้กับ full (of people) "
      "ส่วน empty คือว่างเปล่า quiet คือเงียบ และ closed คือปิด")

out = b.build(ROOT / "content" / "prep" / "bank-recall-2569e.json", TAG)
slots = [i % 4 for i in range(len(out))]
random.Random(25691118).shuffle(slots)
for q, pos in zip(out, slots):
    cor = q["choices"].pop(q["answer"])
    q["choices"].insert(pos, cor)
    q["answer"] = pos
for q in out:
    q["exam_tag"] = TAG
    q["source"] = "เรียบเรียงใหม่ · " + TAG
(ROOT / "content" / "prep" / "bank-recall-2569e.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
