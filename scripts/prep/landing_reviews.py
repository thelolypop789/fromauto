#!/usr/bin/env python3
"""เติมส่วน "รีวิวจากผู้ใช้จริง" ในหน้า landing (public/prep/welcome/index.html) จาก prep.feedback

- แสดงทุกรีวิว (kind='review') ที่ผู้ใช้กด "ให้นำไปแสดงได้" (public_ok) — เจ้าของสั่ง 18 พ.ย. 69: แสดงทุกอัน แยกจำนวนตามดาว
  และ "ห้ามตัดถ้อยคำรีวิวของคุณครู" → ข้อความแสดงตามที่ผู้ใช้เขียนทุกตัวอักษร (escape HTML อย่างเดียว ไม่แก้คำผิด ไม่ย่อ)
- ไม่แสดงชื่อ อีเมล หรือข้อมูลบัญชี แสดงแค่ดาว ข้อความ และวันที่
- รีวิวที่ให้ดาวอย่างเดียว (ไม่มีข้อความ) แสดงเป็นป้ายเล็กแยกไว้ด้านล่าง
- เขียนทับเฉพาะช่วงระหว่าง <!-- reviews:start --> ถึง <!-- reviews:end --> (หน้า landing แก้ด้วยมือ ห้ามรัน gen_landing.py)
Run: python3 scripts/prep/landing_reviews.py   (ต้องใช้ ops.py ต่อ Supabase ได้) แล้ว commit + redeploy
"""
import html
import json
import re
import subprocess
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "public" / "prep" / "welcome" / "index.html"
START, END = "<!-- reviews:start", "<!-- reviews:end -->"
MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]

SQL = """
select f.rating, f.body, to_char(f.created_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD') as day
from prep.feedback f where f.kind = 'review' and f.public_ok order by f.created_at desc, f.id desc;
select count(*) as users from prep.profiles;
"""


def sql(q: str):
    out = subprocess.run(["python3", str(ROOT / "scripts/prep/ops/ops.py"), "sql", "-"], input=q, text=True,
                         capture_output=True, check=True).stdout
    return json.loads(out)


def thai_day(iso: str) -> str:
    d = date.fromisoformat(iso)
    return f"{d.day} {MONTHS[d.month - 1]} {(d.year + 543) % 100:02d}"


def stars(n) -> str:
    if not n:
        return '<span class="rv-st off">ไม่ได้ให้ดาว</span>'
    return f'<span class="rv-st" aria-label="{n} จาก 5 ดาว">{"★" * n}<i>{"★" * (5 - n)}</i></span>'


def build(rows, users: int) -> str:
    rated = [r["rating"] for r in rows if r["rating"]]
    avg = sum(rated) / len(rated) if rated else 0
    bars = []
    for s in (5, 4, 3, 2, 1):
        c = rated.count(s)
        pct = round(100 * c / len(rated)) if rated else 0
        bars.append(f'<div class="rv-bar"><span>{s} ดาว</span><b><i style="width:{pct}%"></i></b><span>{c} รีวิว</span></div>')
    texts = [r for r in rows if (r["body"] or "").strip()]
    plain = [r for r in rows if not (r["body"] or "").strip()]
    cards = "".join(f'<div class="card rv-card">{stars(r["rating"])}<p>{html.escape(r["body"].strip())}</p>'
                    f'<small>{thai_day(r["day"])}</small></div>' for r in texts)
    chips = "".join(f'<span>{stars(r["rating"])} {thai_day(r["day"])}</span>' for r in plain)
    users_txt = f"ผู้ใช้กว่า {users // 500 * 500:,} คน · " if users >= 500 else ""
    other = len(rated) - rated.count(5)
    parts = [
        f'{START} สร้างด้วย scripts/prep/landing_reviews.py ห้ามแก้มือ -->',
        '<section id="reviews"><div class="w"><small class="eyebrow">รีวิว</small><h2>รีวิวจากผู้ใช้</h2>',
        f'<p class="lead">{users_txt}แสดงทุกรีวิวที่ผู้ใช้อนุญาตให้นำมาแสดง ข้อความตามที่ผู้ใช้เขียนทุกตัวอักษร ไม่ตัดต่อ</p>',
        f'<div class="card rv-sum"><div class="rv-avg"><b>{avg:.1f}</b>{stars(round(avg))}'
        f'<small>จาก {len(rated)} รีวิว · 5 ดาว {rated.count(5)} รีวิว · ดาวอื่น ๆ {other} รีวิว</small></div>'
        f'<div class="rv-bars">{"".join(bars)}</div></div>',
    ]
    if cards:
        parts.append(f'<div class="grid rv-grid">{cards}</div>')
    if chips:
        parts.append(f'<p class="rv-h">ให้ดาวอย่างเดียว ไม่ได้เขียนข้อความ ({len(plain)} รีวิว)</p><div class="rv-chips">{chips}</div>')
    today = date.today().isoformat()
    parts.append(f'<p class="note">อัปเดต {thai_day(today)} · รีวิวใหม่จะทยอยเพิ่มในหน้านี้</p></div></section>')
    parts.append(END)
    return "\n".join(parts)


def main():
    res = sql(SQL.split(";")[0] + ";")
    users = sql(SQL.split(";")[1] + ";")[0]["users"]
    page = PAGE.read_text()
    i, j = page.find(START), page.find(END)
    assert i >= 0 and j > i, "ไม่พบ marker reviews:start / reviews:end ในหน้า landing"
    block = build(res, users)
    # กันหลุดอีเมล (รีวิวที่มีอีเมลในข้อความ ให้แอดมินตัดสินใจเองก่อน ไม่แก้ข้อความให้)
    assert not re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", block), "พบข้อความคล้ายอีเมลในรีวิว ตรวจก่อนเผยแพร่"
    PAGE.write_text(page[:i] + block + page[j + len(END):])
    rated = [r["rating"] for r in res if r["rating"]]
    print(f"reviews {len(res)} · rated {len(rated)} · with text {sum(1 for r in res if (r['body'] or '').strip())} · users {users}")


if __name__ == "__main__":
    main()
