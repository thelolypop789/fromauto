#!/usr/bin/env python3
"""ซิงก์รายชื่อเขตพื้นที่ + เว็บไซต์ จาก scripts/prep/esa/sites.json เข้า prep.esa_sites (ตัวเฝ้า prep-esa-watch ใช้ตารางนี้)

usage: python3 scripts/prep/esa/sync_sites.py [--dry]
- เพิ่มเขตใหม่ / แก้ชื่อ / แก้ url (url null ในไฟล์ = คงค่าเดิมใน DB เช่นที่ job news หามาเพิ่ม); เขตที่ url เปลี่ยนจะล้าง mode/feed_url/last_ok_at ให้ตรวจใหม่ (ประกาศที่เจอครั้งแรกนับเป็นของเก่า ไม่แจ้ง)
- ไม่ลบเขตที่หายจากไฟล์ (ตั้ง active=false แทน); "watch": false = ไม่เปิดสอบรอบนี้ → active=false (ไม่เช็ก)
- รอบสอบ 2569: watch = เขตที่ประกาศรับสมัคร (จากหน้ารวมลิงก์ครูวันดี news-id58908, 121 หน่วยงาน) — รอบหน้าปรับ watch ใหม่
sites.json: [{"code": "spp-chanthaburi-2", "kind": "spp", "name": "สพป.จันทบุรี เขต 2", "url": "https://www.chan2.go.th/" | null, "source": "..."}]
"""
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
OPS = HERE.parent / "ops" / "ops.py"


def lit(s):
    return "null" if s is None else "'" + str(s).replace("'", "''") + "'"


def main():
    sites = json.loads((HERE / "sites.json").read_text(encoding="utf-8"))
    codes = [s["code"] for s in sites]
    assert len(codes) == len(set(codes)), "code ซ้ำ"
    assert len({s["name"] for s in sites}) == len(sites), "name ซ้ำ"
    for s in sites:
        assert s["kind"] in ("spp", "spm", "other"), s
        assert s["url"] is None or s["url"].startswith(("https://", "http://")), s
    values = ",\n".join(f"({lit(s['code'])}, {lit(s['kind'])}, {lit(s['name'])}, {lit(s['url'])}, {'true' if s.get('watch', True) else 'false'})" for s in sites)
    q = f"""
with v(code, kind, name, url, watch) as (values {values}),
up as (
  insert into prep.esa_sites as e (code, kind, name, url, active)
  select code, kind, name, url, watch from v
  on conflict (code) do update
    set kind = excluded.kind, name = excluded.name, url = coalesce(excluded.url, e.url), active = excluded.active,
        mode = case when coalesce(excluded.url, e.url) is distinct from e.url then null else e.mode end,
        feed_url = case when coalesce(excluded.url, e.url) is distinct from e.url then null else e.feed_url end,
        last_ok_at = case when coalesce(excluded.url, e.url) is distinct from e.url then null else e.last_ok_at end,
        next_check_at = case when coalesce(excluded.url, e.url) is distinct from e.url then now() else e.next_check_at end,
        updated_at = now()
  returning 1),
off as (update prep.esa_sites set active = false, updated_at = now() where code not in (select code from v) and active returning 1)
select (select count(*) from up) upserted, (select count(*) from off) deactivated;
-- ops.py พิมพ์ผลของคำสั่งสุดท้าย: ตัวเลขหลังซิงก์
select count(*) filter (where active) active, count(*) filter (where active and url is not null) watched,
       count(*) filter (where active and url is null) unknown_url from prep.esa_sites;
"""
    if "--dry" in sys.argv:
        print(q[:2000])
        return
    r = subprocess.run(["python3", str(OPS), "sql", "-"], input=q, capture_output=True, text=True)
    print(r.stdout or r.stderr)
    if r.returncode:
        sys.exit(r.returncode)


if __name__ == "__main__":
    main()
