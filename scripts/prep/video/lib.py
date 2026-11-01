# Small motion-graphics kit for the SOBPREP explainer: brand background, Thai text, mascot sprites, drawn props.
import math, os, re, colorsys
from functools import lru_cache
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1920
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
CACHE = os.path.join(HERE, ".cache")   # fonts, TTS cache, media secret (setup.sh fills it; gitignored)
CREAM, GOLD, INK, MUTED = (0xFF, 0xF8, 0xEC), (0xF1, 0xD5, 0x7A), (0x6E, 0x14, 0x23), (0xF3, 0xD9, 0xDD)
GREEN, RED, MAROON = (0x22, 0x9A, 0x55), (0xE0, 0x3A, 0x3A), (0xA8, 0x24, 0x38)

TH = {w: f"{CACHE}/fonts/prompt-{w}.ttf" for w in (600, 700, 800)}
LA = {600: "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf", 700: "/usr/share/fonts/opentype/inter/Inter-Bold.otf",
      800: "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"}

# ---------- easing ----------
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def ease_out(x): x = clamp(x); return 1 - (1 - x) ** 3
def ease_in_out(x): x = clamp(x); return 3 * x * x - 2 * x * x * x
def back_out(x):  # overshoot pop
    x = clamp(x); c1 = 1.70158; c3 = c1 + 1
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2
def prog(t, a, d): return clamp((t - a) / d) if d > 0 else (1.0 if t >= a else 0.0)

# ---------- background ----------
@lru_cache(None)
def background():
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    t = np.clip(np.hypot(x - W * 0.5, y - H * 0.32) / (W * 1.3), 0, 1)[..., None]
    c0, c1 = np.array([0xA8, 0x24, 0x38], np.float32), np.array([0x3E, 0x08, 0x12], np.float32)
    rgb = (c0 + (c1 - c0) * t).astype(np.uint8)
    im = Image.fromarray(rgb, "RGB").convert("RGBA")
    d = ImageDraw.Draw(im)
    d.rectangle([0, 1240, W, H], fill=(0x2E, 0x06, 0x0E, 255))  # ground strip under the stage
    d.line([(0, 1240), (W, 1240)], fill=(*GOLD, 255), width=4)
    return im

# ---------- text ----------
def _runs(t): return re.findall(r"[฀-๿]+[\s]*|[^฀-๿]+", t)
@lru_cache(None)
def _font(thai, size, w): return ImageFont.truetype(TH[w] if thai else LA[w], size)
def _f(r, size, w): return _font(bool(re.match(r"[฀-๿]", r)), size, w)
def text_w(t, size, w=700):
    d = ImageDraw.Draw(Image.new("L", (1, 1)))
    return sum(d.textlength(r, font=_f(r, size, w)) for r in _runs(t))

@lru_cache(4096)
def text_img(t, size, w=700, fill=CREAM, stroke=0, stroke_fill=(0, 0, 0)):
    tw = int(text_w(t, size, w)) + 2 * stroke + 8
    th = int(size * 1.9) + 2 * stroke
    im = Image.new("RGBA", (tw, th), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    x, base = stroke + 4, int(size * 1.35) + stroke
    for r in _runs(t):
        f = _f(r, size, w)
        d.text((x, base), r, font=f, fill=fill, anchor="ls", stroke_width=stroke, stroke_fill=stroke_fill)
        x += d.textlength(r, font=f)
    return im

def wrap(t, size, maxw, w=700):
    """Greedy wrap on Thai word boundaries (pythainlp newmm), spaces kept where the script has them."""
    from pythainlp.tokenize import word_tokenize
    toks = word_tokenize(t, engine="newmm", keep_whitespace=True)
    lines, cur = [], ""
    for tok in toks:
        cand = cur + tok
        if cur.strip() and text_w(cand.strip(), size, w) > maxw: lines.append(cur.strip()); cur = tok.lstrip()
        else: cur = cand
    if cur.strip(): lines.append(cur.strip())
    return lines

def paste(canvas, img, cx, cy, scale=1.0, alpha=1.0, rot=0.0):
    if scale <= 0.01 or alpha <= 0.01: return
    im = img
    if abs(scale - 1) > 0.01:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.BILINEAR)
    if rot: im = im.rotate(rot, resample=Image.BICUBIC, expand=True)
    if alpha < 0.99:
        a = im.getchannel("A").point(lambda v: int(v * alpha)); im = im.copy(); im.putalpha(a)
    canvas.alpha_composite(im, (int(cx - im.width / 2), int(cy - im.height / 2)))

# ---------- sprites ----------
def _hue(im, shift):
    a = np.asarray(im).astype(np.float32) / 255
    rgb, al = a[..., :3], a[..., 3:]
    mx, mn = rgb.max(-1), rgb.min(-1)
    import colorsys as _c
    hsv = np.zeros_like(rgb)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    v = mx; s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    dlt = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, (g - b) / dlt % 6, np.where(mx == g, (b - r) / dlt + 2, (r - g) / dlt + 4)) / 6
    h = np.where(mx == mn, 0, h)
    # shift only the red/orange body, keep the yellow face and skin
    body = (h < 0.07) | (h > 0.93)
    h = np.where(body, (h + shift) % 1, h)
    i = np.floor(h * 6); f = h * 6 - i; p = v * (1 - s); q = v * (1 - f * s); tt = v * (1 - (1 - f) * s)
    i = i.astype(int) % 6
    out = np.select([i[..., None] == k for k in range(6)],
                    [np.stack(x, -1) for x in [(v, tt, p), (q, v, p), (p, v, tt), (p, q, v), (tt, p, v), (v, p, q)]])
    return Image.fromarray((np.concatenate([out, al], -1) * 255).astype(np.uint8), "RGBA")

@lru_cache(None)
def sprite(name, size, hue=0.0, flip=False):
    im = Image.open(f"{REPO}/src/prep/mascot/{name}.webp").convert("RGBA")
    im.paste((0, 0, 0, 0), (0, 0, 60, 60))  # stray dot in some source files
    im = im.crop(im.getbbox())
    if hue: im = _hue(im, hue)
    if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    return im.resize((int(im.width * size / im.height), size), Image.LANCZOS)

KRU = "teacher-happy"          # ครูไฟ
def villager(mood="none-sad", size=300, flip=False): return sprite(mood, size, 0.55, flip)  # blue flame = ชาวบ้าน

# ---------- props (drawn once, cached) ----------
def _shadow(im, blur=10, off=(0, 14), op=90):
    a = im.getchannel("A").point(lambda v: op if v > 0 else 0)
    sh = Image.new("RGBA", (im.width + 60, im.height + 60), (0, 0, 0, 0))
    sh.paste((10, 0, 4, 255), (30 + off[0], 30 + off[1]), a)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    sh.alpha_composite(im, (30, 30)); return sh

def _wheel(d, cx, cy, r):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(30, 30, 34)); d.ellipse([cx - r * .45, cy - r * .45, cx + r * .45, cy + r * .45], fill=(190, 190, 196))

@lru_cache(None)
def van():  # รถตู้โรงเรียน, facing right
    im = Image.new("RGBA", (520, 300), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([10, 40, 500, 240], radius=40, fill=(0xF6, 0xC8, 0x3C))
    d.rounded_rectangle([10, 170, 500, 240], radius=30, fill=(0xA8, 0x24, 0x38))
    for x in (50, 160, 270): d.rounded_rectangle([x, 70, x + 90, 140], radius=14, fill=(0xBF, 0xE6, 0xF7))
    d.polygon([(390, 70), (470, 70), (495, 150), (390, 150)], fill=(0xBF, 0xE6, 0xF7))
    d.rectangle([480, 185, 505, 205], fill=(255, 240, 160))
    im.alpha_composite(text_img("รถโรงเรียน", 34, 800, CREAM), (150, 160))
    _wheel(d, 120, 245, 45); _wheel(d, 400, 245, 45)
    return _shadow(im)

@lru_cache(None)
def car(color=(0x3B, 0x7D, 0xD8), label=""):  # รถเก๋ง, facing left
    im = Image.new("RGBA", (460, 240), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([10, 100, 450, 200], radius=36, fill=color)
    d.polygon([(110, 105), (160, 30), (330, 30), (390, 105)], fill=color)
    d.polygon([(135, 100), (175, 45), (245, 45), (245, 100)], fill=(0xBF, 0xE6, 0xF7))
    d.polygon([(260, 100), (260, 45), (320, 45), (365, 100)], fill=(0xBF, 0xE6, 0xF7))
    d.rectangle([5, 130, 30, 150], fill=(255, 240, 160))
    _wheel(d, 110, 200, 40); _wheel(d, 350, 200, 40)
    if label: im.alpha_composite(text_img(label, 30, 800, CREAM), (170, 115))
    return _shadow(im)

@lru_cache(None)
def building():  # หน่วยงานของรัฐ
    im = Image.new("RGBA", (460, 520), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.polygon([(20, 150), (230, 40), (440, 150)], fill=CREAM)
    d.rectangle([40, 150, 420, 470], fill=(0xF4, 0xEA, 0xDA))
    for x in (70, 160, 250, 340): d.rectangle([x, 190, x + 50, 420], fill=(0xE2, 0xD3, 0xBC))
    d.rectangle([20, 460, 440, 500], fill=(0xD9, 0xC6, 0xA6))
    d.line([(230, 40), (230, 0)], fill=(80, 80, 80), width=5)
    for i, c in enumerate([(0xD0, 0x1E, 0x2E), (255, 255, 255), (0x2D, 0x2A, 0x6E), (255, 255, 255), (0xD0, 0x1E, 0x2E)]):
        d.rectangle([232, 2 + i * 7, 292, 9 + i * 7], fill=c)
    lab = text_img("หน่วยงานของรัฐ", 32, 800, INK)
    im.alpha_composite(lab, (230 - lab.width // 2, 75))
    return _shadow(im)

@lru_cache(None)
def moneybag():
    im = Image.new("RGBA", (220, 240), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse([20, 70, 200, 235], fill=(0xE3, 0xB8, 0x4C)); d.polygon([(80, 80), (60, 25), (160, 25), (140, 80)], fill=(0xE3, 0xB8, 0x4C))
    d.rectangle([70, 70, 150, 85], fill=(0x8A, 0x5A, 0x1A))
    im.alpha_composite(text_img("฿", 90, 800, (0x6B, 0x45, 0x10)), (78, 70))
    return _shadow(im, 8, (0, 8))

@lru_cache(None)
def tree(cut=False):
    im = Image.new("RGBA", (320, 460), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle([140, 230, 180, 450], fill=(0x7A, 0x4B, 0x2A))
    for (x, y, r) in [(160, 150, 120), (90, 200, 80), (230, 200, 80), (160, 80, 80)]:
        d.ellipse([x - r, y - r, x + r, y + r], fill=(0x3F, 0x9E, 0x4D))
    return im

@lru_cache(None)
def fence(broken=False):
    im = Image.new("RGBA", (420, 200), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for i, x in enumerate(range(10, 410, 60)):
        if broken and i in (2, 3, 4): d.polygon([(x, 190), (x + 30, 190), (x + 70, 120), (x + 40, 110)], fill=(0xC9, 0xA2, 0x7E))
        else: d.polygon([(x, 190), (x, 40), (x + 18, 15), (x + 36, 40), (x + 36, 190)], fill=(0xEC, 0xD9, 0xC0))
    if not broken: d.rectangle([0, 80, 420, 100], fill=(0xD9, 0xC0, 0x9E)); d.rectangle([0, 140, 420, 160], fill=(0xD9, 0xC0, 0x9E))
    return im

@lru_cache(None)
def traffic_light(red=True):
    im = Image.new("RGBA", (120, 420), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle([52, 220, 68, 420], fill=(60, 60, 64)); d.rounded_rectangle([10, 10, 110, 240], radius=24, fill=(40, 40, 44))
    for i, (c, on) in enumerate([((0xFF, 0x3B, 0x3B), red), ((0xFF, 0xC8, 0x2E), False), ((0x2E, 0xD0, 0x6B), not red)]):
        d.ellipse([28, 25 + i * 70, 92, 89 + i * 70], fill=c if on else tuple(v // 4 for v in c))
    return im

@lru_cache(None)
def parcel():
    im = Image.new("RGBA", (200, 170), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle([10, 30, 190, 160], fill=(0xC8, 0x8E, 0x55)); d.polygon([(10, 30), (40, 5), (220, 5), (190, 30)], fill=(0xDB, 0xA6, 0x6E))
    d.rectangle([90, 30, 110, 160], fill=(0xE9, 0xD3, 0xA8))
    im.alpha_composite(text_img("ขายของ", 30, 800, INK), (40, 75))
    return im

@lru_cache(None)
def suitcase_car():  # รถส่วนตัวไปเที่ยว
    base = car((0x2E, 0xA8, 0x8E)).copy(); d = ImageDraw.Draw(base)
    d.rounded_rectangle([200, 30, 330, 70], radius=10, fill=(0xE0, 0x6C, 0x3C)); d.rectangle([255, 18, 275, 32], fill=(0x70, 0x30, 0x10))
    return base

def icon_badge(ok, size=120):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse([0, 0, size - 1, size - 1], fill=GREEN if ok else RED); w = size // 9
    if ok: d.line([(size * .26, size * .52), (size * .44, size * .70), (size * .76, size * .32)], fill="white", width=w, joint="curve")
    else:
        d.line([(size * .3, size * .3), (size * .7, size * .7)], fill="white", width=w); d.line([(size * .7, size * .3), (size * .3, size * .7)], fill="white", width=w)
    return im

def pill(t, size=46, fg=INK, bg=GOLD, w=800, pad=34):
    ti = text_img(t, size, w, fg)
    im = Image.new("RGBA", (ti.width + pad * 2, int(size * 1.9)), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=im.height // 2, fill=bg)
    im.alpha_composite(ti, (pad, (im.height - ti.height) // 2 + 2)); return im

def card(t_lines, size=46, w=700, fg=INK, bg=CREAM, pad=36, width=None, line_gap=1.45):
    imgs = [text_img(l, size, w, fg) for l in t_lines]
    cw = width or max(i.width for i in imgs) + pad * 2
    ch = int(len(imgs) * size * line_gap + pad * 1.6)
    im = Image.new("RGBA", (cw, ch), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, cw - 1, ch - 1], radius=34, fill=bg)
    y = int(pad * 0.55)
    for i in imgs: im.alpha_composite(i, (pad, y)); y += int(size * line_gap)
    return im

def arrow(canvas, p0, p1, color, width=16, prog_=1.0):
    d = ImageDraw.Draw(canvas)
    x0, y0 = p0; x1 = x0 + (p1[0] - x0) * prog_; y1 = y0 + (p1[1] - y0) * prog_
    d.line([(x0, y0), (x1, y1)], fill=color, width=width)
    if prog_ > 0.3:
        a = math.atan2(y1 - y0, x1 - x0); L = width * 2.6
        d.polygon([(x1 + math.cos(a) * L * .4, y1 + math.sin(a) * L * .4),
                   (x1 - math.cos(a - .5) * L, y1 - math.sin(a - .5) * L),
                   (x1 - math.cos(a + .5) * L, y1 - math.sin(a + .5) * L)], fill=color)

def burst(canvas, cx, cy, r, color=(255, 230, 120), n=12, alpha=255):
    d = ImageDraw.Draw(canvas); pts = []
    for i in range(n * 2):
        a = math.pi * i / n; rr = r if i % 2 == 0 else r * 0.55
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    d.polygon(pts, fill=(*color, alpha))

# Subtitle chunks: up to two balanced lines each, never splitting the law terms below.
KEEP = ["พ.ร.บ.ความรับผิดทางละเมิดของเจ้าหน้าที่", "ความรับผิดทางละเมิด", "หน่วยงานของรัฐ", "ประมาทเลินเล่ออย่างร้ายแรง",
        "ผู้บังคับบัญชา", "เจ้าหน้าที่", "ไม่ได้ครับ", "ไล่เบี้ย", "ค่าสินไหม", "นอกเวลาราชการ", "เฉพาะตัว", "ปฏิบัติหน้าที่",
        "คอมเมนต์ปักหมุด", "ไม่ใช่", "ฟ้องตัวครู", "ครูไฟ", "รถโรงเรียน", "ชาวบ้าน", "SOBPREP"]
def _tokens(t):
    from pythainlp.tokenize import word_tokenize
    from pythainlp.corpus.common import thai_words
    from pythainlp.util import Trie
    global _TRIE
    try: _TRIE
    except NameError: _TRIE = Trie(set(thai_words()) | set(KEEP))
    return word_tokenize(t, custom_dict=_TRIE, engine="newmm", keep_whitespace=True)

def sub_chunks(t, size=50, maxw=800, w=700):
    toks = _tokens(t); chunks, cur = [], []
    for tok in toks:  # greedy: a chunk holds what fits on two lines
        if cur and text_w("".join(cur + [tok]).strip(), size, w) > maxw * 1.9: chunks.append(cur); cur = [tok.lstrip()]
        else: cur.append(tok)
    if cur: chunks.append(cur)
    out = []
    for c in chunks:
        s = "".join(c).strip()
        if text_w(s, size, w) <= maxw: out.append([s]); continue
        best = None  # split where the two lines are closest in width
        for k in range(1, len(c)):
            a, b = "".join(c[:k]).strip(), "".join(c[k:]).strip()
            if not a or not b: continue
            wa, wb = text_w(a, size, w), text_w(b, size, w)
            over = max(0, max(wa, wb) - maxw)
            score = abs(wa - wb) + over * 10 - (140 if c[k - 1].isspace() or c[k].isspace() else 0)
            if best is None or score < best[0]: best = (score, a, b)
        out.append([best[1], best[2]] if best else [s])
    return out
