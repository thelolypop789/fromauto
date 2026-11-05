"""เครื่องมือร่วมของสคริปต์เขียนโจทย์ (รอบ 3 ขึ้นไป): add(), จัดตำแหน่งข้อถูก, ตรวจความยาวตัวเลือก, เขียนไฟล์

- ข้อถูกเขียนไว้ตัวแรก แล้วสลับตำแหน่งแบบกำหนดได้ ให้ ก ข ค ง กระจายเท่ากันในแต่ละหมวด
- ห้ามบรรทัดว่างในโจทย์ ("\\n\\n" ทำให้ VerseText จัดเป็นคำประพันธ์) และห้ามช่องว่าง 3 ตัวติดกัน
- LONGER: ตัวลวงที่สั้นกว่าข้อถูกมาก ให้ใส่เวอร์ชันยาวไว้ในพจนานุกรมนี้ (ยังผิดเหมือนเดิม)
"""
import json
import random
from collections import Counter


class Bank:
    def __init__(self, seed):
        self.q = []
        self.seed = seed
        self.longer = {}
        self.shorter = {}   # ข้อถูกที่อธิบายเกิน → เวอร์ชันสั้น (ความหมายเดิม)

    def add(self, topic, level, ask, correct, wrong, why, stim=None, ref=None, sub=None, law_ref=None):
        stem = f"{stim}\n{ask}" if stim else ask
        assert "\n\n" not in stem and "   " not in stem, stem[:60]
        ch = [str(correct)] + [str(w) for w in wrong]
        assert len(ch) == 4 and len(set(ch)) == 4, (ask, ch)
        self.q.append(dict(topic=topic, subtopic=sub, level=level, stem=stem, correct=str(correct), wrong=[str(w) for w in wrong],
                           explanation=why, law_ref=law_ref, ref=ref))

    def build(self, path, ref_default):
        rng = random.Random(self.seed)
        out = []
        topics = list(dict.fromkeys(q["topic"] for q in self.q))
        for t in topics:
            items = [q for q in self.q if q["topic"] == t]
            slots = [i % 4 for i in range(len(items))]
            rng.shuffle(slots)
            for q, pos in zip(items, slots):
                ch = [self.longer.get(w, w) for w in q["wrong"]]
                cor = self.shorter.get(q["correct"], q["correct"])
                assert cor not in ch and len(set(ch)) == 3, q["stem"][:50]
                rng.shuffle(ch)
                ch.insert(pos, cor)
                out.append(dict(topic=t, subtopic=q["subtopic"], level=q["level"], stem=q["stem"], choices=ch, answer=pos,
                                explanation=q["explanation"], law_ref=q["law_ref"], ref=q["ref"] or ref_default,
                                source="claude:authored", status="review"))
        stems = [q["stem"] for q in out]
        assert len(stems) == len(set(stems)), "duplicate stem"
        path.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
        longest = [i for i, q in enumerate(out) if max(range(4), key=lambda k: len(q["choices"][k])) == q["answer"]]
        big = [i for i, q in enumerate(out)
               if len(q["choices"][q["answer"]]) > 1.25 * max(len(c) for k, c in enumerate(q["choices"]) if k != q["answer"])]
        print(path.name, len(out), dict(Counter(q["topic"] for q in out)))
        print("  correct is longest:", len(longest), "of", len(out), "· big gaps:", big)
        return out
