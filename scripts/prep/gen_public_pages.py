#!/usr/bin/env python3
"""Generate the public, crawlable sample-question pages under public/prep/sample/.

Usage: python3 scripts/prep/gen_public_pages.py samples.json
samples.json maps a group key (A2, ANALOGY, B1, ENG, CHEM, MATH, PRIMARY, DANCE) to rows
{id, topic, level, stem, choices[], answer, explanation} read from prep.questions. Only questions whose
rights we hold (source 'authored-*') belong in here; never feed it questions imported from third-party files.
Also writes public/sitemap.xml.
"""
import html
import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "prep" / "sample"
BASE = "https://sobprep.com"
LABELS = ["ก", "ข", "ค", "ง"]

PAGES = [
    ("part-a-english", "A2", "ภาค ก ภาษาอังกฤษ", "ข้อสอบครูผู้ช่วย ภาค ก ภาษาอังกฤษ",
     "Grammar, Vocabulary, Conversation และ Reading ในแนวข้อสอบ ภาค ก (ความรู้ความสามารถทั่วไป) พร้อมเฉลยและคำอธิบาย"),
    ("part-a-analogy", "ANALOGY", "ภาค ก คิดวิเคราะห์: อุปมาอุปไมย", "ข้อสอบครูผู้ช่วย ภาค ก คิดวิเคราะห์ อุปมาอุปไมย",
     "โจทย์อุปมาอุปไมย (วิชาคิดวิเคราะห์ ภาค ก) พร้อมเฉลยและเหตุผลทุกข้อ"),
    ("part-b-teaching-profession", "B1", "ภาค ข วิชาชีพครู", "ข้อสอบครูผู้ช่วย ภาค ข วิชาชีพครู",
     "จิตวิทยา การจัดการชั้นเรียน การวัดและประเมินผล หลักสูตร นวัตกรรม และวิจัย พร้อมเฉลยและคำอธิบาย"),
    ("major-english", "ENG", "วิชาเอกภาษาอังกฤษ", "ข้อสอบครูผู้ช่วย วิชาเอกภาษาอังกฤษ",
     "แนวข้อสอบวิชาเอกภาษาอังกฤษ ไวยากรณ์ ศัพท์ การสอนภาษา พร้อมเฉลยและคำอธิบาย"),
    ("major-chemistry", "CHEM", "วิชาเอกเคมี", "ข้อสอบครูผู้ช่วย วิชาเอกเคมี",
     "แนวข้อสอบวิชาเอกเคมี สโตอิกิโอเมทรี สมดุล กรด-เบส เคมีอินทรีย์ พร้อมเฉลยและวิธีคิด"),
    ("major-mathematics", "MATH", "วิชาเอกคณิตศาสตร์", "ข้อสอบครูผู้ช่วย วิชาเอกคณิตศาสตร์",
     "แนวข้อสอบวิชาเอกคณิตศาสตร์ ลอการิทึม ตรีโกณมิติ แคลคูลัส การสอนคณิตศาสตร์ พร้อมเฉลยและวิธีคิด"),
    ("major-primary-education", "PRIMARY", "วิชาเอกประถมศึกษา", "ข้อสอบครูผู้ช่วย วิชาเอกประถมศึกษา",
     "แนวข้อสอบวิชาเอกประถมศึกษา เนื้อหา 8 กลุ่มสาระ จิตวิทยาเด็ก การสอนอ่านเขียน พร้อมเฉลย"),
    ("major-dance", "DANCE", "วิชาเอกนาฏศิลป์", "ข้อสอบครูผู้ช่วย วิชาเอกนาฏศิลป์",
     "แนวข้อสอบวิชาเอกนาฏศิลป์ นาฏศิลป์ไทย นาฏศิลป์สากล การละคร พร้อมเฉลยและคำอธิบาย"),
]

CSS = """
*{box-sizing:border-box}body{margin:0;font-family:Prompt,Sarabun,system-ui,sans-serif;background:#FBF7F1;color:#2A1418;line-height:1.65}
header{background:linear-gradient(135deg,#8E1B2E,#4A0B16);color:#fff;border-bottom:4px solid #D4AF37}
.w{max-width:760px;margin:0 auto;padding:0 18px}
header .w{padding:18px}header a{color:#F3D98A;text-decoration:none;font-weight:700}
h1{font-size:1.7rem;line-height:1.3;margin:22px 0 6px}h2{font-size:1.2rem;margin:0 0 8px}
.lead{color:#5b4247;margin:0 0 18px}
.q{background:#fff;border-radius:16px;padding:18px;margin:14px 0;box-shadow:0 6px 20px -14px rgba(74,11,22,.45)}
.q .n{color:#8E1B2E;font-weight:700}.q p{margin:4px 0 10px;white-space:pre-line}
ol{list-style:none;padding:0;margin:0 0 10px}ol li{padding:6px 10px;border-radius:10px;margin:4px 0;background:#F6EFE6}
details summary{cursor:pointer;color:#8E1B2E;font-weight:700}details div{margin-top:8px;padding:10px 12px;background:#FFF6DC;border-radius:10px}
.cta{display:block;background:linear-gradient(180deg,#F3D98A,#C9A227);color:#4A0B16;text-align:center;font-weight:800;border-radius:99px;padding:14px 20px;text-decoration:none;margin:22px 0}
.note{font-size:.85rem;color:#7A6468}nav.l a{display:inline-block;margin:4px 8px 4px 0;color:#8E1B2E}
footer{margin:30px 0;font-size:.85rem;color:#7A6468}
"""


def esc(s):
    return html.escape(str(s), quote=True)


def head(title, desc, path, extra=""):
    url = f"{BASE}{path}"
    return f"""<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{url}">
<link rel="icon" href="/prep-icons/favicon-32.png">
<meta property="og:type" content="website"><meta property="og:url" content="{url}">
<meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}">
<meta property="og:image" content="{BASE}/prep-og-v2.jpg"><meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:site_name" content="ซ้อมสอบ SOBPREP"><meta property="og:locale" content="th_TH">
<meta name="twitter:card" content="summary_large_image">
<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>{CSS}</style>{extra}</head><body>
<header><div class="w"><a href="/prep">ซ้อมสอบ SOBPREP</a> · <a href="/prep/sample/" style="font-weight:400">ตัวอย่างข้อสอบ</a></div></header>
<main class="w">"""


FOOT = """<a class="cta" href="/prep">ลองฟรี 3 ชุด ไม่ต้องสมัคร → sobprep.com/prep</a>
<footer>เป็นข้อสอบฝึกตามหัวข้อที่ออกสอบ ไม่ใช่ข้อสอบจริง และไม่รับประกันว่าจะออกสอบ ·
<a href="/prep/privacy">ความเป็นส่วนตัวและข้อกำหนด</a> · ติดต่อ LINE @701pvghq</footer></main></body></html>"""


def question_ld(r):
    ch = r["choices"]
    right = ch[r["answer"]]
    return {
        "@type": "Question", "eduQuestionType": "Multiple choice", "text": r["stem"],
        "acceptedAnswer": {"@type": "Answer", "text": right, "answerExplanation": {"@type": "Comment", "text": r["explanation"]}},
        "suggestedAnswer": [{"@type": "Answer", "text": c} for i, c in enumerate(ch) if i != r["answer"]],
    }


def build_page(slug, rows, label, h1, desc):
    path = f"/prep/sample/{slug}/"
    title = f"{h1} พร้อมเฉลย {len(rows)} ข้อ | ซ้อมสอบ SOBPREP"
    ld = {
        "@context": "https://schema.org", "@graph": [
            {"@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "ซ้อมสอบ SOBPREP", "item": f"{BASE}/prep"},
                {"@type": "ListItem", "position": 2, "name": "ตัวอย่างข้อสอบ", "item": f"{BASE}/prep/sample/"},
                {"@type": "ListItem", "position": 3, "name": label, "item": f"{BASE}{path}"}]},
            {"@type": "Quiz", "name": h1, "inLanguage": "th", "educationalLevel": "ครูผู้ช่วย",
             "about": label, "hasPart": [question_ld(r) for r in rows]},
        ]}
    extra = '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False).replace("</", "<\\/") + "</script>"
    parts = [head(title, desc, path, extra), f"<h1>{esc(h1)} พร้อมเฉลย</h1><p class=\"lead\">{esc(desc)} ลองตอบในใจก่อน แล้วกด \"ดูเฉลย\"</p>"]
    for i, r in enumerate(rows, 1):
        lis = "".join(f"<li>{LABELS[k]}. {esc(c)}</li>" for k, c in enumerate(r["choices"]))
        parts.append(
            f'<section class="q"><div class="n">ข้อ {i}</div><p>{esc(r["stem"])}</p><ol>{lis}</ol>'
            f'<details><summary>ดูเฉลย</summary><div><b>ตอบข้อ {LABELS[r["answer"]]}.</b> {esc(r["explanation"])}</div></details></section>')
    others = "".join(f'<a href="/prep/sample/{s}/">{esc(l)}</a>' for s, _, l, _, _ in PAGES if s != slug)
    parts.append(f'<p class="lead">ข้อสอบชุดอื่น</p><nav class="l">{others}</nav>')
    parts.append(FOOT)
    return path, "".join(parts)


def main(src):
    data = json.load(open(src, encoding="utf-8"))
    pages = []
    for slug, key, label, h1, desc in PAGES:
        rows = data[key]
        for r in rows:
            assert len(r["choices"]) == 4 and 0 <= r["answer"] < 4, r["id"]
        path, doc = build_page(slug, rows, label, h1, desc)
        d = OUT / slug
        d.mkdir(parents=True, exist_ok=True)
        (d / "index.html").write_text(doc, encoding="utf-8")
        pages.append(path)
    cards = "".join(
        f'<section class="q"><h2><a href="/prep/sample/{s}/" style="color:#8E1B2E;text-decoration:none">{esc(h)}</a></h2><p class="note">{esc(d)}</p></section>'
        for s, _, _, h, d in PAGES)
    idx_desc = "ตัวอย่างข้อสอบครูผู้ช่วย ภาค ก ภาค ข และวิชาเอก พร้อมเฉลยและคำอธิบาย ทำฟรี ไม่ต้องสมัคร"
    idx = (head("ตัวอย่างข้อสอบครูผู้ช่วย พร้อมเฉลย ภาค ก ภาค ข วิชาเอก | ซ้อมสอบ SOBPREP", idx_desc, "/prep/sample/")
           + f'<h1>ตัวอย่างข้อสอบครูผู้ช่วย พร้อมเฉลย</h1><p class="lead">{idx_desc} เลือกวิชาที่ต้องการ</p>{cards}{FOOT}')
    (OUT / "index.html").write_text(idx, encoding="utf-8")
    urls = [f"{BASE}/prep", f"{BASE}/prep/welcome/", f"{BASE}/prep/guide", f"{BASE}/prep/sample/"] + [BASE + p for p in pages]
    today = date.today().isoformat()
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(
        f"  <url><loc>{u}</loc><lastmod>{today}</lastmod></url>\n" for u in urls) + "</urlset>\n"
    (ROOT / "public" / "sitemap.xml").write_text(sm, encoding="utf-8")
    print("pages:", len(pages) + 1, "urls in sitemap:", len(urls))


if __name__ == "__main__":
    main(sys.argv[1])
