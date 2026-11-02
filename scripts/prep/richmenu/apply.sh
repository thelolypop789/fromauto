#!/bin/bash
# ตั้ง Rich Menu ของ LINE OA: สร้างเมนูจาก richmenu.json → อัปโหลด richmenu.jpg → ตั้งเป็นเมนูหลักของทุกคน → ลบเมนูเก่าที่สร้างผ่าน API
# ใช้ใน cloud session ที่ proxy แนบ token ของ LINE OA ให้ทั้ง api.line.me และ api-data.line.me (Network secret)
# bash scripts/prep/richmenu/apply.sh [richMenuId ที่สร้างแล้วแต่ยังไม่มีรูป]
set -euo pipefail
cd "$(dirname "$0")"
id="${1:-}"
if [ -z "$id" ]; then
  curl -sSf -X POST https://api.line.me/v2/bot/richmenu/validate -H 'Content-Type: application/json' -d @richmenu.json >/dev/null
  id=$(curl -sSf -X POST https://api.line.me/v2/bot/richmenu -H 'Content-Type: application/json' -d @richmenu.json | python3 -c "import json,sys;print(json.load(sys.stdin)['richMenuId'])")
fi
echo "menu: $id"
curl -sSf -X POST "https://api-data.line.me/v2/bot/richmenu/$id/content" -H 'Content-Type: image/jpeg' --data-binary @richmenu.jpg >/dev/null
echo "image uploaded"
curl -sSf -X POST "https://api.line.me/v2/bot/user/all/richmenu/$id" >/dev/null
echo "set as default: $(curl -sSf https://api.line.me/v2/bot/user/all/richmenu)"
for old in $(curl -sSf https://api.line.me/v2/bot/richmenu/list | python3 -c "import json,sys;print(' '.join(m['richMenuId'] for m in json.load(sys.stdin)['richmenus']))"); do
  [ "$old" = "$id" ] || { curl -sSf -X DELETE "https://api.line.me/v2/bot/richmenu/$old" >/dev/null; echo "deleted old $old"; }
done
