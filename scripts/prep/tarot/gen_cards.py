#!/usr/bin/env python3
"""วาดไพ่ยิปซีชุดใหญ่ 22 ใบ เป็นน้องไฟ (มาสคอต) แต่งชุดตามองค์ประกอบของไพ่ต้นฉบับ Rider-Waite

ภาพวาดโดย Gemini (gemini-2.5-flash-image) ผ่าน Edge Function prep-media action "image" — GEMINI_KEY อยู่ใน Supabase เท่านั้น
ส่งรูปน้องไฟเดิม 2 ท่าเป็นต้นแบบ ให้หน้าตาเหมือนกันทุกใบ แล้วบรรยายฉากตามไพ่จริง (ชื่อและความหมายไม่เปลี่ยน)
ไม่ใส่ตัวหนังสือในภาพ (ชื่อไพ่แสดงด้วยตัวหนังสือในแอป ไม่ให้ AI เขียนตัวสะกดเพี้ยน)

Run (ต้องมี .cache/media_secret จาก scripts/prep/video/setup.sh):
  python3 scripts/prep/tarot/gen_cards.py            # วาดใบที่ยังไม่มี
  python3 scripts/prep/tarot/gen_cards.py 13 16      # วาดใหม่เฉพาะใบที่ระบุ
→ src/prep/tarot/<เลข 2 หลัก>.webp (640×960)
"""
import base64
import io
import json
import os
import sys
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "src/prep/tarot"
SECRET = ROOT / "scripts/prep/video/.cache/media_secret"
FN = "https://diprxrkddsqmzzihjjwi.supabase.co/functions/v1/prep-media"
REFS = [ROOT / "src/prep/mascot/none-happy.webp", ROOT / "src/prep/mascot/none-think.webp"]

STYLE = (
    "Use the attached cute 3D flame mascot as the ONLY character design: a round red-orange flame with a pointed top, "
    "a cream-yellow face, small rosy cheeks, tiny arms and feet. Keep exactly this character and face style. "
    "Draw ONE vertical tarot card illustration (2:3) in soft 3D cartoon style, rich warm colors on a deep night-purple "
    "and maroon background, an ornate thin gold frame around the picture. The mascot acts out the classic Rider-Waite "
    "card described below, keeping the traditional symbols so a tarot reader recognises the card. "
    "Do NOT write any text, letters, numbers or Roman numerals anywhere in the image. Friendly, not scary, suitable for all ages."
)

# ฉากของแต่ละใบ: องค์ประกอบหลักของไพ่ Rider-Waite เดิม น้องไฟเป็นตัวละครหลัก
SCENES = [
    "THE FOOL: the flame steps happily toward the edge of a cliff under a bright sun, a small bundle on a stick over its shoulder, a white rose in its hand, a little white dog jumping at its feet, snowy mountains behind.",
    "THE MAGICIAN: the flame stands behind a table, one arm raising a glowing white wand to the sky, the other pointing down; on the table a cup, a sword, a wooden wand and a gold pentacle coin; an infinity symbol floats above its head; red roses and white lilies around.",
    "THE HIGH PRIESTESS: the flame sits calmly between a black pillar and a white pillar, wearing a blue robe and a crown with a crescent, holding a scroll, a crescent moon at its feet, a veil with pomegranates behind.",
    "THE EMPRESS: the flame sits on a cushioned throne in a golden wheat field beside a forest and a waterfall, wearing a crown of twelve stars and a dress with pomegranate patterns, a heart-shaped shield with the Venus symbol next to it.",
    "THE EMPEROR: the flame sits on a stone throne decorated with ram heads, wearing red robes, armor and a gold crown, holding an ankh scepter and a golden orb, barren orange mountains behind.",
    "THE HIEROPHANT: the flame sits on a throne between two grey pillars wearing a tall triple crown and red robes, raising a hand in blessing and holding a triple cross staff, two crossed keys at its feet and two small kneeling flame acolytes.",
    "THE LOVERS: two small flames stand facing each other in a garden, a tree with flames behind one and an apple tree with a snake behind the other, a big winged angel spreads its arms above them under a bright sun, a mountain between them.",
    "THE CHARIOT: the flame stands proudly in a chariot under a starry canopy, wearing armor with crescent moons on the shoulders and holding a wand, a black sphinx and a white sphinx sit in front of the chariot, a city behind.",
    "STRENGTH: the flame gently holds the jaws of a calm golden lion, wearing a white robe and a belt of flowers, an infinity symbol above its head, green hills and a blue sky.",
    "THE HERMIT: the flame in a grey hooded cloak stands alone on a snowy mountain peak at night, holding a lantern with a glowing six-pointed star inside and a long wooden staff.",
    "WHEEL OF FORTUNE: a big golden wheel with mystical symbols turns in the clouds, a sphinx with a sword sits on top, a snake slides down one side, a jackal-headed figure rises on the other, and in the four corners an angel, an eagle, a lion and a bull reading books; the flame rides happily on the rim of the wheel.",
    "JUSTICE: the flame sits on a throne between two pillars, wearing a red robe and a crown, holding a raised double-edged sword in one hand and balanced golden scales in the other.",
    "THE HANGED MAN: the flame hangs upside down by one foot from a living T-shaped wooden beam with green leaves, the other leg bent behind the knee in a figure-four, a calm smiling face with a glowing golden halo around its head.",
    "DEATH: the flame wears black armor and rides a white horse, carrying a black flag with a white five-petal rose; a sun rises between two towers on the horizon; it looks gentle and calm, symbolising transformation, no skulls, no gore.",
    "TEMPERANCE: the flame as a winged angel with a white robe and a triangle on its chest pours water between two golden cups, one foot on a rock and one foot in a pool, irises growing nearby, a path leads to a sunlit crown on the mountains.",
    "THE DEVIL: a horned bat-winged goat-like devil sits on a dark pedestal holding a torch, two small flames with tiny horns are chained loosely to the pedestal (the chains are loose enough to slip off); dark but cartoonish and not frightening.",
    "THE TOWER: a tall stone tower on a rocky peak is struck by lightning, its crown is blown off, flames and sparks burst from the windows, two small flames tumble through the air, dark storm clouds; dramatic but cartoonish, nobody hurt.",
    "THE STAR: the flame kneels by a pool at night under one large eight-pointed star and seven small stars, pouring water from two jugs, one into the pool and one onto the land, a small bird on a tree behind.",
    "THE MOON: a full moon with a calm face glows between two towers, a winding path leads into the distance, a dog and a wolf howl at the moon, a crayfish climbs out of a pool; the flame peeks curiously from beside the path; misty and mysterious.",
    "THE SUN: a huge smiling sun shines in a blue sky, sunflowers grow behind a stone wall, the flame rides joyfully on a white horse, arms open wide, holding a red banner.",
    "JUDGEMENT: an angel blows a golden trumpet with a white flag bearing a red cross from the clouds; below, small flames rise from open boxes on the water with arms raised in joy; mountains behind.",
    "THE WORLD: the flame dances inside a large green laurel wreath tied with red ribbons, holding a small wand in each hand, with an angel, an eagle, a lion and a bull in the four corners among clouds.",
]


def ref_parts():
    parts = []
    for p in REFS:
        buf = io.BytesIO()
        Image.open(p).convert("RGBA").save(buf, "PNG")
        parts.append({"mime": "image/png", "data": base64.b64encode(buf.getvalue()).decode()})
    return parts


def draw(i: int, refs, secret: str):
    body = json.dumps({"action": "image", "prompt": STYLE + "\n\nCARD: " + SCENES[i], "images": refs, "aspect": "2:3"}).encode()
    req = urllib.request.Request(FN, data=body, headers={"x-media-secret": secret, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r:
        d = json.load(r)
    img = Image.open(io.BytesIO(base64.b64decode(d["image"]))).convert("RGB")
    # ตัดให้ได้ 2:3 พอดี แล้วย่อเป็น 640×960
    w, h = img.size
    tw = min(w, int(h * 2 / 3)); th = int(tw * 3 / 2)
    img = img.crop(((w - tw) // 2, (h - th) // 2, (w - tw) // 2 + tw, (h - th) // 2 + th)).resize((640, 960), Image.LANCZOS)
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / f"{i:02d}.webp", "WEBP", quality=82)
    print(f"{i:02d} ok", flush=True)


def main():
    assert len(SCENES) == 22
    secret = SECRET.read_text().strip()
    only = [int(a) for a in sys.argv[1:]]
    todo = only or [i for i in range(22) if not (OUT / f"{i:02d}.webp").exists()]
    refs = ref_parts()
    for i in todo:
        for attempt in range(3):
            try:
                draw(i, refs, secret)
                break
            except Exception as e:  # noqa: BLE001
                print(f"{i:02d} attempt {attempt + 1} failed: {e}", flush=True)


if __name__ == "__main__":
    os.chdir(ROOT)
    main()
