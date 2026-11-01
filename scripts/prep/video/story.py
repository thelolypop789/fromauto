# Summary clip from a storyboard JSON: Gemini TTS per phrase (cached) → timeline → animated scenes → mp4.
# Usage: story.py <storyboard.json> <out.mp4> [--voice Kore] [--model gemini-2.5-flash-preview-tts]
import sys, os, json, math, hashlib, base64, subprocess, urllib.request, argparse
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lib import *                      # background, text, sprites, props, easing
from lib import sub_chunks

FPS, SR = 30, 24000
SPEED = 1.12
FN = "https://diprxrkddsqmzzihjjwi.supabase.co/functions/v1/prep-media"
STYLE = "Say cheerfully and energetically, like a friendly Thai exam tutor: "

# ---------------------------------------------------------------- voice
def tts(text, voice, model, cache):
    key = hashlib.sha1(f"{model}|{voice}|{STYLE}|{text}".encode()).hexdigest()[:16]
    path = os.path.join(cache, key + ".pcm")
    if not os.path.exists(path):
        sec = open(os.path.join(HERE, ".cache", "media_secret")).read().strip()
        body = {"action": "tts", "text": (STYLE + text) if "2.5" in model else text, "voice": voice, "model": model}
        import time
        for attempt in range(8):   # the preview TTS model is rate limited: back off on 429
            try:
                req = urllib.request.Request(FN, method="POST", data=json.dumps(body).encode(),
                                             headers={"x-media-secret": sec, "Content-Type": "application/json"})
                d = json.load(urllib.request.urlopen(req, timeout=180)); break
            except urllib.error.HTTPError as e:
                if attempt == 7 or e.code not in (429, 500, 502, 503) or (e.code == 502 and attempt >= 1): raise
                print(f"  TTS {e.code}, waiting…", flush=True); time.sleep(15 * (attempt + 1))
        pcm = np.frombuffer(base64.b64decode(d["pcm"]), dtype=np.int16).astype(np.float32) / 32768
        if d["rate"] != SR: raise SystemExit(f"unexpected rate {d['rate']}")
        # trim leading/trailing silence so phrases butt together tightly
        a = np.abs(pcm); thr = 0.01; idx = np.where(a > thr)[0]
        if len(idx): pcm = pcm[max(0, idx[0] - int(0.03 * SR)): idx[-1] + int(0.06 * SR)]
        pcm.astype(np.float32).tofile(path)
    return np.fromfile(path, dtype=np.float32)

def clean(x):
    """Gemini TTS ends each line with ~0.1 s of loud noise after the speech has gone quiet. Drop any short, noise-like
    tail (or head) that follows/precedes a quiet gap, trim the silence, and fade the edges so lines join smoothly."""
    f = int(0.02 * SR); n = len(x) // f
    if n < 6: return x
    fr = x[:n * f].reshape(n, f)
    db = 20 * np.log10(np.sqrt((fr ** 2).mean(1)) + 1e-9)
    zc = (np.abs(np.diff(np.sign(fr), axis=1)) / 2).mean(1)
    quiet = db < -45
    def burst_end():  # index where speech really ends
        i = n
        while i > 0 and not quiet[i - 1]: i -= 1          # the loud run at the very end
        run = n - i
        j = i
        while j > 0 and quiet[j - 1]: j -= 1              # the quiet gap before it
        if 0 < run <= 18 and i - j >= 4 and zc[i:].mean() > 0.08: return j
        return n
    def burst_start():
        i = 0
        while i < n and not quiet[i]: i += 1
        run = i; j = i
        while j < n and quiet[j]: j += 1
        if 0 < run <= 18 and j - i >= 4 and zc[:i].mean() > 0.08: return j
        return 0
    a, b = burst_start(), burst_end()
    y = x[a * f: b * f]
    idx = np.where(np.abs(y) > 0.01)[0]
    if len(idx): y = y[max(0, idx[0] - int(0.02 * SR)): idx[-1] + int(0.08 * SR)]
    y = y.copy(); fi, fo = int(0.012 * SR), int(0.04 * SR)
    if len(y) > fi + fo: y[:fi] *= np.linspace(0, 1, fi); y[-fo:] *= np.linspace(1, 0, fo)
    return y

def build_audio(sb, voice, model, cache):
    jobs = [(si, pi, t) for si, sc in enumerate(sb["scenes"]) for pi, t in enumerate(sc["say"])]
    with ThreadPoolExecutor(1) as ex:
        clips = [clean(c) for c in ex.map(lambda j: tts(j[2], voice, model, cache), jobs)]
    out, t, times = [np.zeros(int(0.35 * SR), np.float32)], 0.35, {}
    k = 0
    for si, sc in enumerate(sb["scenes"]):
        sc_start = t
        for pi, txt in enumerate(sc["say"]):
            c = clips[k]; k += 1
            times[(si, pi)] = (t, t + len(c) / SR)
            out.append(c); t += len(c) / SR
            gap = 0.22 if pi < len(sc["say"]) - 1 else 0.45
            if sc["type"] == "quiz" and pi == len(sc["say"]) - 2: gap = 1.6   # thinking time before the answer
            out.append(np.zeros(int(gap * SR), np.float32)); t += gap
        sc["_t"] = (sc_start, t)
    out.append(np.zeros(int(1.0 * SR), np.float32)); t += 1.0
    voice = np.concatenate(out)
    if SPEED != 1.0:  # TTS reads slower than a person; speed up without changing pitch, and scale every time
        r = subprocess.run(["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-af", f"atempo={SPEED}",
                            "-f", "f32le", "-"], input=voice.astype(np.float32).tobytes(), capture_output=True, check=True)
        voice = np.frombuffer(r.stdout, dtype=np.float32).copy()
        times = {k: (a / SPEED, b / SPEED) for k, (a, b) in times.items()}
        for sc in sb["scenes"]: sc["_t"] = (sc["_t"][0] / SPEED, sc["_t"][1] / SPEED)
        t = len(voice) / SR
    return voice, times, t

# ---------------------------------------------------------------- drawing helpers
def pop(c, img, x, y, t0, t, scale=1.0, d=0.35, out=None):
    if t < t0: return
    a = 1.0 if out is None else 1 - prog(t, out, 0.25)
    paste(c, img, x, y, back_out(prog(t, t0, d)) * scale, a)

def bob(t, amp=6, f=1.5, ph=0.0): return math.sin((t + ph) * f * 2 * math.pi) * amp

COLORS = {"red": (CREAM, RED), "cream": (INK, CREAM), "gold": (INK, GOLD), "green": (CREAM, GREEN)}

@lru_cache(None)
def prop_img(name):
    if name == "ring":
        im = Image.new("RGBA", (220, 220), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.ellipse([30, 70, 190, 210], outline=(0xE8, 0xC2, 0x4A), width=22); d.polygon([(110, 10), (150, 60), (110, 90), (70, 60)], fill=(0xBF, 0xE6, 0xF7))
        return im
    if name == "bowl":
        im = Image.new("RGBA", (220, 120), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.pieslice([10, -90, 210, 110], 0, 180, fill=(0x9A, 0x6B, 0x3F)); d.ellipse([60, 10, 90, 30], fill=GOLD); d.ellipse([110, 18, 140, 38], fill=GOLD)
        return im
    if name == "phone":
        im = Image.new("RGBA", (300, 520), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.rounded_rectangle([0, 0, 299, 519], radius=40, fill=(30, 30, 36)); d.rounded_rectangle([16, 40, 283, 480], radius=18, fill=(250, 250, 252))
        d.rectangle([36, 70, 263, 250], fill=(0xC9, 0xD8, 0xE8)); paste(im, sprite("none-sad", 150, 0.3), 150, 165)
        im.alpha_composite(text_img("ด.ช.ไฟน้อย ป.5", 30, 800, INK), (40, 270)); im.alpha_composite(text_img("โดนทำร้าย…", 28, 600, (90, 90, 90)), (40, 320))
        for i, c in enumerate([(0x2E, 0x7D, 0xF6), (0xE0, 0x3A, 0x3A)]): d.rounded_rectangle([40 + i * 120, 400, 140 + i * 120, 440], radius=20, fill=c)
        return im
    raise KeyError(name)

def actor(spec, t):
    w, pose = spec["who"], spec.get("pose")
    if w in ("kru", "parent", "police"): return sprite(pose, 330)
    if w == "kid": return sprite(pose, 230, 0.3)          # small, green flame = a pupil
    if w == "prop": return prop_img(pose)
    if w == "badge": return pill(spec["text"], 54, INK, GOLD)
    if w == "pill": fg, bg = COLORS[spec.get("bg", "gold")]; return pill(spec["text"], 50, fg, bg)
    if w == "bigq": return text_img("?", 240, 800, GOLD, 8, MAROON)
    if w == "cross": return icon_badge(False, 170)
    raise KeyError(w)

def heading(c, sc, t, T0):
    if sc.get("head"): pop(c, text_img(sc["head"], 68, 800, CREAM, 4, (60, 0, 10)), 540, 290, T0, t)
    if sc.get("head2"): pop(c, text_img(sc["head2"], 62, 800, GOLD, 4, (60, 0, 10)), 540, 385, T0 + 0.15, t)
    if sc.get("ref"): pop(c, pill(sc["ref"], 40, INK, GOLD), 540, 260, T0, t)

# ---------------------------------------------------------------- scenes
def sc_stage(c, sc, t, P):
    T0 = sc["_t"][0]; heading(c, sc, t, T0)
    shown = {}
    for s in sc["cast"]:   # later entries with the same role+position replace earlier ones (pose change)
        if t >= P(s["at"]): shown[(s["who"], s.get("x"), s.get("y"))] = s
    for s in sc["cast"]:
        key = (s["who"], s.get("x"), s.get("y"))
        if shown.get(key) is not s: continue
        img = actor(s, t); at = P(s["at"])
        dy = bob(t, 5, 1.3, s["x"] / 300) if s["who"] in ("kru", "kid", "parent", "police") else 0
        first = min(P(x["at"]) for x in sc["cast"] if (x["who"], x.get("x"), x.get("y")) == key)
        pop(c, img, s["x"], s["y"] + dy, first, t, 1.0)

def sc_rule(c, sc, t, P):
    T0 = sc["_t"][0]
    pop(c, pill(sc["ref"], 40, INK, GOLD), 540, 250, T0, t)
    pop(c, text_img(sc["head"], 66, 800, CREAM, 4, (60, 0, 10)), 540, 345, T0 + 0.1, t)
    y = 470
    for cd in sc["cards"]:
        tone = cd.get("tone")
        fg, bg = (CREAM, GREEN) if tone == "ok" else (INK, CREAM)
        im = card(cd["lines"], 62 if cd.get("big") else 50, 800, fg, bg, 40)
        pop(c, im, 540, y + im.height / 2, P(cd["at"]), t); y += im.height + 28
    if sc.get("trap"):
        pop(c, pill(sc["trap"]["text"], 42, CREAM, RED), 540, y + 50, P(sc["trap"]["at"]) + 0.4, t, 1 + 0.03 * math.sin(t * 8))
    for s in sc.get("cast", []):
        pop(c, actor(s, t), s["x"], s["y"] + bob(t, 5), P(s["at"]), t)
    if not sc.get("cast"): paste(c, sprite("teacher-cheer", 250), 880, 1120 + bob(t, 5))

def sc_list(c, sc, t, P):
    T0 = sc["_t"][0]
    pop(c, pill(sc["ref"], 40, INK, GOLD), 540, 250, T0, t)
    pop(c, text_img(sc["head"], 66, 800, CREAM, 4, (60, 0, 10)), 540, 345, T0 + 0.1, t)
    for k, it in enumerate(sc["items"]):
        y = 480 + k * 150
        im = card([f"{k + 1}. {it['t']}"], 52, 800, INK, CREAM, 36, width=800)
        pop(c, im, 500, y, P(it["at"]), t)
        if t >= P(it["at"]) + 0.3: pop(c, icon_badge(False, 90), 930, y, P(it["at"]) + 0.3, t)
    paste(c, sprite("bkk-sad", 230), 180, 1120 + bob(t, 4))

def sc_numbers(c, sc, t, P):
    T0 = sc["_t"][0]
    pop(c, text_img(sc["head"], 76, 800, GOLD, 4, (60, 0, 10)), 540, 300, T0, t)
    for k, r in enumerate(sc["rows"]):
        im = Image.new("RGBA", (900, 230), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.rounded_rectangle([0, 0, 899, 229], radius=36, fill=CREAM)
        im.alpha_composite(text_img(r["big"], 104, 800, MAROON), (36, -20)); im.alpha_composite(text_img(r["small"], 38, 700, INK), (36, 150))
        pop(c, im, 520, 520 + k * 260, P(r["at"]), t)
    if sc.get("memo"): pop(c, pill(sc["memo"]["text"], 46, INK, GOLD), 540, 1060, P(sc["memo"]["at"]), t, 1 + 0.03 * math.sin(t * 7))
    paste(c, sprite("teacher-cheer", 230), 900, 1140 + bob(t, 5))

def sc_quiz(c, sc, t, P):
    T0 = sc["_t"][0]
    pop(c, text_img(sc["head"], 80, 800, GOLD, 4, (60, 0, 10)), 540, 270, T0, t)
    pop(c, card(sc["q"], 50, 800, INK, CREAM, 36), 540, 430, P(sc["q_at"]), t)
    rev = P(sc["reveal_at"])
    for k, o in enumerate(sc["options"]):
        ok, after = k == sc["answer"], t >= rev
        bg = GREEN if (after and ok) else (0x5A, 0x10, 0x1C)
        im = card([f"{k + 1}   {o}"], 50, 800, CREAM, bg, 36, width=820)
        a = 0.35 if (after and not ok) else 1.0
        ta = P(sc["opts_at"] + k)   # each option appears as it is read
        if t >= ta: paste(c, im, 540, 610 + k * 140, back_out(prog(t, ta, 0.35)) * (1.05 if after and ok else 1), a)
    t_last = P(sc["opts_at"] + len(sc["options"]) - 1)
    if t_last + 1.0 <= t < rev:     # countdown bar during the thinking pause
        p = prog(t, t_last + 1.0, max(0.5, rev - t_last - 1.0))
        d = ImageDraw.Draw(c); d.rounded_rectangle([140, 1170, 940, 1196], radius=13, fill=(0x5A, 0x10, 0x1C)); d.rounded_rectangle([140, 1170, 140 + 800 * (1 - p), 1196], radius=13, fill=GOLD)
    if t >= rev: pop(c, sprite("teacher-cheer", 200), 920, 1110, rev, t)
    else: paste(c, sprite("none-think", 190), 920, 1120 + bob(t, 4))

def sc_outro(c, sc, t, P):
    T0 = sc["_t"][0]
    paste(c, sprite("teacher-cheer", 400), 540, 760 + bob(t, 6))
    pop(c, pill("+ กดติดตาม", 64, CREAM, RED), 540, 330, T0 + 0.2, t, 1 + 0.06 * math.sin(t * 7))
    pop(c, card(["ซ้อมสอบ SOBPREP", "สรุปเห็นภาพ + ข้อสอบฝึก 10,000+ ข้อ"], 44, 800, INK, CREAM, 34), 540, 1040, T0 + 0.6, t)
    pop(c, text_img("sobprep.com/prep", 50, 800, GOLD), 540, 1180, T0 + 0.9, t)

SCENES = {"stage": sc_stage, "rule": sc_rule, "list": sc_list, "numbers": sc_numbers, "quiz": sc_quiz, "outro": sc_outro}

# ---------------------------------------------------------------- subtitles
def make_subs(sb, times):
    subs = []
    for si, sc in enumerate(sb["scenes"]):
        for pi, txt in enumerate(sc["say"]):
            a, b = times[(si, pi)]; chunks = sub_chunks(txt, 50, 800, 700)
            tot = sum(len("".join(ch)) for ch in chunks); acc = 0
            for ch in chunks:
                s = a + (b - a) * acc / tot; acc += len("".join(ch)); e = a + (b - a) * acc / tot
                subs.append([s, e, ch])
    for cur, nxt in zip(subs, subs[1:]):
        if nxt[0] - cur[1] < 1.0: cur[1] = nxt[0]
    return subs

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("sb"); ap.add_argument("out")
    ap.add_argument("--voice", default="Kore"); ap.add_argument("--model", default="gemini-3.8-flash-tts")
    ap.add_argument("--still", type=float, default=None)
    a = ap.parse_args()
    sb = json.load(open(a.sb, encoding="utf8")); cache = os.path.join(HERE, ".cache", "tts"); os.makedirs(cache, exist_ok=True)
    voice, times, dur = build_audio(sb, a.voice, a.model, cache)
    subs = make_subs(sb, times)
    starts = [sc["_t"][0] for sc in sb["scenes"]]
    def frame(t):
        c = background().copy()
        k = max(0, max((i for i, s in enumerate(starts) if s - 0.2 <= t), default=0))
        sc = sb["scenes"][k]
        P = lambda pi: times[(k, min(pi, len(sc["say"]) - 1))][0]
        SCENES[sc["type"]](c, sc, t, P)
        f = prog(t, starts[k] - 0.2, 0.2)
        if f < 1 and k > 0: c.alpha_composite(Image.new("RGBA", (W, H), (20, 2, 6, int(255 * (1 - f)))))
        cur = [s for s in subs if s[0] - 0.05 <= t < s[1]]
        if cur:
            g = cur[-1][2]; imgs = [text_img(l, 50, 700, CREAM, 3, (20, 0, 6)) for l in g]; y = 1340 if len(imgs) == 1 else 1305
            for im in imgs: c.alpha_composite(im, (int(500 - im.width / 2), int(y - im.height / 2))); y += 72
        return c.convert("RGB")
    if a.still is not None: frame(a.still).save(a.out); return
    # sound: voice + light effects at scene changes and reveals
    fx = np.zeros_like(voice)
    def add(s, t, g):
        i = int(t * SR); s = s[:max(0, len(fx) - i)]; fx[i:i + len(s)] += s * g
    tt = np.arange(int(0.3 * SR)) / SR; whoosh = np.convolve(np.random.default_rng(2).normal(0, 1, len(tt)), np.ones(30) / 30, "same") * np.sin(np.pi * tt / 0.3) ** 2
    td = np.arange(int(0.6 * SR)) / SR; ding = (np.sin(2 * np.pi * 1320 * td) + 0.5 * np.sin(2 * np.pi * 1980 * td)) * np.exp(-td * 6)
    for si, sc in enumerate(sb["scenes"]):
        if sc["type"] == "quiz": add(ding, times[(si, sc["reveal_at"])][0], 0.12)
    mix = np.clip(voice / (np.abs(voice).max() or 1) * 0.9 + fx * 0.6, -1, 1).astype(np.float32)
    wav = a.out.rsplit(".", 1)[0] + ".wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", wav], input=mix.tobytes(), check=True)
    ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", wav,
                           "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", a.out], stdin=subprocess.PIPE)
    for i in range(int(dur * FPS)): ff.stdin.write(frame(i / FPS).tobytes())
    ff.stdin.close(); ff.wait()
    print(f"{a.out}: {dur:.1f}s")
    json.dump({"duration": dur, "phrases": {f"{k[0]}.{k[1]}": v for k, v in times.items()}}, open(a.out.rsplit(".", 1)[0] + ".timing.json", "w"))

if __name__ == "__main__": main()
