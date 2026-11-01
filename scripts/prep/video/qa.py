# Checks a rendered clip: a contact sheet of frames (look at it) and a scan of the audio for TTS noise bursts.
# Usage: qa.py out/<id>.mp4   → out/<id>.sheet.png, prints the number of isolated noise bursts (should be 0)
import sys, subprocess, numpy as np
from PIL import Image
mp4 = sys.argv[1]; base = mp4.rsplit(".", 1)[0]
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4], capture_output=True, text=True).stdout)
ts = [round(dur * k / 15 + 1.5, 1) for k in range(15)]
frames = []
for t in ts:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", mp4, "-frames:v", "1", "-vf", "scale=270:480", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    if len(raw) == 270 * 480 * 3: frames.append(Image.frombytes("RGB", (270, 480), raw))
sheet = Image.new("RGB", (5 * 280 + 10, 3 * 490 + 10), (200, 200, 200))
for i, f in enumerate(frames): sheet.paste(f, (10 + (i % 5) * 280, 10 + (i // 5) * 490))
sheet.save(base + ".sheet.png")
x = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", mp4, "-ac", "1", "-ar", "24000", "-f", "f32le", "-"], capture_output=True).stdout, dtype=np.float32)
f = 480; n = len(x) // f; fr = x[:n * f].reshape(n, f)
db = 20 * np.log10(np.sqrt((fr ** 2).mean(1)) + 1e-9); zc = (np.abs(np.diff(np.sign(fr), axis=1)) / 2).mean(1)
bursts = [round(i * 0.02, 2) for i in range(2, n - 3) if db[i] > -20 and zc[i] > 0.15 and db[i - 2] < -45 and db[i + 3] < -45]
print(f"{mp4}: {dur:.1f}s · frames → {base}.sheet.png · noise bursts: {len(bursts)} {bursts[:10]}")
