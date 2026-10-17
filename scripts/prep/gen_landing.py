#!/usr/bin/env python3
"""Generate the public marketing landing page: public/prep/welcome/index.html (static, no JS).

Prices and counts here are copied by hand from src/prep/config.ts / the live prep.prices table — update this file
(and rerun) when the admin changes prices. Run: python3 scripts/prep/gen_landing.py
"""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "prep" / "welcome" / "index.html"
BASE = "https://sobprep.com"
URL = f"{BASE}/prep/welcome/"
LINE = "https://lin.ee/ROuWTfN"

TITLE = "ซ้อมสอบ SOBPREP | ซ้อมข้อสอบครูผู้ช่วย ภาค ก ภาค ข วิชาเอก เฉลยละเอียด ลองฟรี"
DESC = "เว็บฝึกทำข้อสอบครูผู้ช่วย ภาค ก ภาค ข วิชาเอก เฉลยละเอียดทุกข้อ ทวนข้อที่ผิดให้เอง จำลองสอบจับเวลา ลองฟรี 3 ชุด ไม่ต้องสมัคร"

FEATURES = [
    ("💡", "เฉลยละเอียดทุกข้อ", "ตอบเสร็จเห็นเฉลยและคำอธิบายทันที รู้ว่าทำไมถึงถูก ไม่ใช่แค่ดูเฉลยลอย ๆ"),
    ("🔁", "ทวนข้อที่ผิดให้เอง", "ข้อที่ผิดวนกลับมาตามรอบ วันถัดไป → 3 → 7 → 14 วัน ทำถูกก็ผ่านไปรอบถัดไป"),
    ("⏱️", "จำลองสอบจับเวลา", "จับเวลาให้เหมือนสนามสอบ ไม่เฉลยจนกว่าจะส่ง หมดเวลาระบบส่งให้เอง"),
    ("📊", "คะแนนรายหมวด", "เห็นชัดว่าหมวดไหนแข็ง หมวดไหนต้องเร่ง ไม่ต้องเดาเอง"),
    ("🔥", "ข้อสอบประจำวัน", "10 ข้อ ฟรีทุกวัน ทำต่อเนื่องสะสมวัน ช่วยให้ซ้อมเป็นนิสัย"),
    ("🎯", "เลือกหมวดเอง", "เลือกหมวดที่อยากฝึก แล้วระบบจัดชุดข้อสอบให้ ไม่ต้องไล่หาไฟล์"),
    ("📚", "ภาค ก · ภาค ข · วิชาเอก", "คิดวิเคราะห์ ภาษาอังกฤษ ข้าราชการที่ดี วิชาชีพครู กฎหมายการศึกษา และวิชาเอก"),
    ("📱", "ใช้บนมือถือ", "เปิดผ่านเบราว์เซอร์ได้เลย ติดตั้งบนหน้าจอเป็นไอคอนได้ ไม่ต้องโหลดจากสโตร์"),
]

MAJORS = [
    ("ภาษาไทย", None), ("อุตสาหกรรมศิลป์", None),
    ("คณิตศาสตร์", "major-mathematics"), ("ภาษาอังกฤษ", "major-english"), ("เคมี", "major-chemistry"),
    ("ประถมศึกษา", "major-primary-education"), ("นาฏศิลป์", "major-dance"),
    ("ชีววิทยา", None), ("สังคมศึกษา", None), ("ปฐมวัย", None), ("ฟิสิกส์", None), ("คอมพิวเตอร์", None),
    ("วิทยาศาสตร์ทั่วไป", None), ("การศึกษาพิเศษ", None), ("ดนตรี", None), ("ศิลปศึกษา", None), ("พลศึกษา", None),
]

PACKS = [
    ("แพ็กภาค ก", "คิดวิเคราะห์ · ภาษาอังกฤษ · ข้าราชการที่ดี", "49", "99", False),
    ("แพ็กภาค ข + วิชาเอก", "วิชาชีพครู · กฎหมายการศึกษา · วิชาเอก", "69", "129", False),
    ("แพ็กครบทุกภาค", "ภาค ก + ภาค ข + วิชาเอก", "99", "179", True),
]

FAQ = [
    ("ลองฟรีได้อะไรบ้าง?", "สร้างชุดข้อสอบได้ 3 ชุด (ชุดละไม่เกิน 40 ข้อ) และทำข้อสอบประจำวัน 10 ข้อได้ฟรีทุกวัน เข้าสู่ระบบด้วยบัญชี Google ได้เลย ไม่ต้องสมัครสมาชิกและไม่ต้องใส่บัตร"),
    ("เป็นข้อสอบจริงหรือเปล่า?", "ไม่ใช่ข้อสอบจริง เป็นข้อสอบฝึกตามหัวข้อที่ออกสอบ เพื่อให้ซ้อมเป็นระบบและรู้จุดอ่อนก่อนวันสอบ เราไม่รับประกันว่าข้อสอบในเว็บจะออกสอบ และไม่รับประกันผลการสอบ"),
    ("ซื้อแล้วใช้ได้นานแค่ไหน?", "มี 2 แบบ รายรอบใช้ได้ 3 เดือนนับจากวันกรอกคีย์ และซื้อขาดใช้ได้ต่อเนื่อง ซื้อภาคเดียวก่อนได้ ค่อยอัปเกรดทีหลัง จ่ายแค่ส่วนต่าง"),
    ("จ่ายเงินอย่างไร?", "สแกน Thai QR / พร้อมเพย์ จ่ายได้ทุกแอปธนาคาร แล้วส่งสลิปทาง LINE เพื่อรับคีย์ไปกรอกในแอป"),
    ("มีวิชาเอกของฉันไหม?", "วิชาเอกที่มีข้อสอบ 200 ข้อขึ้นไปตอนนี้มี 17 วิชา ได้แก่ ภาษาไทย อุตสาหกรรมศิลป์ คณิตศาสตร์ ภาษาอังกฤษ เคมี ชีววิทยา ฟิสิกส์ วิทยาศาสตร์ทั่วไป สังคมศึกษา ปฐมวัย ประถมศึกษา การศึกษาพิเศษ คอมพิวเตอร์ ดนตรี ศิลปศึกษา พลศึกษา และนาฏศิลป์ วิชาเอกอื่นกำลังทยอยเพิ่ม ทักมาบอกได้ว่าอยากได้วิชาไหนก่อน"),
    ("ใช้บนมือถือได้ไหม?", "ได้ เปิดผ่านเบราว์เซอร์บนมือถือหรือคอมพิวเตอร์ได้เลย และติดตั้งเป็นไอคอนบนหน้าจอได้"),
]

CSS = """
:root{--r1:#8E1B2E;--r2:#6E1423;--r3:#4A0B16;--g:#D4AF37;--g2:#F3D98A;--ink:#2A1418;--mut:#6f5a5f;--bg:#FBF7F1}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;font-family:Prompt,Sarabun,system-ui,sans-serif;background:var(--bg);color:var(--ink);line-height:1.6;padding-bottom:84px}
a{color:inherit}.w{max-width:1040px;margin:0 auto;padding:0 20px}
.top{position:sticky;top:0;z-index:5;background:rgba(74,11,22,.96);backdrop-filter:blur(6px);color:#fff;border-bottom:3px solid var(--g)}
.top .w{display:flex;align-items:center;justify-content:space-between;height:58px}
.brand{display:flex;gap:10px;align-items:center;font-weight:800;text-decoration:none;color:#fff}.brand img{width:34px;height:34px;border-radius:9px}
.btn{display:inline-block;background:linear-gradient(180deg,var(--g2),#C9A227);color:var(--r3);font-weight:800;border-radius:99px;padding:12px 26px;text-decoration:none;box-shadow:0 10px 24px -12px rgba(0,0,0,.6)}
.btn.sm{padding:8px 18px;font-size:.92rem}.btn.big{font-size:1.2rem;padding:16px 38px}
.btn.line{background:#06C755;color:#fff}.btn.ghost{background:transparent;border:2px solid var(--g2);color:var(--g2);box-shadow:none}
.hero{background:radial-gradient(120% 90% at 80% 0%,#A3263B 0%,var(--r2) 45%,var(--r3) 100%);color:#fff;padding:44px 0 56px;overflow:hidden}
.hero .w{display:grid;gap:30px;align-items:center}
.tag{display:inline-block;background:var(--g2);color:var(--r3);font-weight:700;border-radius:99px;padding:6px 16px;font-size:.9rem}
h1{font-size:clamp(2.1rem,6.4vw,3.6rem);line-height:1.15;margin:14px 0;letter-spacing:-.5px;font-weight:800}h1 em{font-style:normal;color:var(--g2)}
.hero p.l{font-size:1.15rem;color:#f4dde1;margin:0 0 22px;max-width:34em}
.ticks{list-style:none;padding:0;margin:0 0 26px;display:grid;gap:8px}.ticks li:before{content:"✓";display:inline-grid;place-items:center;width:24px;height:24px;margin-right:10px;border-radius:50%;background:var(--g2);color:var(--r3);font-weight:800;font-size:.85rem}
.sub{font-size:.9rem;color:#e6c9ce;margin-top:12px}
.ph{width:min(280px,70vw);justify-self:center;background:#111;border-radius:40px;padding:8px;box-shadow:0 40px 70px -24px rgba(0,0,0,.7),0 0 0 2px #2b2b2b;transform:rotate(3deg)}
.ph img{display:block;width:100%;border-radius:32px}
@media(min-width:820px){.hero .w{grid-template-columns:1.15fr .85fr}.ph{width:300px}}
section.s{padding:56px 0}section.s.alt{background:#fff}
h2{font-size:clamp(1.6rem,4.4vw,2.3rem);line-height:1.25;margin:0 0 10px;font-weight:800}h2 em{font-style:normal;color:var(--r1)}
.lead{color:var(--mut);margin:0 0 28px;max-width:40em}
.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}
.card{background:#fff;border-radius:22px;padding:22px;box-shadow:0 10px 30px -20px rgba(74,11,22,.55);border:1px solid #f0e4d8}
.alt .card{background:var(--bg)}.card .i{font-size:2rem}.card h3{margin:6px 0 4px;font-size:1.12rem}.card p{margin:0;color:var(--mut);font-size:.95rem}
.pain{background:var(--r3);color:#fff;padding:48px 0;text-align:center}.pain h2{color:#fff}.pain p{color:#e9cfd3;max-width:36em;margin:0 auto 6px;font-size:1.1rem}
.steps{display:grid;gap:16px;counter-reset:s}.steps .card{position:relative;padding-left:78px}
.steps .card:before{counter-increment:s;content:counter(s);position:absolute;left:20px;top:20px;width:42px;height:42px;border-radius:50%;background:var(--r1);color:var(--g2);font-weight:800;display:grid;place-items:center;font-size:1.25rem}
.shots{display:grid;gap:30px;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));align-items:start}
.shot{text-align:center}.shot .ph{transform:none;width:min(240px,64vw);margin:0 auto 14px;padding:6px;border-radius:34px}.shot .ph img{border-radius:28px}
.shot b{display:block;font-size:1.1rem}.shot span{color:var(--mut);font-size:.93rem}
.note{font-size:.82rem;color:var(--mut);text-align:center;margin-top:18px}
.chips{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 20px}.chips a,.chips span{background:#fff;border:1.5px solid var(--r1);color:var(--r1);border-radius:99px;padding:7px 16px;text-decoration:none;font-weight:600;font-size:.95rem}
.chips span{border-color:#d9c9c9;color:var(--mut)}
.pack{display:flex;flex-direction:column;gap:6px}.pack.best{border:3px solid var(--g);position:relative}.pack .bd{position:absolute;top:-14px;right:18px;background:var(--g);color:var(--r3);font-weight:800;font-size:.8rem;border-radius:99px;padding:3px 12px}
.price{font-size:2.3rem;font-weight:800;color:var(--r1);line-height:1}.price small{font-size:.95rem;color:var(--mut);font-weight:500}
.pack hr{border:0;border-top:1px dashed #e4d4c4;margin:8px 0;width:100%}
.up{background:var(--r1);color:#fff;border-radius:22px;padding:22px 26px;margin-top:20px;font-size:1.05rem}.up b{color:var(--g2)}
details{background:#fff;border-radius:16px;padding:16px 20px;margin:10px 0;border:1px solid #f0e4d8}details summary{cursor:pointer;font-weight:700;list-style:none}details summary::-webkit-details-marker{display:none}
details summary:after{content:"＋";float:right;color:var(--r1)}details[open] summary:after{content:"－"}details p{margin:10px 0 0;color:var(--mut)}
.final{background:radial-gradient(120% 90% at 20% 0%,#A3263B 0%,var(--r2) 50%,var(--r3) 100%);color:#fff;text-align:center;padding:60px 0}
.final h2{color:#fff}.final p{color:#f0d6da}.final .row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:22px}
footer{padding:26px 0;font-size:.85rem;color:var(--mut);text-align:center}
.bar{position:fixed;left:0;right:0;bottom:0;z-index:6;background:rgba(74,11,22,.97);padding:10px 16px;display:flex;gap:10px;justify-content:center;align-items:center;border-top:3px solid var(--g);padding-bottom:max(10px,env(safe-area-inset-bottom))}
.bar span{color:#fff;font-weight:600;font-size:.92rem}@media(max-width:520px){.bar span{display:none}.bar .btn{flex:1;text-align:center}}
"""


def e(s):
    return html.escape(s, quote=True)


def build():
    faq_ld = {
        "@context": "https://schema.org", "@graph": [
            {"@type": "WebSite", "name": "ซ้อมสอบ SOBPREP", "url": f"{BASE}/prep", "inLanguage": "th"},
            {"@type": "FAQPage", "mainEntity": [
                {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ]},
        ]}
    feats = "".join(f'<div class="card"><div class="i">{i}</div><h3>{e(t)}</h3><p>{e(d)}</p></div>' for i, t, d in FEATURES)
    majors = "".join(
        f'<a href="/prep/sample/{s}/">{e(n)}</a>' if s else f"<span>{e(n)}</span>" for n, s in MAJORS)
    packs = "".join(
        f'<div class="card pack{" best" if best else ""}">{"<div class=bd>คุ้มที่สุด</div>" if best else ""}'
        f'<h3>{e(n)}</h3><p>{e(d)}</p><hr><div class="price">{r}<small> บาท · รายรอบ 3 เดือน</small></div>'
        f'<div class="price" style="font-size:1.7rem">{l}<small> บาท · ซื้อขาด</small></div></div>'
        for n, d, r, l, best in PACKS)
    faq = "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in FAQ)
    return f"""<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(TITLE)}</title>
<meta name="description" content="{e(DESC)}">
<link rel="canonical" href="{URL}">
<link rel="icon" href="/prep-icons/favicon-32.png">
<meta name="theme-color" content="#6E1423">
<meta property="og:type" content="website"><meta property="og:url" content="{URL}">
<meta property="og:title" content="{e(TITLE)}"><meta property="og:description" content="{e(DESC)}">
<meta property="og:image" content="{BASE}/prep-og-v2.jpg"><meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:site_name" content="ซ้อมสอบ SOBPREP"><meta property="og:locale" content="th_TH">
<meta name="twitter:card" content="summary_large_image">
<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>{CSS}</style>
<script type="application/ld+json">{json.dumps(faq_ld, ensure_ascii=False).replace("</", "<\\/")}</script>
</head><body>
<div class="top"><div class="w"><a class="brand" href="/prep/welcome/"><img src="/prep/welcome/img/logo.png" alt="" width="34" height="34">ซ้อมสอบ SOBPREP</a><a class="btn sm" href="/prep">ลองฟรี</a></div></div>

<header class="hero"><div class="w"><div>
<span class="tag">สำหรับคนสอบครูผู้ช่วย</span>
<h1>ซ้อมข้อสอบครูผู้ช่วย<br><em>ทำซ้ำจนเคลียร์</em></h1>
<p class="l">ทำข้อสอบ ดูเฉลย ทวนข้อที่ผิดให้เอง แล้วจำลองสอบจับเวลาก่อนวันจริง ครบทั้งภาค ก ภาค ข และวิชาเอก บนมือถือเครื่องเดียว</p>
<ul class="ticks"><li>ลองฟรี 3 ชุด ไม่ต้องสมัคร ไม่ต้องใส่บัตร</li><li>ข้อสอบประจำวัน 10 ข้อ ฟรีทุกวัน</li><li>เฉลยละเอียดทุกข้อ รู้ว่าทำไมถึงถูก</li></ul>
<a class="btn big" href="/prep">ลองฟรี 3 ชุด →</a>
<div class="sub">เข้าด้วยบัญชี Google ได้เลย · sobprep.com/prep</div>
</div><div class="ph"><img src="/prep/welcome/img/home.webp" alt="หน้าหลักแอปซ้อมสอบ SOBPREP" width="540" height="1168"></div></div></header>

<div class="pain"><div class="w"><h2>ทำข้อสอบเก่าไปเรื่อย ๆ แต่ไม่รู้ว่า<em style="color:var(--g2)">อ่อนตรงไหน</em>?</h2>
<p>ทำเสร็จก็ผ่านไป ผิดแล้วลืม สองอาทิตย์ผ่านไปผิดข้อเดิม ไม่มีใครบอกว่าควรทวนอะไรก่อนสอบ</p>
<p><b>SOBPREP จัดการให้ ตั้งแต่เฉลยจนถึงทวนข้อที่ผิด</b></p></div></div>

<section class="s"><div class="w"><h2>ทุกอย่างที่ต้องใช้<em>ซ้อมสอบให้เป็นระบบ</em></h2>
<p class="lead">ออกแบบมาจากปัญหาของคนเตรียมสอบจริง ไม่ใช่แค่คลังข้อสอบให้ไล่ทำ</p><div class="grid">{feats}</div></div></section>

<section class="s alt"><div class="w"><h2>เริ่มใน <em>3 ขั้น</em> ไม่ต้องจ่ายก่อน</h2>
<p class="lead">ใช้เวลาไม่ถึงนาที</p><div class="steps">
<div class="card"><h3>เข้าเว็บ</h3><p>เปิด sobprep.com/prep บนมือถือหรือคอมพิวเตอร์</p></div>
<div class="card"><h3>ล็อกอินด้วย Google</h3><p>ไม่ต้องสมัครสมาชิก ไม่ต้องกรอกข้อมูลเยอะ</p></div>
<div class="card"><h3>เลือกหมวด แล้วลองทำเลย</h3><p>ฟรี 3 ชุด (ชุดละไม่เกิน 40 ข้อ) และข้อสอบประจำวัน 10 ข้อ</p></div></div>
<p style="text-align:center;margin-top:26px"><a class="btn big" href="/prep">ลองฟรีตอนนี้ →</a></p></div></section>

<section class="s"><div class="w"><h2>หน้าตา<em>จริงในแอป</em></h2><p class="lead">ดูก่อนว่าใช้งานเป็นอย่างไร</p>
<div class="shots">
<div class="shot"><div class="ph"><img src="/prep/welcome/img/mock.webp" alt="หน้าจำลองสอบจับเวลา" width="540" height="1168"></div><b>จำลองสอบจับเวลา</b><span>ไม่เฉลยจนกว่าจะส่ง</span></div>
<div class="shot"><div class="ph"><img src="/prep/welcome/img/result.webp" alt="หน้าผลคะแนนรายหมวด" width="540" height="1168"></div><b>คะแนนรายหมวด</b><span>รู้ว่าหมวดไหนต้องเร่ง</span></div>
<div class="shot"><div class="ph"><img src="/prep/welcome/img/daily.webp" alt="หน้าข้อสอบประจำวัน" width="540" height="1168"></div><b>ข้อสอบประจำวัน</b><span>10 ข้อ ฟรีทุกวัน</span></div></div>
<p class="note">ภาพจากหน้าจอแอป ข้อมูลในภาพเป็นข้อมูลตัวอย่าง</p></div></section>

<section class="s alt"><div class="w"><h2>ครอบคลุม<em>ทั้งภาค ก ภาค ข และวิชาเอก</em></h2>
<p class="lead">คลังข้อสอบกว่า 10,000 ข้อ ณ ตุลาคม 2569 และเพิ่มขึ้นทุกสัปดาห์</p>
<div class="grid">
<div class="card"><div class="i">🧠</div><h3>ภาค ก · กว่า 2,800 ข้อ</h3><p>ความรู้ความสามารถทั่วไป: คิดวิเคราะห์ · ภาษาอังกฤษ · ข้าราชการที่ดี</p></div>
<div class="card"><div class="i">🏫</div><h3>ภาค ข · กว่า 1,000 ข้อ</h3><p>วิชาชีพครู · หลักสูตร · การวัดและประเมินผล · กฎหมายการศึกษา</p></div>
<div class="card"><div class="i">🎓</div><h3>วิชาเอก · กว่า 6,000 ข้อ</h3><p>ครอบคลุม 17 วิชาเอก และกำลังทยอยเพิ่มวิชาอื่น ๆ</p></div></div>
<p style="margin:26px 0 8px;font-weight:700">วิชาเอกที่มีข้อสอบ 200 ข้อขึ้นไป 17 วิชา (วิชาที่เป็นลิงก์ กดดูตัวอย่างพร้อมเฉลยได้)</p>
<div class="chips">{majors}</div>
<p><a href="/prep/sample/" style="color:var(--r1);font-weight:700">ดูตัวอย่างข้อสอบพร้อมเฉลยทั้งหมด →</a></p></div></section>

<section class="s"><div class="w"><h2>ราคา<em>เข้าถึงง่าย</em></h2>
<p class="lead">เลือกภาคที่ต้องการ ซื้อรายรอบหรือซื้อขาดก็ได้</p><div class="grid">{packs}</div>
<div class="up">ซื้อภาคเดียวก่อนได้ ค่อยอัปเกรดทีหลัง <b>จ่ายแค่ส่วนต่าง</b> เช่น ภาค ก ซื้อขาด → ครบทุกภาค เพิ่มแค่ 80 บาท</div>
<p class="note" style="text-align:left">ราคา ณ ตุลาคม 2569 ดูราคาล่าสุดในหน้าอัปเกรดในแอป · จ่ายผ่าน Thai QR / พร้อมเพย์</p></div></section>

<section class="s alt"><div class="w"><h2>คำถามที่<em>พบบ่อย</em></h2><div style="margin-top:16px">{faq}</div></div></section>

<section class="final"><div class="w"><h2>เริ่มซ้อมวันนี้<br>แล้วดูว่าอ่อนตรงไหน</h2>
<p>ลองฟรี 3 ชุด ไม่ต้องสมัคร ไม่ต้องใส่บัตร</p>
<div class="row"><a class="btn big" href="/prep">ลองฟรี 3 ชุด →</a><a class="btn big line" href="{LINE}">ทัก LINE @701pvghq</a></div></div></section>

<footer><div class="w">เป็นข้อสอบฝึกตามหัวข้อที่ออกสอบ ไม่ใช่ข้อสอบจริง และไม่รับประกันว่าจะออกสอบหรือผลการสอบ ·
<a href="/prep/privacy">ความเป็นส่วนตัวและข้อกำหนด</a> · <a href="/prep/guide">คู่มือ</a> · <a href="/prep/sample/">ตัวอย่างข้อสอบ</a></div></footer>

<div class="bar"><span>ลองฟรี 3 ชุด ไม่ต้องสมัคร</span><a class="btn" href="/prep">เริ่มซ้อมฟรี</a><a class="btn line" href="{LINE}">LINE</a></div>
</body></html>"""


if __name__ == "__main__":
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(build(), encoding="utf-8")
    print("wrote", OUT)
