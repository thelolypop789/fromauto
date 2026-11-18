#!/usr/bin/env python3
"""สร้างหน้าข่าวและบทความแบบ static ให้ Google เก็บได้ จากไฟล์ใน content/news/

Usage: python3 scripts/prep/gen_news.py

แต่ละบทความเป็นไฟล์ content/news/YYYY-MM-DD-<slug>.html: ส่วนหัวคั่นด้วย --- แล้วตามด้วยเนื้อหา HTML
    ---
    slug: exam-calendar-2569          (ใช้ทำ URL /prep/news/<slug>/ ห้ามเปลี่ยนหลังเผยแพร่)
    title: หัวข้อ
    description: สรุป 1-2 ประโยค (ใช้เป็น meta description และข้อความในรายการ)
    category: ปฏิทินสอบ
    type: NewsArticle | Article
    published: 2026-11-18
    updated: 2026-11-18                (ไม่ใส่ก็ได้)
    priority: 1                        (ไม่ใส่ก็ได้ ใช้เรียงบทความที่ลงวันเดียวกัน ค่ามากขึ้นก่อน)
    draft: yes                         (ไม่ใส่ก็ได้ ถ้าใส่จะไม่สร้างหน้า)
    ---
    <p class="lead">...</p>

ผลลัพธ์:
  public/prep/news/index.html, public/prep/news/<slug>/index.html
  public/prep/news/sitemap.xml (robots.txt ชี้มาที่นี่ แยกจาก public/sitemap.xml ที่ gen_public_pages.py เขียนทับทุกครั้ง)
  public/prep/news/feed.xml (RSS)
  บล็อกข่าวล่าสุด 3 เรื่องในหน้า landing ระหว่าง <!-- news:start และ <!-- news:end -->
หน้าตาใช้ public/prep/news/news.css (แก้ไฟล์นั้นตรง ๆ)
เนื้อหาต้องตรวจสอบได้: ห้ามแต่งตัวเลข ห้ามอ้างประกาศที่ยังไม่ออก
"""
import html
import json
import re
import sys
from datetime import date
from email.utils import format_datetime
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "content" / "news"
OUT = ROOT / "public" / "prep" / "news"
LANDING = ROOT / "public" / "prep" / "welcome" / "index.html"
BASE = "https://sobprep.com"
SITE = "ซ้อมสอบ SOBPREP"
OG_IMAGE = BASE + "/prep-og-v2.jpg"
LOGO = BASE + "/prep/welcome/img/logo.png"
BKK = timezone(timedelta(hours=7))
MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
REQUIRED = ("slug", "title", "description", "category", "published")


def esc(s):
    return html.escape(s, quote=True)


def thai_date(d):
    return f"{d.day} {MONTHS[d.month - 1]} {d.year + 543}"


def iso(d):
    return datetime(d.year, d.month, d.day, 9, 0, tzinfo=BKK).isoformat()


def load():
    posts = []
    for f in sorted(SRC.glob("*.html")):
        text = f.read_text(encoding="utf-8")
        m = re.match(r"---\n(.*?)\n---\n(.*)\Z", text, re.S)
        if not m:
            sys.exit(f"{f.name}: ไม่มีส่วนหัว --- ... ---")
        meta = {}
        for line in m.group(1).splitlines():
            if line.strip():
                k, _, v = line.partition(":")
                meta[k.strip()] = v.strip()
        missing = [k for k in REQUIRED if not meta.get(k)]
        if missing:
            sys.exit(f"{f.name}: ขาด {', '.join(missing)}")
        if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", meta["slug"]):
            sys.exit(f"{f.name}: slug ใช้ได้แค่ a-z 0-9 และ -")
        if meta.get("draft"):
            continue
        meta["published"] = date.fromisoformat(meta["published"])
        meta["updated"] = date.fromisoformat(meta["updated"]) if meta.get("updated") else meta["published"]
        meta["priority"] = int(meta.get("priority") or 0)
        meta["type"] = meta.get("type") or "Article"
        meta["body"] = m.group(2).strip()
        meta["url"] = f"{BASE}/prep/news/{meta['slug']}/"
        meta["path"] = f"/prep/news/{meta['slug']}/"
        posts.append(meta)
    slugs = [p["slug"] for p in posts]
    dup = {s for s in slugs if slugs.count(s) > 1}
    if dup:
        sys.exit(f"slug ซ้ำ: {', '.join(sorted(dup))}")
    posts.sort(key=lambda p: (p["published"], p["priority"]), reverse=True)
    return posts


NAV = """<nav class="nav"><div class="w"><a class="brand" href="/prep/welcome/"><img src="/prep/welcome/img/logo.png" alt="" width="32" height="32">ซ้อมสอบ SOBPREP</a>
<ul><li><a href="/prep/welcome/">หน้าแรก</a></li><li><a href="/prep/news/">ข่าวและบทความ</a></li><li><a href="/prep/sample/">ตัวอย่างข้อสอบ</a></li><li><a href="/prep/welcome/#price">ราคา</a></li></ul>
<div class="act"><a class="login" href="/prep">เข้าสู่ระบบ</a><a class="btn gold sm" href="/prep">ลองฟรี</a></div></div></nav>"""

FOOTER = """<footer><div class="w">ข้อสอบในแอปเป็นข้อสอบฝึกตามหัวข้อที่ออกสอบ ไม่ใช่ข้อสอบจริง และไม่รับประกันว่าจะออกสอบหรือผลการสอบ<br>
<a href="/prep/welcome/">หน้าแรก</a> · <a href="/prep/news/">ข่าวและบทความ</a> · <a href="/prep/sample/">ตัวอย่างข้อสอบ</a> · <a href="/prep/privacy">ความเป็นส่วนตัวและข้อกำหนด</a></div></footer>"""

# ?src= ในลิงก์ใช้แบบเดียวกับหน้า landing; ถ้าเข้ามาจากการค้นหา (ยังไม่มีช่องทางเก็บไว้) ให้นับว่ามาจากหน้าข่าว ไม่ทับช่องทางเดิม
SRC_JS = """<script>try{var s=new URLSearchParams(location.search).get("src");if(s&&/^[A-Za-z0-9_-]{1,40}$/.test(s))localStorage.setItem("pp-src",s.toLowerCase());else if(!localStorage.getItem("pp-src"))localStorage.setItem("pp-src","news")}catch(e){}</script>"""


def head(title, desc, url, og_type, ld, extra=""):
    return f"""<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{url}">
<link rel="icon" href="/prep-icons/favicon-32.png">
<link rel="alternate" type="application/rss+xml" title="{SITE} ข่าวและบทความ" href="{BASE}/prep/news/feed.xml">
<meta name="theme-color" content="#2e0b12">
<meta property="og:type" content="{og_type}"><meta property="og:url" content="{url}">
<meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}">
<meta property="og:image" content="{OG_IMAGE}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:site_name" content="{SITE}"><meta property="og:locale" content="th_TH">
<meta name="twitter:card" content="summary_large_image">{extra}
<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/prep/news/news.css">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
{SRC_JS}
</head><body>
{NAV}
"""


def crumbs(items):
    ld = {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": BASE + u} for i, (n, u) in enumerate(items)]}
    links = "".join(f'<li><a href="{u}">{esc(n)}</a></li>' for n, u in items[:-1])
    return ld, f'<ol class="crumb">{links}</ol>'


def meta_line(p):
    s = f'<time datetime="{p["published"].isoformat()}">{thai_date(p["published"])}</time>'
    if p["updated"] != p["published"]:
        s += f' · อัปเดต <time datetime="{p["updated"].isoformat()}">{thai_date(p["updated"])}</time>'
    return s


def item(p, tag="h2"):
    return (f'<li><a href="{p["path"]}"><small>{esc(p["category"])} · {thai_date(p["published"])}</small>'
            f'<{tag}>{esc(p["title"])}</{tag}><p>{esc(p["description"])}</p></a></li>')


CTA = """<aside class="cta"><img src="/prep/welcome/img/mascot-none-wave.webp" alt="" width="88" height="88"><div><b>ลองทำข้อสอบฝึกฟรี 3 ชุด</b><p>ภาค ก ภาค ข และวิชาเอก เฉลยทุกข้อ แยกคะแนนรายหมวด เข้าด้วย Google ไม่ต้องใส่บัตร</p></div><a class="btn gold" href="/prep">ลองฟรี</a></aside>"""


def article_page(p, posts):
    ld_crumb, crumb_html = crumbs([("หน้าแรก", "/prep/welcome/"), ("ข่าวและบทความ", "/prep/news/"), (p["title"], p["path"])])
    ld = {"@context": "https://schema.org", "@graph": [{
        "@type": p["type"], "headline": p["title"][:110], "description": p["description"],
        "datePublished": iso(p["published"]), "dateModified": iso(p["updated"]), "inLanguage": "th",
        "image": [OG_IMAGE], "articleSection": p["category"], "mainEntityOfPage": p["url"],
        "author": {"@type": "Organization", "name": SITE, "url": BASE + "/prep/welcome/"},
        "publisher": {"@type": "Organization", "name": SITE, "logo": {"@type": "ImageObject", "url": LOGO}},
    }, ld_crumb]}
    extra = (f'\n<meta property="article:published_time" content="{iso(p["published"])}">'
             f'<meta property="article:modified_time" content="{iso(p["updated"])}">'
             f'<meta property="article:section" content="{esc(p["category"])}">')
    more = [x for x in posts if x["slug"] != p["slug"]][:3]
    more_html = (f'<section class="more"><h2>อ่านต่อ</h2><ul class="list">{"".join(item(x, "h3") for x in more)}</ul></section>'
                 if more else "")
    return (head(f'{p["title"]} | {SITE}', p["description"], p["url"], "article", ld, extra)
            + f"""<main class="w art">{crumb_html}
<article><header><span class="cat">{esc(p["category"])}</span><h1>{esc(p["title"])}</h1><p class="meta">{meta_line(p)}</p></header>
<div class="body">
{p["body"]}
</div></article>
{CTA}
{more_html}
</main>
{FOOTER}
</body></html>
""")


def index_page(posts):
    title = "ข่าวสอบครูผู้ช่วยและบทความ"
    desc = "ข่าวและบทความสำหรับคนเตรียมสอบครูผู้ช่วย สพฐ. และ สอศ. ปฏิทินสอบ ข้อมูลวิชาที่คนพลาดบ่อย และแนวข้อสอบพร้อมเฉลย จาก SOBPREP"
    url = BASE + "/prep/news/"
    ld_crumb, crumb_html = crumbs([("หน้าแรก", "/prep/welcome/"), ("ข่าวและบทความ", "/prep/news/")])
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "CollectionPage", "name": title, "description": desc, "url": url, "inLanguage": "th",
         "mainEntity": {"@type": "ItemList", "itemListElement": [
             {"@type": "ListItem", "position": i + 1, "url": p["url"], "name": p["title"]} for i, p in enumerate(posts)]}},
        ld_crumb]}
    return (head(f"{title} | {SITE}", desc, url, "website", ld)
            + f"""<main class="w art">{crumb_html}
<header class="ix"><h1>{title}</h1><p>ปฏิทินสอบ ข้อมูลจากการซ้อมของผู้ใช้ และแนวข้อสอบพร้อมเฉลย</p></header>
<ul class="list">{"".join(item(p) for p in posts)}</ul>
{CTA}
</main>
{FOOTER}
</body></html>
""")


def sitemap(posts):
    newest = max(p["updated"] for p in posts)
    urls = [(BASE + "/prep/news/", newest)] + [(p["url"], p["updated"]) for p in posts]
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + "".join(f"  <url><loc>{u}</loc><lastmod>{d.isoformat()}</lastmod></url>\n" for u, d in urls)
            + "</urlset>\n")


def feed(posts):
    def rfc(d):
        return format_datetime(datetime(d.year, d.month, d.day, 9, 0, tzinfo=BKK))
    items = "".join(
        f"<item><title>{esc(p['title'])}</title><link>{p['url']}</link><guid>{p['url']}</guid>"
        f"<pubDate>{rfc(p['published'])}</pubDate><category>{esc(p['category'])}</category>"
        f"<description>{esc(p['description'])}</description></item>\n" for p in posts)
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>{SITE} ข่าวและบทความ</title>'
            f"<link>{BASE}/prep/news/</link><description>ข่าวสอบครูผู้ช่วยและบทความจาก {SITE}</description><language>th</language>\n"
            f"{items}</channel></rss>\n")


def landing_block(posts):
    cards = "".join(
        f'<a class="card nwc" href="{p["path"]}"><small>{esc(p["category"])} · {thai_date(p["published"])}</small>'
        f'<h3>{esc(p["title"])}</h3><p>{esc(p["description"])}</p></a>' for p in posts[:3])
    return ('<!-- news:start (generated by scripts/prep/gen_news.py — do not edit by hand) -->\n'
            '<section id="news" class="cream"><div class="w"><div class="hd"><small>ข่าวและบทความ</small>'
            '<h2>ข่าวสอบครูผู้ช่วยและบทความล่าสุด</h2></div>\n'
            f'<div class="nw">{cards}</div>\n<p class="nw-all"><a href="/prep/news/">ดูข่าวและบทความทั้งหมด</a></p></div></section>\n'
            '<!-- news:end -->')


def main():
    posts = load()
    if not posts:
        sys.exit("ไม่มีบทความใน content/news/")
    OUT.mkdir(parents=True, exist_ok=True)
    keep = {p["slug"] for p in posts}
    for d in OUT.iterdir():
        # ลบหน้าของบทความที่ถูกลบหรือกลับเป็น draft (เฉพาะโฟลเดอร์ที่สคริปต์นี้สร้าง)
        if d.is_dir() and d.name not in keep and (d / "index.html").exists() and len(list(d.iterdir())) == 1:
            (d / "index.html").unlink()
            d.rmdir()
    for p in posts:
        (OUT / p["slug"]).mkdir(exist_ok=True)
        (OUT / p["slug"] / "index.html").write_text(article_page(p, posts), encoding="utf-8")
    (OUT / "index.html").write_text(index_page(posts), encoding="utf-8")
    (OUT / "sitemap.xml").write_text(sitemap(posts), encoding="utf-8")
    (OUT / "feed.xml").write_text(feed(posts), encoding="utf-8")

    page = LANDING.read_text(encoding="utf-8")
    new, n = re.subn(r"<!-- news:start.*?<!-- news:end -->", lambda _: landing_block(posts), page, flags=re.S)
    if n != 1:
        sys.exit("หน้า landing ไม่มีเครื่องหมาย <!-- news:start --> ... <!-- news:end --> (ต้องมี 1 ชุด)")
    LANDING.write_text(new, encoding="utf-8")
    print(f"บทความ {len(posts)} เรื่อง → public/prep/news/ (+ sitemap.xml, feed.xml) และอัปเดตบล็อกข่าวในหน้า landing")


if __name__ == "__main__":
    main()
