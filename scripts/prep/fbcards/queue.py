"""สร้าง SQL ใส่โพสต์เพจ 7–15 พ.ย. ลงคิว prep.fb_posts (ให้ prep-fb-agent โพสต์เองทุก 10 นาที)

python3 scripts/prep/fbcards/queue.py [draft|scheduled] > out.sql
รูปต้องอัปโหลดไว้ที่ bucket fb-media/campaign/exam11/<ชื่อไฟล์จาก render.cjs> ก่อน
ข้ามโพสต์ที่มี title ซ้ำอยู่แล้ว จึงรันซ้ำได้
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(HERE, "cards.json"), encoding="utf-8"))
STATUS = sys.argv[1] if len(sys.argv) > 1 else "draft"
assert STATUS in ("draft", "scheduled")
L = "กขคง"
IMG = "campaign/exam11/"
URL = "https://sobprep.com/prep?src="

def pct(c, i): return round(100 * c[i] / sum(c))

def pinned(tag):
    return f"""📌 SOBPREP ซ้อมข้อสอบครูผู้ช่วย สพฐ. และ สอศ.
ลองฟรี 3 ชุด 👉 {URL}{tag}
🗓️ ภาค ก เสาร์ 14 พ.ย. · ภาค ข อาทิตย์ 15 พ.ย.

📝 แนวข้อสอบ 12,044 ข้อ (ภาค ก 3,027 · ภาค ข+วิชาเอก 9,017) เฉลยละเอียดทุกข้อ
🔥 โหมดท้าทาย: โจทย์สถานการณ์ / PISA / ข่าวในกระแส ทุกหมวดมีข้อยาก 30 ข้อขึ้นไป
⏱️ สอบจำลองจับเวลา + quiz รายวัน
📚 สรุปเนื้อหา 71 ผัง (ฟรีวิชาละ 1 ผัง)
📊 วิเคราะห์จุดอ่อน-จุดแข็ง แนะนำว่าควรอ่านอะไรต่อ

💰 ครบทุกภาค 99 บาท (3 เดือน) / 179 บาท (ตลอดชีพ) · แยกภาค ก 49 · ภาค ข+เอก 69
❓ สงสัยอะไรทัก LINE @701pvghq ครับ"""

PM_CAPTION = {
    "2026-11-07": "เหลือ 7 วันสอบครูผู้ช่วย ใครอ่านไม่ทัน ผมทำเว็บซ้อมข้อสอบ ภาค ก+ข 12,000 ข้อ+ เฉลยละเอียดทุกข้อ ทำวันละชุดยังทัน ลองฟรีในคอมเมนต์ครับ 👇",
    "2026-11-08": "ข้อสอบยาก ๆ แนว PISA / โจทย์สถานการณ์ ผมรวมไว้ทุกหมวด ภาค ก+ข หมวดละ 30 ข้อขึ้นไป ใครอยากลองว่าพร้อมแค่ไหน ลองฟรีในคอมเมนต์ครับ 👇",
    "2026-11-09": "ใครไม่มีเวลาอ่านหนังสือเล่มหนา ผมทำสรุปเป็นผังภาพ 71 ผัง ภาค ก+ข+วิชาเอก อ่านผังละไม่กี่นาที ดูฟรีวิชาละ 1 ผังในคอมเมนต์ครับ 👇",
    "2026-11-10": "ทำข้อสอบแล้วไม่รู้ว่าอ่อนตรงไหน? เว็บผมวิเคราะห์ให้ว่าหมวดไหนยังอ่อน และควรอ่านอะไรต่อ ก่อนสอบ 4 วัน ลองฟรีในคอมเมนต์ครับ 👇",
    "2026-11-11": "ภาค ก ปีนี้อาจมีข่าว/เหตุการณ์ปัจจุบัน ผมรวมแนวข้อสอบข่าวในกระแสไว้ 31 ข้อ พร้อมแหล่งข่าวทุกข้อ ลองฟรีในคอมเมนต์ครับ 👇",
    "2026-11-12": "โค้งสุดท้าย 2 วันก่อนสอบ ทำข้อสอบจำลองจับเวลาสัก 1 ชุด จะได้รู้จังหวะเวลาจริง ผมทำไว้ให้ ภาค ก+ข ลองฟรีในคอมเมนต์ครับ 👇",
    "2026-11-13": "พรุ่งนี้สอบภาค ก แล้ว เช็กของให้ครบก่อนนอนนะครับ บัตรประชาชน บัตรเข้าสอบ ดินสอ 2B เช็กห้องสอบ แล้วนอนเร็ว ๆ ขอให้ทุกคนทำได้เต็มที่ครับ 💪",
    "2026-11-14": "ภาค ก ผ่านไปแล้ว เก่งมากครับ 👏 พรุ่งนี้ภาค ข ใครอยากทวนคืนนี้ ผังสรุปภาค ข + วิชาเอก กับข้อที่เคยทำผิด ดูได้ในคอมเมนต์ครับ 👇",
}
CHEER_CAPTION = {
    ("2026-11-14", "06:30"): "วันนี้สอบภาค ก แล้ว สู้ ๆ นะครับทุกคน 💪 อ่านโจทย์ให้จบก่อนเลือก ข้อไหนติดข้ามไปก่อน แล้วค่อยกลับมา ขอให้ได้เต็มที่ครับ",
    ("2026-11-15", "06:30"): "วันนี้ภาค ข อีกวันเดียว สู้ต่ออีกนิดครับ 💪 เมื่อวานเป็นยังไงก็ช่างมัน วันนี้เริ่มใหม่ ใจเย็น ๆ อ่านโจทย์ให้ครบ",
    ("2026-11-15", "20:00"): "สอบเสร็จครบทั้งสองวันแล้ว เก่งมากครับทุกคน 🎉 ขอบคุณที่ซ้อมมาด้วยกันกับ SOBPREP สอบเป็นยังไงบ้าง เล่าให้ฟังในคอมเมนต์ได้นะครับ",
}

def sq(s): return "null" if s is None else "'" + s.replace("'", "''") + "'"

rows = []
for q in D["quiz"]:
    d, tag = q["day"], "fb-" + q["day"][5:7] + q["day"][8:10] + "-am"
    p, k = pct(q["counts"], q["answer"]), q["answer"]
    rows.append(dict(
        title=f"{d[8:]} พ.ย. เช้า · ควิซ #{q['qid']} ถูก {p}%",
        caption=f"ข้อนี้คนตอบถูกแค่ {p}% 😱 ({q['topic']})\n\n{q['stem']}\n\n" +
                "\n".join(f"{L[i]}. {c}" for i, c in enumerate(q["choices"])) +
                "\n\nคิดว่าข้อไหน คอมเมนต์มาเลยครับ เที่ยงนี้เฉลยในคอมเมนต์ 👇",
        image=IMG + f"{d}-am-quiz.png",
        comment=f"✅ เฉลย {L[k]}. {q['choices'][k]}\nเพราะ {q['why']}\n\nข้อแบบนี้มีอีก 12,000+ ข้อ เฉลยละเอียดทุกข้อ ลองฟรี 3 ชุด 👉 {URL}{tag}",
        cimage=IMG + f"{d}-am-answer.png", delay=180, at=f"{d} 09:00+07"))
for f in D["feature"]:
    d = f["day"]
    rows.append(dict(
        title=f"{d[8:]} พ.ย. ค่ำ · {f['kicker']}",
        caption=PM_CAPTION[d],
        image=IMG + f"{d}-pm-{'checklist' if f.get('nosale') else 'feature'}.png",
        comment=None if f.get("nosale") else pinned(f["tag"]),
        cimage=None, delay=5, at=f"{d} 20:00+07"))
for c in D["cheer"]:
    d, t = c["day"], c["time"]
    rows.append(dict(
        title=f"{d[8:]} พ.ย. {t} · {c['kicker']}", caption=CHEER_CAPTION[(d, t)],
        image=IMG + f"{d}-{t.replace(':', '')}-cheer.png", comment=None, cimage=None, delay=0, at=f"{d} {t}+07"))

print("begin;")
for r in sorted(rows, key=lambda r: r["at"]):
    cstat = "'pending'" if (STATUS == "scheduled" and r["comment"]) else "'none'"
    print(f"""insert into prep.fb_posts (title, caption, image_path, comment_text, comment_image_path, comment_delay_min, scheduled_at, status, comment_status)
select {sq(r['title'])}, {sq(r['caption'])}, {sq(r['image'])}, {sq(r['comment'])}, {sq(r['cimage'])}, {r['delay']}, '{r['at']}'::timestamptz, '{STATUS}', {cstat}
where not exists (select 1 from prep.fb_posts where title = {sq(r['title'])});""")
print("commit;")
print(f"-- {len(rows)} posts", file=sys.stderr)
