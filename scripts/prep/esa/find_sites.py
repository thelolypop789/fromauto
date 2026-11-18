#!/usr/bin/env python3
"""หาเว็บไซต์ของเขตพื้นที่การศึกษา (สพป./สพม.) แล้วเขียน scripts/prep/esa/sites.json

ไม่มีรายชื่อเว็บเขตครบจากแหล่งทางการ จึงเดาชื่อโดเมนจากรูปแบบที่เขตใช้กัน (provinces.py) → เช็ก DNS ในเครื่อง →
เปิดหน้าแรกของโดเมนที่มีจริงผ่าน pg_net ของฐานข้อมูล (เครื่องนอกไทยเข้าเว็บราชการหลายเว็บไม่ได้) →
ยอมรับเฉพาะเว็บที่ <title>/ชื่อเว็บ ระบุชื่อเขตนั้นตรงตัว

usage:
  python3 scripts/prep/esa/find_sites.py names.json dns_hits.json [extra_hosts...]
    names.json   = {"spp": [...183 ชื่อ], "spm": [...62 ชื่อ]}
    dns_hits.json = {"hits": {ชื่อเขต: [[candidate, host], ...]}}
  เว็บที่หาไม่เจอจะเป็น url null — ใส่เองใน sites.json ได้ แล้วรัน sync_sites.py
"""
import hashlib
import json
import re
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
OPS = HERE.parent / "ops" / "ops.py"
sys.path.insert(0, str(HERE))
from provinces import P  # noqa: E402

TH_DIGITS = str.maketrans("๐๑๒๓๔๕๖๗๘๙", "0123456789")


def norm(s):
    s = s.translate(TH_DIGITS)
    s = s.replace("สำนักงานเขตพื้นที่การศึกษาประถมศึกษา", "สพป.").replace("สำนักงานเขตพื้นที่การศึกษามัธยมศึกษา", "สพม.")
    s = re.sub(r"สพ([ปม])\s*\.?", r"สพ\1.", s)
    return re.sub(r"[\s\-–—|:,()]+", "", s)


def slug(name, kind):
    m = re.match(r"สพ[ปม]\.(.+?)(?:\s+เขต\s+(\d+))?$", name)
    provs = m.group(1).split()
    roman = [max((t for t in P[p] if t.isalpha()), key=len) for p in provs]
    return f"{kind}-" + "-".join(roman) + (f"-{m.group(2)}" if m.group(2) else "")


def sql(q):
    r = subprocess.run(["python3", str(OPS), "sql", "-"], input=q, capture_output=True, text=True)
    if r.returncode or not r.stdout.strip().startswith("["):
        raise SystemExit("SQL error: " + (r.stdout + r.stderr)[:400])
    return json.loads(r.stdout)


def fetch_all(urls):
    """GET ผ่าน pg_net ทีละ 40 → {url: (status, content)}"""
    lit = lambda s: "'" + s.replace("'", "''") + "'"
    out = {}
    for i in range(0, len(urls), 40):
        chunk = urls[i:i + 40]
        rows = sql("select json_agg(json_build_object('u', u, 'id', net.http_get(url := u, headers := "
                   "'{\"User-Agent\": \"Mozilla/5.0 (compatible; SOBPREP-ESA-watch/1.0)\"}'::jsonb, timeout_milliseconds := 20000))) j "
                   f"from unnest(array[{','.join(lit(u) for u in chunk)}]) u;")
        ids = {r["id"]: r["u"] for r in rows[0]["j"]}
        t0 = time.time()
        while ids and time.time() - t0 < 90:
            time.sleep(5)
            got = sql(f"select id, status_code, content from net._http_response where id in ({','.join(map(str, ids))});")
            for g in got:
                out[ids.pop(g["id"])] = (g["status_code"], g["content"] or "")
        for u in ids.values():
            out[u] = (None, "")
        print(f"  fetched {min(i + 40, len(urls))}/{len(urls)}", file=sys.stderr)
    return out


def site_label(html):
    """ข้อความที่บอกว่าเว็บนี้เป็นของใคร: title + og:site_name + h1 + alt โลโก้ + ต้นหน้า"""
    parts = re.findall(r"<title[^>]*>(.*?)</title>", html, re.S | re.I)[:1]
    parts += re.findall(r'<meta[^>]+(?:og:site_name|og:title|application-name)[^>]+content="([^"]+)"', html, re.I)
    parts += re.findall(r"<h1[^>]*>(.*?)</h1>", html, re.S | re.I)[:2]
    parts += re.findall(r'<img[^>]+alt="([^"]*(?:สำนักงานเขต|สพ[ปม])[^"]*)"', html, re.I)[:3]
    return norm(re.sub(r"<[^>]+>", " ", " ".join(parts)))


def main():
    names = json.load(open(sys.argv[1], encoding="utf-8"))
    hits = json.load(open(sys.argv[2], encoding="utf-8"))["hits"]
    extra = sys.argv[3:]
    esas = [("spp", x) for x in names["spp"]] + [("spm", x) for x in names["spm"]]
    hosts = sorted({h for v in hits.values() for _, h in v} | set(extra))
    print("hosts to open:", len(hosts), file=sys.stderr)
    pages = fetch_all([f"https://{h}/" for h in hosts])
    labels = {u: site_label(c) for u, (st, c) in pages.items() if st and st < 400 and c}
    found = {}
    for kind, name in esas:
        key = norm(name)
        # ต้องตรงทั้งชื่อ และกันกรณี "เขต1" ไปตรงกับ "เขต1x" หรือชื่อเขตที่ยาวกว่า
        pat = re.compile(re.escape(key) + r"(?![0-9ก-๙])")
        cands = [u for u, lab in labels.items() if pat.search(lab)]
        if cands:
            cands.sort(key=lambda u: (u.count("."), len(u)))  # โดเมนสั้นสุด (หน้าแรกหลัก) ก่อน
            found[name] = cands[0]
    sites = [{"code": slug(n, k), "kind": k, "name": n, "url": found.get(n),
              "source": "auto: title ตรงชื่อเขต" if n in found else None} for k, n in esas]
    out = HERE / "sites.json"
    out.write_text(json.dumps(sites, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"found {len(found)}/{len(esas)} → {out}")


if __name__ == "__main__":
    main()
