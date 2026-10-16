#!/usr/bin/env python3
"""Build a fixed-amount Thai QR card from the existing 99-baht card.

usage: python3 scripts/prep/make_qr.py 30 50 80 130
Reads  public/prep-pay-qr.png (static PromptPay payload) and public/prep-pay-qr-99.png (card layout),
writes public/prep-pay-qr-<amount>.png and decodes every result to check tag 54 and the CRC.
Needs: pip install segno opencv-python pillow numpy
"""
import io, sys
import cv2, numpy as np, segno
from PIL import Image, ImageDraw, ImageFont

PUB = "public/"
FONT = next(p for p in ["/usr/share/fonts/truetype/tlwg/Loma-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
            if __import__("os").path.exists(p))
BOX = (152, 194, 521, 563)       # QR area on the 99-baht card (x0, y0, x1, y1)
LOGO = (294, 342, 370, 414)      # centre badge copied from the template card
NUM = (536, 788, 598, 842)       # the "99" amount text (left of "บาท"), right edge anchors the text
CARD_ZONE = (120, 780, 640, 850) # row "ยอดเงิน ... N บาท"

def crc16(s: str) -> str:
    c = 0xFFFF
    for b in s.encode():
        c ^= b << 8
        for _ in range(8):
            c = ((c << 1) ^ 0x1021) & 0xFFFF if c & 0x8000 else (c << 1) & 0xFFFF
    return f"{c:04X}"

def decode(path_or_img) -> str:
    im = cv2.imread(path_or_img) if isinstance(path_or_img, str) else path_or_img
    v, _, _ = cv2.QRCodeDetector().detectAndDecode(im)
    return v

def payload(base: str, amount: int) -> str:
    body = base[:-8]                      # drop "6304XXXX"
    assert base[-8:-4] == "6304" and "5802TH" in body
    amt = f"{amount:.2f}"
    body = body.replace("5802TH", f"54{len(amt):02d}{amt}5802TH", 1)
    body += "6304"
    return body + crc16(body)

def main(amounts):
    base = decode(PUB + "prep-pay-qr.png")
    assert crc16(base[:-4]) == base[-4:], "base CRC mismatch"
    tpl_text = decode(PUB + "prep-pay-qr-99.png")
    assert payload(base, 99) == tpl_text, "payload builder does not reproduce the 99 card"
    tpl = Image.open(PUB + "prep-pay-qr-99.png").convert("RGB")
    logo = tpl.crop(LOGO)
    for a in amounts:
        text = payload(base, a)
        qr = segno.make(text, error="h", micro=False, boost_error=False)
        buf = io.BytesIO(); qr.save(buf, kind="png", scale=12, border=0)
        q = Image.open(buf).convert("RGB").resize((BOX[2] - BOX[0], BOX[3] - BOX[1]), Image.NEAREST)
        img = tpl.copy()
        img.paste(q, BOX[:2])
        img.paste(logo, LOGO[:2])
        d = ImageDraw.Draw(img)
        d.rectangle(NUM, fill="white")
        f = ImageFont.truetype(FONT, 42)
        s = str(a)
        w = d.textlength(s, font=f)
        d.text((NUM[2] - w, 800), s, font=f, fill=(20, 20, 20))
        out = f"{PUB}prep-pay-qr-{a}.png"
        img.save(out, optimize=True)
        got = decode(out)
        ok = got == text and f"54{len(f'{a:.2f}'):02d}{a:.2f}" in got and crc16(got[:-4]) == got[-4:]
        print(a, "OK" if ok else "FAILED TO DECODE", got[-30:])
        if not ok: sys.exit(1)

if __name__ == "__main__":
    main([int(x) for x in sys.argv[1:]] or [30, 50, 80, 130])
