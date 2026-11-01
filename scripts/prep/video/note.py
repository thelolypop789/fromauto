# "Notebook sticker" summary clip: grid paper, navy ink, pastel sticker cards with hard shadows, washi tape, emoji
# icons; each page builds up as the voice goes. Voice from Gemini TTS (cached), timed per phrase.
# Usage: note.py <storyboard.json> <out.mp4> [--voice Charon] [--model gemini-3.8-flash-tts] [--still T]
import sys, os, json, math, argparse, subprocess
import numpy as np
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import story
from lib import text_img, text_w, sprite, paste, prog, ease_out, ease_in_out, back_out, sub_chunks, W, H

# SOBPREP look: the app's cream page, maroon/gold header, and the summary-map tones (src/prep/summary.css t-*).
NAVY = (0x2A, 0x14, 0x18)          # ink (--pp-ink); name kept for the shared helpers
PAPER = (0xFB, 0xF7, 0xF1); GRIDC = (0xEA, 0xDF, 0xD8)
MAROON, MAROON_D, GOLD, GOLD_B, CREAM = (0x8E, 0x1B, 0x2E), (0x6E, 0x14, 0x23), (0xB8, 0x86, 0x0B), (0xD4, 0xAF, 0x37), (0xFF, 0xF8, 0xEC)
TONE = {"pink": ((0xE8, 0x57, 0x7A), (0xFF, 0xEF, 0xF3), (0xFF, 0xD0, 0xDB)), "green": ((0x22, 0xA0, 0x6B), (0xEA, 0xFB, 0xF2), (0xC5, 0xF0, 0xDA)),
        "blue": ((0x2F, 0x80, 0xED), (0xEE, 0xF6, 0xFF), (0xCF, 0xE3, 0xFF)), "yellow": ((0xC9, 0x8A, 0x00), (0xFF, 0xF8, 0xDD), (0xFF, 0xE9, 0xA0)),
        "lilac": ((0x7B, 0x5B, 0xD6), (0xF3, 0xEE, 0xFF), (0xDE, 0xD2, 0xFF)), "orange": ((0xE0, 0x7A, 0x1F), (0xFF, 0xF1, 0xE4), (0xFF, 0xD9, 0xB5)),
        "white": ((0xCD, 0xBF, 0xB4), (0xFF, 0xFF, 0xFF), (0xEA, 0xDF, 0xD8))}
PAL = {k: v[1] for k, v in TONE.items()}
EMOJI = "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"
MARGIN, CONTENT_W, TOP = 44, 960, 400

@lru_cache(None)
def paper():
    im = Image.new("RGB", (W, H), PAPER); d = ImageDraw.Draw(im)
    for y in range(0, 330):   # maroon header band like the app's top bar, gold rule under it
        k = y / 330; d.line([(0, y), (W, y)], fill=tuple(int(MAROON[i] + (MAROON_D[i] - MAROON[i]) * k) for i in range(3)))
    d.rectangle([0, 330, W, 336], fill=GOLD_B)
    for x, y, r in [(80, 1500, 160), (1000, 900, 220)]:  # soft warm blobs so the page is not flat
        blob = Image.new("L", (W, H), 0); ImageDraw.Draw(blob).ellipse([x - r, y - r, x + r, y + r], fill=60)
        im.paste((0xF6, 0xE7, 0xD9), (0, 0), blob.filter(ImageFilter.GaussianBlur(80)))
    sb = ink("ซ้อมสอบ SOBPREP", 30, 700, (0xE9, 0xC9, 0xCF)); im.paste(sb, (60, 40), sb)
    return im.convert("RGBA")

@lru_cache(512)
def emoji(ch, size):
    f = ImageFont.truetype(EMOJI, 109)
    im = Image.new("RGBA", (160, 160), (0, 0, 0, 0)); ImageDraw.Draw(im).text((10, 10), ch, font=f, embedded_color=True)
    im = im.crop(im.getbbox() or (0, 0, 1, 1)); k = size / max(im.width, im.height)
    return im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)

def ink(t, size, w=800, color=NAVY): return text_img(t, size, w, color)

def sticker(w, h, fill, r=26, shadow=7, outline=4):
    """Card in a summary tone: tinted fill, soft tone shadow, coloured bar on the left."""
    tone = next((v for v in TONE.values() if v[1] == fill), TONE["white"])
    pad = 16; im = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle([pad, pad + 8, pad + w, pad + h + 8], radius=r, fill=(*tone[2], 255))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(8)))
    d = ImageDraw.Draw(im); d.rounded_rectangle([pad, pad, pad + w, pad + h], radius=r, fill=fill, outline=tone[2], width=2)
    if outline >= 4 and h > 60: d.rounded_rectangle([pad, pad, pad + 12, pad + h], radius=6, fill=tone[0])
    return im

def tape(im, x=None, y=-14):
    """The app's gold "ต้องจำ" sticker on the card's top-right corner."""
    t = ink("ต้องจำ", 30, 800, (0x7A, 0x5A, 0x00)); w, h = t.width + 40, t.height + 8
    st = Image.new("RGBA", (w, h), (0, 0, 0, 0)); ImageDraw.Draw(st).rounded_rectangle([0, 0, w - 1, h - 1], radius=h // 2, fill=(0xFB, 0xF3, 0xDC), outline=GOLD_B, width=3)
    st.alpha_composite(t, (20, (h - t.height) // 2 - 2)); st = st.rotate(4, expand=True, resample=Image.BICUBIC)
    im2 = Image.new("RGBA", (im.width, im.height + 26), (0, 0, 0, 0)); im2.alpha_composite(im, (0, 22)); im2.alpha_composite(st, (im.width - st.width - 24, 0)); return im2

def lines_img(text, size, color=NAVY, gap=1.35):
    ls = text.split("\n"); imgs = [ink(l, size, 800, color) for l in ls]
    w = max(i.width for i in imgs); h = int(size * gap * (len(ls) - 1)) + imgs[-1].height
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); y = 0
    for i in imgs: im.alpha_composite(i, (0, y)); y += int(size * gap)
    return im

# ---------------------------------------------------------------- item renderers → RGBA image
def r_card(it):
    size = 70 if it.get("big") else 54
    body = lines_img(it["text"], size); ew = 0
    if it.get("emoji"): em = emoji(it["emoji"], int(size * 1.3)); ew = em.width + 22
    w = CONTENT_W; h = max(body.height, int(size * 1.35)) + 50
    im = sticker(w, h, PAL[it.get("color", "white")])
    x = 32
    if it.get("emoji"): im.alpha_composite(em, (x, (h - em.height) // 2)); x += ew
    im.alpha_composite(body, (x, (h - body.height) // 2 - 4))
    return tape(im) if it.get("tape") else im

def r_num(it):
    t = lines_img(it["text"], 54); h = t.height + 40; w = CONTENT_W
    im = sticker(w, h, PAL["white"]); d = ImageDraw.Draw(im)
    cy = h // 2 + 16; d.ellipse([40, cy - 32, 104, cy + 32], fill=GOLD_B, outline=GOLD, width=3)
    n = ink(str(it["n"]), 40, 800, MAROON_D); im.alpha_composite(n, (72 - n.width // 2, cy - n.height // 2 - 2))
    im.alpha_composite(t, (132, 16 + (h - t.height) // 2 - 4)); return im

def r_flag(it, ok):
    col = (0x1E, 0x8E, 0x4E) if ok else (0xD9, 0x30, 0x3E)
    t = ink(("✓  " if ok else "✗  ") + it["text"], 46, 800, col); w, h = t.width + 50, t.height + 18
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=h // 2, fill=(255, 255, 255), outline=col, width=3)
    im.alpha_composite(t, (22, (h - t.height) // 2 - 2)); return im.rotate(-2, expand=True, resample=Image.BICUBIC)

def r_tags(it):
    pills = []
    for e, t in it["tags"]:
        ti = ink(t, 46); em = emoji(e, 54); w, h = ti.width + em.width + 60, max(ti.height, em.height) + 22
        p = sticker(w, h, PAL["white"], r=h // 2, shadow=4, outline=3); p.alpha_composite(em, (16, (h - em.height) // 2)); p.alpha_composite(ti, (16 + em.width + 12, (h - ti.height) // 2 - 3))
        pills.append(p)
    rows, cur, cw = [], [], 0
    for p in pills:
        if cur and cw + p.width > CONTENT_W: rows.append(cur); cur, cw = [], 0
        cur.append(p); cw += p.width + 14
    rows.append(cur)
    hh = sum(max(p.height for p in r) for r in rows) + 14 * (len(rows) - 1)
    im = Image.new("RGBA", (CONTENT_W, hh), (0, 0, 0, 0)); y = 0
    for r in rows:
        x = 0
        for p in r: im.alpha_composite(p, (x, y)); x += p.width + 14
        y += max(p.height for p in r) + 14
    return im

def r_flow(it):
    def box(b):
        t = lines_img(b["text"], 46); em = emoji(b["emoji"], 72) if b.get("emoji") else None
        w = 400; h = t.height + (em.height + 14 if em else 0) + 48
        im = sticker(w, h, PAL[b.get("color", "white")])
        y = 18
        if em: im.alpha_composite(em, ((w - em.width) // 2, y)); y += em.height + 12
        im.alpha_composite(t, ((w - t.width) // 2, y - 4)); return im
    a, b = box(it["a"]), box(it["b"]); h = max(a.height, b.height)
    gapw = CONTENT_W - a.width - b.width
    im = Image.new("RGBA", (CONTENT_W, h), (0, 0, 0, 0))
    im.alpha_composite(a, (0, (h - a.height) // 2)); im.alpha_composite(b, (a.width + gapw, (h - b.height) // 2))
    ar = Image.new("RGBA", (96, 96), (0, 0, 0, 0)); d = ImageDraw.Draw(ar); d.ellipse([0, 0, 95, 95], fill=MAROON)
    d.polygon([(36, 26), (70, 48), (36, 70)], fill=CREAM)
    im.alpha_composite(ar, (a.width + (gapw - 96) // 2, h // 2 - 48)); return im

def r_row(it):
    lab = ink(it["label"], 46); lw = max(170, lab.width + 44)
    t = lines_img(it["text"], 46); w = CONTENT_W; h = max(t.height, lab.height) + 50
    im = sticker(w, h, PAL["white"]); d = ImageDraw.Draw(im)
    tone = TONE[it["color"]]; o = 16
    d.rounded_rectangle([o + 26, o + h // 2 - 36, o + 26 + lw, o + h // 2 + 36], radius=18, fill=tone[0])
    lab = ink(it["label"], 46, 800, (255, 255, 255))
    im.alpha_composite(lab, (o + 26 + (lw - lab.width) // 2, o + h // 2 - lab.height // 2 - 3)); im.alpha_composite(t, (o + lw + 56, o + (h - t.height) // 2 - 4)); return im

def r_brand(it):
    t = ink(it["text"], 50, 800, CREAM); w, h = t.width + 70, t.height + 30
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); ImageDraw.Draw(im).rounded_rectangle([0, 0, w - 1, h - 1], radius=h // 2, fill=MAROON, outline=GOLD_B, width=3)
    im.alpha_composite(t, (30, (h - t.height) // 2 - 3)); return im

# ---------------------------------------------------------------- animated stage (kind "stage")
# A scene card whose actors move with the voice: {"kind":"stage","h":540,"road":true,"cast":[actor, ...]}.
# Actor: {"who", "at", "dt"?, "x", "y" (bottom-centre, card coords), "s"? scale, "from"? [x,y] slide in over "move" s,
#         "go"? {"at","dt"?,"x","y","move"?}, "out"? sentence index (+"out_dt") fade, "shake"? [at, dt]}
# who: kru villager (pose, flip) · van car pcar building money · emoji (e) · bubble (text, tail l/r) · pill (text, color)
#      badge (ok) · burst (text) · arrow (x2, y2, color) · counter (n, suffix, color)
import lib
STAGE_COL = {"red": (0xD9, 0x30, 0x3E), "green": (0x1E, 0x8E, 0x4E), "maroon": MAROON, "gold": GOLD, "blue": (0x2F, 0x80, 0xED)}

def _scaled(im, s): return im if abs(s - 1) < 0.01 else im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)

def _pillimg(t, color, size=44):
    fg = CREAM if color != "white" else NAVY; bg = STAGE_COL.get(color, (255, 255, 255))
    ti = ink(t, size, 800, fg); w, h = ti.width + 50, ti.height + 16
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); ImageDraw.Draw(im).rounded_rectangle([0, 0, w - 1, h - 1], radius=h // 2, fill=bg, outline=CREAM, width=3)
    im.alpha_composite(ti, (25, (h - ti.height) // 2 - 2)); return im

@lru_cache(None)
def gov_building():
    """หน่วยงานของรัฐ in the SOBPREP palette (lib.building's cream roof vanishes on the cream stage)."""
    w, h = 330, 330; im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.polygon([(10, 110), (w // 2, 20), (w - 10, 110)], fill=MAROON); d.line([(10, 110), (w - 10, 110)], fill=GOLD_B, width=6)
    d.rectangle([30, 116, w - 30, h - 40], fill=(0xF4, 0xE6, 0xD2), outline=(0xD9, 0xC6, 0xA6), width=3)
    for x in (56, 126, 196, 266): d.rectangle([x - 14, 190, x + 14, h - 46], fill=(0xE2, 0xCF, 0xB2))
    d.rectangle([12, h - 40, w - 12, h - 12], fill=(0xC9, 0xB2, 0x8E))
    lab = _pillimg("หน่วยงานรัฐ", "maroon", 34); im.alpha_composite(lab, ((w - lab.width) // 2, 126))
    return im

@lru_cache(256)
def actor_img(key):
    a = json.loads(key); w = a["who"]; s = a.get("s", 1.0)
    if w == "kru": return sprite(a.get("pose", "teacher-happy"), int(250 * s))
    if w == "villager": return lib.villager(a.get("pose", "none-sad"), int(250 * s), a.get("flip", False))
    if w == "building": return _scaled(gov_building(), s)
    if w in ("van", "car", "pcar", "money"):
        im = {"van": lib.van, "car": lib.car, "pcar": lib.suitcase_car, "money": lib.moneybag}[w]()
        if a.get("flip"): im = im.transpose(Image.FLIP_LEFT_RIGHT)
        return _scaled(im, s * {"van": .72, "car": .72, "pcar": .72, "building": .62, "money": .45}[w])
    if w == "emoji": return emoji(a["e"], int(120 * s))
    if w == "badge": return lib.icon_badge(a.get("ok", False), int(100 * s))
    if w == "pill": return _pillimg(a["text"], a.get("color", "maroon"), int(44 * s))
    if w == "burst":
        r = int(120 * s); im = Image.new("RGBA", (2 * r + 10, 2 * r + 10), (0, 0, 0, 0))
        lib.burst(im, r + 5, r + 5, r, (0xFF, 0xD4, 0x3B)); lib.burst(im, r + 5, r + 5, int(r * .7), (0xFF, 0xF4, 0xB0))
        ti = ink(a.get("text", "ปัง!"), int(48 * s), 800, MAROON_D); im.alpha_composite(ti, (r + 5 - ti.width // 2, r + 5 - ti.height // 2 - 4))
        return im
    if w == "bubble":
        body = lines_img(a["text"], int(40 * s)); bw, bh = body.width + 48, body.height + 34
        im = Image.new("RGBA", (bw + 8, bh + 40), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        tx = 40 if a.get("tail", "l") == "l" else bw - 60
        d.polygon([(tx, bh - 4), (tx + 34, bh - 4), (tx + (0 if a.get("tail", "l") == "l" else 34), bh + 34)], fill=MAROON)
        d.rounded_rectangle([0, 0, bw, bh], radius=26, fill=(255, 255, 255), outline=MAROON, width=4)
        d.polygon([(tx + 5, bh - 6), (tx + 29, bh - 6), (tx + (5 if a.get("tail", "l") == "l" else 29), bh + 22)], fill=(255, 255, 255))
        im.alpha_composite(body, (24, 14)); return im
    raise KeyError(w)

def put(canvas, img, cx, cy, scale=1.0, alpha=1.0):
    """paste() that clips at the canvas edge (actors slide in from off-card)."""
    if scale <= 0.01 or alpha <= 0.01: return
    im = img if abs(scale - 1) < 0.01 else img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.BILINEAR)
    if alpha < 0.99: im = im.copy(); im.putalpha(im.getchannel("A").point(lambda v: int(v * alpha)))
    x, y = int(cx - im.width / 2), int(cy - im.height / 2)
    l, t = max(0, -x), max(0, -y); r, b = min(im.width, canvas.width - x), min(im.height, canvas.height - y)
    if r > l and b > t: canvas.alpha_composite(im.crop((l, t, r, b)), (x + l, y + t))

@lru_cache(8)
def stage_bg(h, road):
    im = sticker(CONTENT_W, h, (0xFF, 0xFD, 0xF8)); d = ImageDraw.Draw(im); o = 16
    gy = o + h - 110
    if road:
        d.rectangle([o + 12, gy, o + CONTENT_W - 2, o + h - 22], fill=(0x9A, 0x93, 0x8E))
        for x in range(o + 40, o + CONTENT_W - 40, 110): d.rectangle([x, gy + 40, x + 60, gy + 48], fill=(0xFF, 0xF4, 0xD0))
    else:
        d.rectangle([o + 12, gy, o + CONTENT_W - 2, o + h - 22], fill=(0xEE, 0xE2, 0xD3))
    return im

def stage_frame(it, t, P):
    c = stage_bg(it.get("h", 540), bool(it.get("road"))).copy(); o = 16
    for a in it["cast"]:
        t_in = P(a["at"]) + a.get("dt", 0)
        if t < t_in: continue
        if "out" in a:
            al = 1 - prog(t, P(a["out"]) + a.get("out_dt", 0), 0.25)
            if al <= 0: continue
        else: al = 1.0
        x, y, sc = a.get("x", 0), a.get("y", 0), 1.0
        if "from" in a:
            k = ease_in_out(prog(t, t_in, a.get("move", 1.0))); x = a["from"][0] + (x - a["from"][0]) * k; y = a["from"][1] + (y - a["from"][1]) * k
        else: sc = back_out(prog(t, t_in, 0.35))
        if "go" in a:
            g = a["go"]; k = ease_in_out(prog(t, P(g["at"]) + g.get("dt", 0), g.get("move", 0.8))); x += (g.get("x", x) - x) * k; y += (g.get("y", y) - y) * k
        if "shake" in a:
            p = prog(t, P(a["shake"][0]) + a["shake"][1], 0.6)
            if 0 < p < 1: x += math.sin(t * 70) * 12 * (1 - p)
        w = a["who"]
        if w in ("kru", "villager"): y += math.sin(t * 3 + x / 90) * 5
        if w == "arrow":
            p = ease_out(prog(t, t_in, 0.45)); col = (*STAGE_COL.get(a.get("color", "maroon")), int(255 * al))
            lib.arrow(c, (o + x, o + y), (o + a["x2"], o + a["y2"]), col, 14, p); continue
        if w == "counter":
            n = int(round(a["n"] * ease_out(prog(t, t_in, a.get("move", 1.2)))))
            im = _pillimg(f"{a.get('prefix', '')}{n}{a.get('suffix', '')}", a.get("color", "maroon"), int(56 * a.get("s", 1)))
            put(c, im, o + x, o + y - im.height / 2, back_out(prog(t, t_in, 0.35)), al); continue
        im = actor_img(json.dumps({k: v for k, v in a.items() if k in ("who", "pose", "flip", "s", "e", "ok", "text", "color", "tail")}, sort_keys=True, ensure_ascii=False))
        put(c, im, o + x, o + y - im.height * sc / 2, sc, al)
    return c

RENDER = {"card": r_card, "num": r_num, "no": lambda i: r_flag(i, False), "ok": lambda i: r_flag(i, True), "tags": r_tags,
          "flow": r_flow, "row": r_row, "brand": r_brand, "stage": lambda i: stage_bg(i.get("h", 540), bool(i.get("road")))}

def layout(page):
    """Images and y positions for every item, stacked from TOP; shrinks the gap if the page is tall."""
    imgs = [RENDER[it["kind"]](it) for it in page["items"]]
    total = sum(i.height for i in imgs); gap = max(18, min(40, (1330 - TOP - total) // max(1, len(imgs) - 1)))
    ys, y = [], TOP
    for i in imgs: ys.append(y); y += i.height + gap
    scale = min(1.0, (1340 - TOP) / max(1, y - gap - TOP))
    return imgs, ys, scale

def header(c, page, t, t0):
    a = prog(t, t0, 0.3)
    if page.get("no"):
        d = ImageDraw.Draw(c); r = 36; cx, cy = MARGIN + r, 150
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=GOLD_B, outline=CREAM, width=4); n = ink(str(page["no"]), 44, 800, MAROON_D); c.alpha_composite(n, (cx - n.width // 2, cy - n.height // 2 - 3))
    title = page["title"]; size = 74
    while text_w(title, size, 800) > 740 and size > 50: size -= 4
    ti = ink(title, size, 800, CREAM); paste(c, ti, MARGIN + ti.width / 2, 262, 0.96 + 0.04 * ease_out(a), a)
    if page.get("icon"): paste(c, emoji(page["icon"], 84), 770, 140, back_out(prog(t, t0 + 0.1, 0.4)))
    paste(c, sprite("teacher-happy", 230), 925, 215 + math.sin(t * 3) * 5)

def draw_page(c, page, t, P):
    t0 = page["_t"][0]; header(c, page, t, t0)
    imgs, ys, s = page["_lay"]
    for it, im, y in zip(page["items"], imgs, ys):
        ta = P(it["at"]) + 0.12 * sum(1 for j in page["items"][:page["items"].index(it)] if j["at"] == it["at"])
        if t < ta: continue
        p = prog(t, ta, 0.28); k = 0.9 + 0.1 * back_out(p)
        if it["kind"] == "stage": im = stage_frame(it, t, P)
        im2 = im if s >= 0.999 else im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
        x = MARGIN + im2.width / 2; yy = TOP + (y - TOP) * s + im2.height / 2 + (1 - ease_out(p)) * 24
        paste(c, im2, x, yy, k, min(1, p * 1.6))

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("sb"); ap.add_argument("out")
    ap.add_argument("--voice", default="Charon"); ap.add_argument("--model", default="gemini-3.8-flash-tts"); ap.add_argument("--still", type=float)
    a = ap.parse_args()
    sb = json.load(open(a.sb, encoding="utf8"))
    scenes = [{"type": "page", "say": p["say"]} for p in sb["pages"]]
    cache = os.path.join(HERE, ".cache", "tts"); os.makedirs(cache, exist_ok=True)
    voice, times, dur = story.build_audio({"scenes": scenes}, a.voice, a.model, cache)
    for p, s in zip(sb["pages"], scenes): p["_t"] = s["_t"]; p["_lay"] = layout(p)
    subs = story.make_subs({"scenes": scenes}, times)
    starts = [p["_t"][0] for p in sb["pages"]]
    def frame(t):
        c = paper().copy()
        k = max(0, max((i for i, s in enumerate(starts) if s - 0.15 <= t), default=0)); page = sb["pages"][k]
        P = lambda pi: times[(k, min(pi, len(page["say"]) - 1))][0]
        draw_page(c, page, t, P)
        f = prog(t, starts[k] - 0.15, 0.2)
        if f < 1 and k > 0: c.alpha_composite(Image.new("RGBA", (W, H), (*PAPER, int(255 * (1 - f)))))
        cur = [s for s in subs if s[0] - 0.05 <= t < s[1]]
        if cur:
            g = cur[-1][2]; imgs = [text_img(l, 44, 700, CREAM) for l in g]
            bw = max(i.width for i in imgs) + 50; bh = 60 * len(imgs) + 30; y0 = 1420
            box = Image.new("RGBA", (bw, bh), (0, 0, 0, 0)); ImageDraw.Draw(box).rounded_rectangle([0, 0, bw - 1, bh - 1], radius=24, fill=(*MAROON_D, 235))
            c.alpha_composite(box, (int(500 - bw / 2), y0)); y = y0 + 12
            for im in imgs: c.alpha_composite(im, (int(500 - im.width / 2), y - 8)); y += 60
        return c.convert("RGB")
    if a.still is not None: frame(a.still).save(a.out); print(dur); return
    mix = np.clip(voice / (np.abs(voice).max() or 1) * 0.9, -1, 1).astype(np.float32)
    wav = a.out.rsplit(".", 1)[0] + ".wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(story.SR), "-ac", "1", "-i", "-", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", wav], input=mix.tobytes(), check=True)
    ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", "30", "-i", "-", "-i", wav,
                           "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", a.out], stdin=subprocess.PIPE)
    for i in range(int(dur * 30)): ff.stdin.write(frame(i / 30).tobytes())
    ff.stdin.close(); ff.wait(); print(f"{a.out}: {dur:.1f}s")

if __name__ == "__main__": main()
