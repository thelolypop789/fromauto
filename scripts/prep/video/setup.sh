#!/usr/bin/env bash
# One-time setup for the summary-clip builder (scripts/prep/video). Safe to re-run.
#   - Python packages: Pillow, numpy, pythainlp (Thai word breaks for subtitles)
#   - Prompt font (Thai glyphs) from fontsource on jsDelivr → .cache/fonts
#   - TTS secret: vault secret media_secret via the Supabase Management API → .cache/media_secret (never printed)
# Needs ffmpeg, the Noto Color Emoji font, and a session where api.supabase.com is authenticated by the proxy.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p .cache/fonts .cache/tts out
python3 -c "import PIL, numpy, pythainlp" 2>/dev/null || pip install -q pillow numpy pythainlp
command -v ffmpeg >/dev/null || { echo "ffmpeg missing"; exit 1; }
fc-list | grep -q NotoColorEmoji || echo "warning: Noto Color Emoji not found (emoji icons will be blank)"
for w in 600 700 800; do
  f=.cache/fonts/prompt-$w.ttf
  [ -s "$f" ] || curl -sSfL -o "$f" "https://cdn.jsdelivr.net/npm/@fontsource/prompt@5.0.8/files/prompt-thai-$w-normal.woff"
done
if [ ! -s .cache/media_secret ]; then
  curl -sS -X POST https://api.supabase.com/v1/projects/diprxrkddsqmzzihjjwi/database/query -H 'content-type: application/json' \
    -d "{\"query\":\"select decrypted_secret s from vault.decrypted_secrets where name='media_secret'\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['s'], end='')" > .cache/media_secret
  chmod 600 .cache/media_secret
fi
echo "ready: fonts $(ls .cache/fonts | wc -l)/3, secret $( [ -s .cache/media_secret ] && echo ok || echo MISSING ), cached lines $(ls .cache/tts | wc -l)"
