"""Generate template-based quantitative / logic questions for FormAuto Prep.

Answers are computed, so they are always correct. Output is the JSON array accepted by the
admin import page (topic, level, stem, choices[4], answer, explanation).

    python3 scripts/prep/gen_quant.py out.json [--seed 1] [--scale 1]
"""
import json
import random
import sys
from fractions import Fraction


def fmt(n):
    if isinstance(n, Fraction):
        n = float(n)
    if isinstance(n, float):
        return f"{n:,.2f}".rstrip("0").rstrip(".") if n != int(n) else f"{int(n):,}"
    return f"{n:,}"


def make(topic, level, stem, answer, distractors, explanation):
    """Shuffle the correct answer in among 3 distinct distractors."""
    seen, opts = {str(answer)}, []
    for d in distractors:
        if str(d) not in seen:
            seen.add(str(d))
            opts.append(d)
        if len(opts) == 3:
            break
    if len(opts) < 3:
        return None
    choices = opts + [answer]
    random.shuffle(choices)
    return {
        "topic": topic, "level": level, "stem": stem,
        "choices": [c if isinstance(c, str) else fmt(c) for c in choices],
        "answer": choices.index(answer), "explanation": explanation,
        "law_ref": None, "status": "approved",
    }


def near(x, step):
    return [x + step, x - step, x + 2 * step, x - 2 * step, x + 1, x - 1]


# ---------- อนุกรม ----------

def series():
    kind = random.choice(["arith", "geo", "second", "interleave", "mul_add"])
    if kind == "arith":
        a, d = random.randint(1, 60), random.choice([2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 15])
        t = [a + k * d for k in range(6)]
        ans = t[5]
        exp = f"เพิ่มขึ้นทีละ {d} เท่ากันทุกพจน์ จึงได้ {t[4]} + {d} = {ans}"
        dis = near(ans, d) + [ans + d - 1]
    elif kind == "geo":
        a, r = random.randint(1, 6), random.choice([2, 3])
        t = [a * r ** k for k in range(6)]
        ans = t[5]
        exp = f"คูณด้วย {r} ทุกพจน์ จึงได้ {fmt(t[4])} × {r} = {fmt(ans)}"
        dis = [t[4] * (r + 1), t[4] + t[3], ans - a, ans + r, t[4] * r * r // r + t[4]]
    elif kind == "second":
        a, d, c = random.randint(1, 30), random.randint(1, 6), random.randint(1, 4)
        t = [a]
        for k in range(5):
            t.append(t[-1] + d + k * c)
        ans = t[5]
        diffs = [t[k + 1] - t[k] for k in range(4)]
        exp = (f"ผลต่างระหว่างพจน์คือ {', '.join(map(str, diffs))} ซึ่งเพิ่มขึ้นทีละ {c} "
               f"ผลต่างถัดไปจึงเป็น {diffs[-1] + c} ได้ {t[4]} + {diffs[-1] + c} = {ans}")
        dis = [ans + c, ans - c, t[4] + diffs[-1], ans + 1, ans + 2 * c]
    elif kind == "interleave":
        a, d1 = random.randint(1, 20), random.randint(2, 6)
        b, d2 = random.randint(30, 60), -random.randint(2, 5)
        t = []
        for k in range(3):
            t += [a + k * d1, b + k * d2]
        t = t[:5]
        ans = b + 2 * d2  # the 6th term belongs to the even-position series
        exp = (f"เป็นอนุกรมซ้อนกัน 2 ชุด: ตำแหน่งคี่ {a}, {a + d1}, {a + 2 * d1} (เพิ่มทีละ {d1}) "
               f"ตำแหน่งคู่ {b}, {b + d2}, ... (ลดทีละ {-d2}) พจน์ถัดไปอยู่ชุดตำแหน่งคู่ = {ans}")
        dis = [a + 3 * d1, ans - d2, ans + d2 * 2, ans + 1, ans - 1]
    else:
        a, m, k = random.randint(1, 5), random.choice([2, 3]), random.choice([1, 2, -1])
        t = [a]
        for _ in range(5):
            t.append(t[-1] * m + k)
        ans = t[5]
        sign = f"+ {k}" if k > 0 else f"- {-k}"
        exp = f"แต่ละพจน์ = พจน์ก่อนหน้า × {m} {sign} จึงได้ {fmt(t[4])} × {m} {sign} = {fmt(ans)}"
        dis = [t[4] * m, t[4] * m + 2 * k, ans + m, ans - m, t[4] * (m + 1)]
    shown = t[:5]
    stem = f"จำนวนถัดไปของอนุกรม {', '.join(fmt(x) for x in shown)}, ... คือข้อใด"
    return make("A1-QUANT-SERIES", "apply", stem, ans, [x for x in dis if x > 0], exp)


# ---------- ร้อยละ ----------

def percent():
    kind = random.choice(["discount", "cost", "pct_of", "double_discount", "increase"])
    if kind == "discount":
        p, x = random.choice(range(200, 5001, 100)), random.choice([5, 10, 15, 20, 25, 30, 40])
        ans = p * (100 - x) // 100
        stem = f"สินค้าราคา {fmt(p)} บาท ลดราคา {x}% ผู้ซื้อต้องจ่ายเงินกี่บาท"
        exp = f"ลด {x}% ของ {fmt(p)} = {fmt(p * x // 100)} บาท จึงจ่าย {fmt(p)} − {fmt(p * x // 100)} = {fmt(ans)} บาท"
        dis = [p * x // 100, p - x, ans - p * x // 200, ans + p * 5 // 100, p * (100 + x) // 100]
    elif kind == "cost":
        c, x = random.choice(range(200, 4001, 100)), random.choice([10, 20, 25, 30, 40, 50])
        s = c * (100 + x) // 100
        ans = c
        stem = f"ขายสินค้าได้ {fmt(s)} บาท ได้กำไร {x}% ของทุน ทุนของสินค้าคือกี่บาท"
        exp = f"ราคาขาย = ทุน × {100 + x}/100 ดังนั้นทุน = {fmt(s)} × 100/{100 + x} = {fmt(c)} บาท"
        dis = [s * (100 - x) // 100, s - x, s * 100 // (100 + x + 10), c + s * x // 100 // 2, s - c // 2]
    elif kind == "pct_of":
        b = random.choice([40, 50, 80, 120, 150, 200, 250, 400, 500, 800])
        x = random.choice([5, 10, 12.5, 15, 20, 25, 30, 35, 40, 60, 75])
        a = Fraction(b) * Fraction(str(x)) / 100
        if a.denominator != 1:
            return None
        a = int(a)
        ans = f"{fmt(x)}%"
        stem = f"{fmt(a)} เป็นกี่เปอร์เซ็นต์ของ {fmt(b)}"
        exp = f"{fmt(a)} ÷ {fmt(b)} × 100 = {fmt(x)}%"
        dis = [f"{fmt(v)}%" for v in [x * 2, x + 5, x / 2, 100 - x, x + 10] if v > 0]
    elif kind == "double_discount":
        x, y = random.choice([10, 20, 25, 30]), random.choice([10, 20, 25, 50])
        total = Fraction(100) - Fraction(100 - x) * (100 - y) / 100
        ans = f"{fmt(total)}%"
        stem = f"ร้านค้าลดราคาสินค้า {x}% แล้วลดซ้ำอีก {y}% จากราคาที่ลดแล้ว รวมแล้วเท่ากับลดราคาจากราคาเดิมกี่เปอร์เซ็นต์"
        exp = (f"ราคาเหลือ {100 - x}% × {100 - y}% = {fmt(Fraction(100 - x) * (100 - y) / 100)}% ของราคาเดิม "
               f"จึงลดไป 100 − {fmt(Fraction(100 - x) * (100 - y) / 100)} = {fmt(total)}%")
        dis = [f"{x + y}%", f"{fmt(total + 5)}%", f"{fmt(total - 5)}%", f"{abs(x - y) + 10}%"]
    else:
        old, x = random.choice(range(1000, 20001, 500)), random.choice([4, 5, 8, 10, 12, 15, 20])
        new = old * (100 + x) // 100
        if old * (100 + x) % 100:
            return None
        ans = new
        stem = f"เงินเดือน {fmt(old)} บาท ได้ขึ้นเงินเดือน {x}% เงินเดือนใหม่คือกี่บาท"
        exp = f"เพิ่มขึ้น {x}% ของ {fmt(old)} = {fmt(old * x // 100)} บาท รวมเป็น {fmt(new)} บาท"
        dis = [old + x * 100, old * x // 100, new + old * 5 // 100, new - old * 2 // 100]
    return make("A1-QUANT-PERCENT", "apply", stem, ans, dis, exp)


# ---------- อัตราส่วน ----------

def ratio():
    kind = random.choice(["split", "chain", "scale"])
    if kind == "split":
        m, n = random.sample(range(1, 8), 2)
        unit = random.choice(range(50, 1001, 50))
        total = unit * (m + n)
        ans = unit * m
        stem = f"แบ่งเงิน {fmt(total)} บาท ให้ ก และ ข ในอัตราส่วน {m} : {n} ก จะได้เงินกี่บาท"
        exp = f"รวม {m + n} ส่วน ส่วนละ {fmt(total)} ÷ {m + n} = {fmt(unit)} บาท ก ได้ {m} ส่วน = {fmt(ans)} บาท"
        dis = [unit * n, total // m, unit * (m + 1), total - unit, unit * m + unit // 2]
    elif kind == "chain":
        a, b = random.randint(1, 6), random.randint(1, 6)
        c, d = random.randint(1, 6), random.randint(1, 6)
        A, C = Fraction(a, 1) * c, Fraction(b, 1) * d  # A:B = a:b, B:C = c:d -> A:C = a*c : b*d
        g = Fraction(A / C)
        ans = f"{g.numerator} : {g.denominator}"
        stem = f"ถ้า A : B = {a} : {b} และ B : C = {c} : {d} แล้ว A : C เท่ากับข้อใด"
        exp = (f"ทำ B ให้เท่ากัน: A : B : C = {a * c} : {b * c} : {b * d} "
               f"จึงได้ A : C = {a * c} : {b * d} = {ans}")
        alt = [Fraction(a * d, b * c), Fraction(a, d), Fraction(c, b), Fraction(a + c, b + d), Fraction(b * d, a * c)]
        dis = [f"{x.numerator} : {x.denominator}" for x in alt]
    else:
        k = random.choice([2, 3, 4, 5])
        w, h = random.randint(2, 9), random.randint(2, 9)
        ans = h * k
        stem = f"รูปภาพขนาดกว้าง {w} ซม. ยาว {h} ซม. ถ้าขยายให้กว้าง {w * k} ซม. โดยรักษาอัตราส่วนเดิม จะยาวกี่ซม."
        exp = f"ขยาย {w * k} ÷ {w} = {k} เท่า ความยาวจึงเป็น {h} × {k} = {ans} ซม."
        dis = [h + w * k - w, h * (k + 1), w * k, ans + k, ans - k]
    return make("A1-QUANT-RATIO", "apply", stem, ans, dis, exp)


# ---------- โจทย์ปัญหา ----------

WORK_PAIRS = [(3, 6, 2), (4, 12, 3), (6, 12, 4), (10, 15, 6), (12, 24, 8), (20, 30, 12), (6, 30, 5), (12, 36, 9), (5, 20, 4), (15, 30, 10)]


def word():
    kind = random.choice(["speed", "work", "age", "avg"])
    if kind == "speed":
        v, t = random.choice([40, 45, 50, 60, 72, 80, 90]), random.choice([1.5, 2, 2.5, 3, 4])
        dist = int(v * t)
        ans = f"{fmt(t)} ชั่วโมง"
        stem = f"รถยนต์วิ่งด้วยอัตราเร็วเฉลี่ย {v} กม./ชม. ระยะทาง {dist} กม. ใช้เวลากี่ชั่วโมง"
        exp = f"เวลา = ระยะทาง ÷ อัตราเร็ว = {dist} ÷ {v} = {fmt(t)} ชั่วโมง"
        dis = [f"{fmt(x)} ชั่วโมง" for x in [t + 0.5, t - 0.5, t + 1, t * 2, t + 1.5] if x > 0]
    elif kind == "work":
        a, b, ans_d = random.choice(WORK_PAIRS)
        ans = f"{ans_d} วัน"
        stem = f"ช่าง ก ทำงานชิ้นหนึ่งเสร็จใน {a} วัน ช่าง ข ทำเสร็จใน {b} วัน ถ้าช่วยกันทำจะเสร็จในกี่วัน"
        exp = f"ต่อวันทำได้ 1/{a} + 1/{b} = 1/{ans_d} ของงาน จึงเสร็จใน {ans_d} วัน"
        dis = [f"{x} วัน" for x in [(a + b) // 2, a + b, ans_d + 1, ans_d + 2, abs(b - a)] if x > 0]
    elif kind == "age":
        son, k, n = random.randint(4, 15), random.choice([3, 4, 5]), random.randint(2, 10)
        father = son * k
        ans = f"{father + n} ปี"
        stem = f"ปัจจุบันพ่ออายุเป็น {k} เท่าของลูก ซึ่งลูกอายุ {son} ปี อีก {n} ปีพ่อจะอายุเท่าไร"
        exp = f"พ่ออายุ {son} × {k} = {father} ปี อีก {n} ปีจึงอายุ {father} + {n} = {father + n} ปี"
        dis = [f"{x} ปี" for x in [father, (son + n) * k, father + 2 * n, father + n + 1, father - n]]
    else:
        n = random.choice([4, 5])
        vals = [random.randint(10, 30) * 2 for _ in range(n - 1)]
        target = random.randint(15, 25) * 2
        last = target * n - sum(vals)
        if last <= 0 or last > 100:
            return None
        ans = last
        stem = (f"นักเรียน {n} คนมีคะแนนเฉลี่ย {target} คะแนน ถ้าคะแนนของ {n - 1} คนแรกคือ "
                f"{', '.join(map(str, vals))} คะแนนของคนสุดท้ายคือเท่าไร")
        exp = f"ผลรวมทั้งหมด = {target} × {n} = {target * n} ลบผลรวม {n - 1} คนแรก {sum(vals)} ได้ {ans}"
        dis = [target, ans + 2, ans - 2, ans + n, ans + 10]
    return make("A1-QUANT-WORD", "apply", stem, ans, dis, exp)


# ---------- เงื่อนไขสัญลักษณ์ ----------

OPS = [">", "≥", "="]
LETTERS = "ABCDEFGHKLMPQRSTUVWXYZ"


def relation(path_ops):
    """Combine a chain of >, ≥, = (all in one direction). Returns '>', '≥' or '='."""
    if all(o == "=" for o in path_ops):
        return "="
    if any(o == ">" for o in path_ops):
        return ">"
    return "≥"


def implied(chain, ops, x, y, claim):
    """Is 'x claim y' certainly true given chain[0] op0 chain[1] op1 ... (decreasing order)?"""
    i, j = chain.index(x), chain.index(y)
    if i == j:
        return False
    lo, hi = min(i, j), max(i, j)
    rel = relation(ops[lo:hi])  # chain[lo] rel chain[hi]
    left_is_bigger = i < j
    if claim == "=":
        return rel == "="
    if claim in (">", "≥"):
        want_bigger = True
    else:  # < or ≤
        want_bigger = False
    if rel == "=":
        return claim in ("≥", "≤")
    if left_is_bigger != want_bigger:
        return False
    if claim in (">", "<"):
        return rel == ">"
    return True  # ≥ / ≤ with rel > or ≥


def logic_cond():
    k = random.choice([4, 5])
    chain = random.sample(LETTERS, k)
    ops = [random.choice(OPS) for _ in range(k - 1)]
    # Show the chain, sometimes written in reverse with < / ≤
    if random.random() < 0.4:
        rev = {">": "<", "≥": "≤", "=": "="}
        text = " ".join(x for pair in zip(chain[::-1], [rev[o] for o in ops[::-1]] + [""]) for x in pair).strip()
    else:
        text = " ".join(x for pair in zip(chain, ops + [""]) for x in pair).strip()

    def conclusion():
        x, y = random.sample(chain, 2)
        claim = random.choice([">", "≥", "<", "≤", "="])
        return f"{x} {claim} {y}", implied(chain, ops, x, y, claim)

    c1, t1 = conclusion()
    c2, t2 = conclusion()
    if c1 == c2:
        return None
    if not (t1 or t2) and random.random() < 0.6:
        return None  # keep "neither" from dominating
    labels = {
        (True, False): "ข้อสรุปที่ 1 ถูกเท่านั้น",
        (False, True): "ข้อสรุปที่ 2 ถูกเท่านั้น",
        (True, True): "ถูกทั้งสองข้อ",
        (False, False): "ไม่ถูกทั้งสองข้อ",
    }
    ans = labels[(t1, t2)]
    stem = (f"กำหนดให้ {text}\nข้อสรุปที่ 1: {c1}\nข้อสรุปที่ 2: {c2}\n"
            f"ข้อใดถูกต้อง")
    def why(c, t):
        if t:
            return f"{c} ถูก"
        x, claim, y = c.split()
        neg = {">": "≤", "≥": "<", "<": "≥", "≤": ">", "=": None}[claim]
        if neg and implied(chain, ops, x, y, neg):
            return f"{c} ไม่ถูก เพราะขัดกับเงื่อนไข ({x} {neg} {y})"
        return f"{c} ไม่ถูก เพราะสรุปแน่นอนไม่ได้"

    exp = (f"เรียงลำดับเงื่อนไข: {' '.join(x for pair in zip(chain, ops + ['']) for x in pair).strip()} "
           f"— {why(c1, t1)} และ {why(c2, t2)}")
    dis = [v for v in labels.values() if v != ans]
    return make("A1-LOGIC-COND", "analyze", stem, ans, dis, exp)


# ---------- ตาราง / ข้อมูล ----------

TABLES = [
    ("จำนวนนักเรียนที่เข้าร่วมกิจกรรม", "ห้อง", ["ม.1/1", "ม.1/2", "ม.1/3", "ม.1/4"], ["ชาย", "หญิง"], (8, 25)),
    ("ยอดขายสินค้าสหกรณ์โรงเรียน (บาท)", "เดือน", ["มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย."], ["เครื่องเขียน", "อาหาร"], (1200, 9000)),
    ("จำนวนหนังสือที่ห้องสมุดให้ยืม (เล่ม)", "ภาคเรียน", ["1/2566", "2/2566", "1/2567", "2/2567"], ["ประถม", "มัธยม"], (150, 900)),
    ("คะแนนสอบเฉลี่ย", "วิชา", ["ไทย", "คณิต", "วิทย์", "อังกฤษ"], ["ห้อง A", "ห้อง B"], (40, 95)),
]


def data_table():
    title, rowname, rows, cols, (lo, hi) = random.choice(TABLES)
    step = 5 if hi >= 1000 else 1
    vals = [[random.randrange(lo, hi + 1, step) if step > 1 else random.randint(lo, hi) for _ in cols] for _ in rows]
    table = f"{title}\n{rowname} | " + " | ".join(cols) + "\n" + "\n".join(
        f"{r} | " + " | ".join(fmt(v) for v in vs) for r, vs in zip(rows, vals))
    kind = random.choice(["total", "col_total", "diff", "avg", "max", "pct"])
    c = random.randrange(len(cols))
    if kind == "total":
        i = random.randrange(len(rows))
        ans = sum(vals[i])
        stem = f"{table}\n\nจากตาราง {rowname} {rows[i]} มีทั้งหมดเท่าใด"
        exp = f"{' + '.join(fmt(v) for v in vals[i])} = {fmt(ans)}"
        dis = [ans + d for d in (step * 10, -step * 10, step * 5, -step * 5, vals[i][0], -vals[i][-1]) if ans + d > 0]
    elif kind == "col_total":
        ans = sum(v[c] for v in vals)
        stem = f"{table}\n\nจากตาราง ผลรวมของ{cols[c]}ทุก{rowname}เท่ากับเท่าใด"
        exp = f"{' + '.join(fmt(v[c]) for v in vals)} = {fmt(ans)}"
        dis = [ans + d for d in (step * 10, -step * 10, step * 20, -step * 20, step) if ans + d > 0]
    elif kind == "diff":
        i, j = random.sample(range(len(rows)), 2)
        ans = abs(vals[i][c] - vals[j][c])
        if ans == 0:
            return None
        stem = f"{table}\n\nจากตาราง {cols[c]}ของ{rowname} {rows[i]} กับ {rows[j]} ต่างกันเท่าใด"
        exp = f"|{fmt(vals[i][c])} − {fmt(vals[j][c])}| = {fmt(ans)}"
        dis = [ans + step * k for k in (1, -1, 2, 10, -10) if ans + step * k > 0] + [vals[i][c] + vals[j][c]]
    elif kind == "avg":
        total = sum(v[c] for v in vals)
        if total % len(rows):
            return None
        ans = total // len(rows)
        stem = f"{table}\n\nจากตาราง ค่าเฉลี่ยของ{cols[c]}ต่อ{rowname}เท่ากับเท่าใด"
        exp = f"ผลรวม {fmt(total)} ÷ {len(rows)} = {fmt(ans)}"
        dis = [ans + step * k for k in (1, -1, 2, -2, 5) if ans + step * k > 0] + [total]
    elif kind == "max":
        tot = [sum(v) for v in vals]
        if tot.count(max(tot)) > 1:
            return None
        ans = rows[tot.index(max(tot))]
        stem = f"{table}\n\nจากตาราง {rowname}ใดมีผลรวมของ{' และ '.join(cols)}มากที่สุด"
        exp = "ผลรวมแต่ละ" + rowname + ": " + ", ".join(f"{r} = {fmt(t)}" for r, t in zip(rows, tot))
        dis = [r for r in rows if r != ans]
    else:
        i = random.randrange(len(rows))
        part, whole = vals[i][c], sum(vals[i])
        if (part * 100) % whole:
            return None
        ans = f"{part * 100 // whole}%"
        stem = f"{table}\n\nจากตาราง {cols[c]}ของ{rowname} {rows[i]} คิดเป็นร้อยละเท่าใดของทั้ง{rowname}"
        exp = f"{fmt(part)} ÷ {fmt(whole)} × 100 = {ans}"
        p = part * 100 // whole
        dis = [f"{x}%" for x in (p + 5, p - 5, p + 10, 100 - p) if 0 < x < 100 and x != p]
    return make("A1-QUANT-DATA", "apply", stem, ans, dis, exp)


# ---------- การสรุปความเชิงตรรกะ (เฉพาะรูปแบบที่สรุปได้แน่นอน) ----------

TERMS = ["ครู", "ข้าราชการ", "นักกีฬา", "นักดนตรี", "คนขยัน", "คนใจดี", "นักวิจัย", "นักเขียน", "ศิลปิน",
         "นักเรียน", "คนตรงต่อเวลา", "ผู้นำ", "นักอ่าน", "คนซื่อสัตย์", "อาสาสมัคร", "นักวิทยาศาสตร์"]


def syllogism():
    a, b, c = random.sample(TERMS, 3)
    all_ = lambda x, y: f"{x}ทุกคนเป็น{y}"
    some = lambda x, y: f"{x}บางคนเป็น{y}"
    none = lambda x, y: f"ไม่มี{x}คนใดเป็น{y}"
    some_not = lambda x, y: f"{x}บางคนไม่เป็น{y}"
    form = random.randrange(5)
    if form == 0:   # All A are B, All B are C => All A are C
        prem, ans = [all_(a, b), all_(b, c)], all_(a, c)
        dis = [all_(c, a), none(a, c), some_not(a, c)]
        why = f"{a}อยู่ในกลุ่ม{b} และ{b}ทั้งหมดอยู่ในกลุ่ม{c} {a}ทุกคนจึงเป็น{c}"
    elif form == 1:  # All A are B, No B is C => No A is C
        prem, ans = [all_(a, b), none(b, c)], none(a, c)
        dis = [some(a, c), all_(c, a), some(c, b)]
        why = f"{a}ทุกคนอยู่ในกลุ่ม{b} ซึ่งไม่มีใครเป็น{c} จึงไม่มี{a}คนใดเป็น{c}"
    elif form == 2:  # Some A are B, All B are C => Some A are C
        prem, ans = [some(a, b), all_(b, c)], some(a, c)
        dis = [all_(a, c), none(a, c), all_(c, a)]
        why = f"{a}ที่เป็น{b}ย่อมเป็น{c}ด้วย จึงมี{a}อย่างน้อยบางคนเป็น{c} แต่สรุปว่าทุกคนไม่ได้"
    elif form == 3:  # No A is B, Some C are B => Some C are not A
        prem, ans = [none(a, b), some(c, b)], some_not(c, a)
        dis = [none(c, a), all_(c, a), some(a, c)]
        why = f"{c}ที่เป็น{b}ไม่อาจเป็น{a}ได้ จึงมี{c}บางคนไม่เป็น{a}"
    else:            # All A are B, Some C are not B => Some C are not A
        prem, ans = [all_(a, b), some_not(c, b)], some_not(c, a)
        dis = [none(c, a), some_not(a, b), all_(c, b)]
        why = f"ถ้า{c}คนใดไม่เป็น{b} ก็ไม่อาจเป็น{a}ได้ (เพราะ{a}ทุกคนเป็น{b}) จึงมี{c}บางคนไม่เป็น{a}"
    stem = "กำหนดให้\n" + "\n".join(f"{i + 1}) {p}" for i, p in enumerate(prem)) + "\nข้อใดสรุปได้ถูกต้องแน่นอน"
    return make("A1-LOGIC-SYLLOGISM", "analyze", stem, ans, dis, why)


GENERATORS = [(series, 90), (percent, 70), (ratio, 50), (word, 60), (logic_cond, 90), (data_table, 100), (syllogism, 100)]


def main():
    out = sys.argv[1]
    seed = int(sys.argv[sys.argv.index("--seed") + 1]) if "--seed" in sys.argv else 1
    scale = float(sys.argv[sys.argv.index("--scale") + 1]) if "--scale" in sys.argv else 1
    random.seed(seed)
    items, stems = [], set()
    for gen, n in GENERATORS:
        target, tries = int(n * scale), 0
        got = 0
        while got < target and tries < target * 50:
            tries += 1
            q = gen()
            if q and q["stem"] not in stems:
                stems.add(q["stem"])
                items.append(q)
                got += 1
    with open(out, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=1)
    print(f"{len(items)} questions -> {out}")


if __name__ == "__main__":
    main()
