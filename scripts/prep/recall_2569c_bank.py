"""แนวข้อสอบ ครูผู้ช่วย สพฐ. รอบทั่วไป 2569 (ภาค ก ภาษาอังกฤษ, 14 พ.ย. 2569) จากผู้เข้าสอบ — ชุด c

ไฟล์แยกจากชุด a/b (ไม่เพิ่มข้อลงไฟล์ที่นำเข้าแล้ว) · เขียนประโยคใหม่ แนวเดียวกับที่ผู้สอบเล่า · หาเฉลยเอง
ไม่ได้ใส่: "Sure, I don't care" (ไม่รู้โจทย์), unexpected/widen/obtain (คลังมี obtain แล้ว #6213 และจำโจทย์ไม่ครบ),
"Delicious" (ไม่รู้โจทย์)
python3 scripts/prep/recall_2569c_bank.py → content/prep/bank-recall-2569c.json
"""
import json
import random
from pathlib import Path

from bankkit import Bank

ROOT = Path(__file__).resolve().parents[2]
TAG = "แนวข้อสอบ ครูผู้ช่วย สพฐ. รอบทั่วไป 2569 (จากผู้เข้าสอบ)"
b = Bank(seed=256916)

b.add("A2-GRAMMAR", "apply",
      "I ___ my keys. Have you seen them?",
      "lost", ["lose", "losing", "have losing"],
      "ประโยคหลังถามว่าเห็นกุญแจไหม แปลว่าการทำหายเกิดขึ้นแล้ว จึงใช้กริยาช่องที่ 2 lost (ถ้ามีตัวเลือก have lost ก็ถูกเช่นกัน) "
      "lose เป็นปัจจุบันกาลซึ่งไม่เข้ากับบริบท losing ต้องมี am นำหน้า และ have losing ผิดรูป เพราะ have ต้องตามด้วยกริยาช่องที่ 3")

b.add("A2-GRAMMAR", "apply",
      "We ___ dinner when the lights went out.",
      "were having", ["are having", "have had", "will have"],
      "เหตุการณ์ที่กำลังดำเนินอยู่ในอดีต (กำลังกินข้าว) แล้วมีอีกเหตุการณ์แทรกเข้ามา (ไฟดับ ใช้ past simple went out) "
      "เหตุการณ์ที่กำลังทำอยู่ใช้ past continuous คือ were having")

b.add("A2-GRAMMAR", "apply",
      "Could you hold this box ___ I open the door?",
      "while", ["during", "unless", "so"],
      "while แปลว่า ในขณะที่ ใช้เชื่อมประโยคสองประโยคที่เกิดขึ้นพร้อมกัน (ถือกล่องไว้ในขณะที่ฉันเปิดประตู) "
      "during ต้องตามด้วยคำนาม ไม่ใช่ประโยค unless แปลว่า เว้นแต่ และ so แปลว่า ดังนั้น ไม่เข้ากับความหมาย")

b.add("A2-VOCAB", "apply",
      "Please ___ the lights before you leave the room.",
      "turn off", ["turn on", "turn up", "turn down"],
      "ก่อนออกจากห้องควร ปิดไฟ ซึ่งใช้ turn off ส่วน turn on คือเปิด turn up คือเพิ่มเสียงหรือความแรง และ turn down คือลดเสียงหรือปฏิเสธ")

b.add("A2-VOCAB", "remember",
      "Which word is closest in meaning to \"discover\"?",
      "find", ["borrow", "hide", "forget"],
      "discover แปลว่า ค้นพบ หรือ พบ ความหมายใกล้เคียงกับ find ส่วน borrow คือยืม hide คือซ่อน และ forget คือลืม")

b.add("A2-GRAMMAR", "apply",
      "Which sentence is written correctly?",
      "Our school trip to Chiang Mai is on Monday.",
      ["Our school trip to chiang mai is on Monday.", "Our school trip to Chiang Mai is on monday.", "our school trip to Chiang Mai is on Monday."],
      "ในภาษาอังกฤษ คำแรกของประโยค ชื่อเฉพาะ (Chiang Mai) และชื่อวันในสัปดาห์ (Monday) ต้องขึ้นต้นด้วยตัวพิมพ์ใหญ่เสมอ")

b.add("A2-CONV", "apply",
      "Choose the most appropriate response.\nA: Would you like some coffee?\nB: ___",
      "Yes, please.",
      ["Yes, I like.", "No, I don't like you.", "Sure, I don't care."],
      "การตอบรับข้อเสนออย่างสุภาพใช้ Yes, please. หรือปฏิเสธว่า No, thank you. "
      "Yes, I like. ผิดไวยากรณ์ เพราะ like ต้องมีกรรม No, I don't like you. หยาบคาย และ Sure, I don't care. ฟังเหมือนไม่ใส่ใจ ไม่สุภาพ")

out = b.build(ROOT / "content" / "prep" / "bank-recall-2569c.json", TAG)
slots = [i % 4 for i in range(len(out))]
random.Random(25691116).shuffle(slots)
for q, pos in zip(out, slots):
    cor = q["choices"].pop(q["answer"])
    q["choices"].insert(pos, cor)
    q["answer"] = pos
for q in out:
    q["exam_tag"] = TAG
    q["source"] = "เรียบเรียงใหม่ · " + TAG
(ROOT / "content" / "prep" / "bank-recall-2569c.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
