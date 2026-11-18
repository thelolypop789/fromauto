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
import html
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
    s = html.unescape(s).translate(TH_DIGITS).replace("\u0e4d\u0e32", "\u0e33")  # ํา → ำ
    s = re.sub(r"[\u200b-\u200d\ufeff]", "", s)
    # ชื่อเต็ม (รวมที่เว็บเขตสะกดผิดบ่อย: พิ้นที่, ประถมศึก, ไม่มี "งาน") → ชื่อย่อ
    s = re.sub(r"สำนัก(?:งาน)?\s*เขต\s*พ[ื้ิ]+น\s*ที่\s*การ\s*ศึกษา\s*ประถม\s*ศึก(?:ษา)?", "สพป.", s)
    s = re.sub(r"สำนัก(?:งาน)?\s*เขต\s*พ[ื้ิ]+น\s*ที่\s*การ\s*ศึกษา\s*มัธยม\s*ศึก(?:ษา)?", "สพม.", s)
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


def variants(h):
    b = h[4:] if h.startswith("www.") else h
    return [f"https://www.{b}/", f"https://{b}/", f"http://www.{b}/", f"http://{b}/"]


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
    cache = Path("esa_pages_cache.json")  # ในโฟลเดอร์ที่รัน: รันซ้ำไม่ต้องดึงใหม่
    pages = {u: tuple(v) for u, v in json.loads(cache.read_text()).items()} if cache.exists() else {}
    todo = [f"https://{h}/" for h in hosts if f"https://{h}/" not in pages]
    if todo:
        pages.update(fetch_all(todo))
        cache.write_text(json.dumps(pages, ensure_ascii=False))
    # เปิดไม่ได้ → ลอง http และมี/ไม่มี www (UA บอกตัวตนตรง ๆ ไม่ปลอมเป็นเบราว์เซอร์; เว็บที่กันโปรแกรมก็ปล่อยไป)
    bad = [h for h in hosts if (pages.get(f"https://{h}/") or (None,))[0] is None or pages[f"https://{h}/"][0] >= 400]
    alt = sorted({v for h in bad for v in variants(h)} - set(pages))
    if alt:
        pages.update(fetch_all(alt))
        cache.write_text(json.dumps(pages, ensure_ascii=False))
    labels = {u: site_label(c) for u, (st, c) in pages.items() if st and st < 400 and c}
    bodies = {u: norm(re.sub(r"<[^>]+>", " ", c[:60000])) for u, (st, c) in pages.items() if st and st < 400 and c}
    # โดเมนที่เดามาจากชื่อเขตเดียว (เช่น kpt1 = กำแพงเพชร เขต 1); โดเมนที่ตรงหลายเขต (nb1) ไม่นับ
    owner = {}
    for name, v in hits.items():
        for _, h in v:
            for u in [f"https://{h}/", *variants(h)]:
                owner.setdefault(u, set()).add(name)
    found, how = {}, {}
    for kind, name in esas:
        pat = re.compile(re.escape(norm(name)) + r"(?![0-9])")
        by_label = [u for u, lab in labels.items() if pat.search(lab)]
        mine = [u for u, o in owner.items() if o == {name} and u in bodies]
        by_body = [u for u in mine if pat.search(bodies[u])]
        # หน้าอ่านไม่ออก (TIS-620 ที่ pg_net ถอดผิด) หรือหน้าว่าง แต่โดเมนตรงรูปแบบของเขตนี้เขตเดียวและเปิดได้
        blind = [u for u in mine if "\ufffd" in pages[u][1][:5000] or not labels.get(u)]
        # เปิดจากเซิร์ฟเวอร์ไม่ได้ (403/ไม่ตอบ) แต่โดเมนมีจริงและตรงรูปแบบของเขตนี้เขตเดียว: ใส่ไว้ให้ตัวเฝ้าลอง (ล่มซ้ำจะถอยรอบเอง)
        unreached = [f"https://{h}/" for _, h in hits.get(name, []) if owner.get(f"https://{h}/") == {name}
                     and (pages.get(f"https://{h}/") or (None,))[0] in (None, 403, 500, 502, 503, 520, 521, 522, 523, 525, 526)]
        unreached.sort(key=lambda u: ((pages.get(u) or (None,))[0] is None,))
        for cands, why in ((by_label, "หัวเว็บระบุชื่อเขต"), (by_body, "โดเมนตรงรูปแบบ + ชื่อเขตในหน้า"),
                           (blind, "โดเมนตรงรูปแบบ (อ่านชื่อในหน้าไม่ได้)"),
                           (unreached[:1] if len({re.sub(r"^https?://(www\.)?", "", u) for u in unreached}) == 1 else [],
                            "โดเมนตรงรูปแบบ (เปิดจากเซิร์ฟเวอร์ไม่ได้ ยังไม่ยืนยัน)")):
            if cands:
                cands.sort(key=lambda u: (u.startswith("http:"), u.count("."), len(u)))
                found[name], how[name] = cands[0], why
                break
    # เว็บเดียวกันห้ามเป็นของสองเขต: เก็บเขตที่ชื่ออยู่ใน <title> ที่เหลือทิ้ง
    base = lambda u: re.sub(r"^https?://(www\.)?", "", u).rstrip("/")
    groups = {}
    for name, u in found.items():
        groups.setdefault(base(u), []).append(name)
    for b, names_ in groups.items():
        if len(names_) > 1:
            title = norm(" ".join(re.findall(r"<title[^>]*>(.*?)</title>", pages.get(found[names_[0]], (0, ""))[1], re.S | re.I)[:1]))
            keep = [n for n in names_ if re.search(re.escape(norm(n)) + r"(?![0-9])", title)]
            for n in names_:
                if keep != [n]:
                    found.pop(n), how.pop(n)
            print("  เว็บซ้ำ", b, names_, "→ เก็บ", keep if len(keep) == 1 else "ไม่มี", file=sys.stderr)
    print("by:", {w: sum(1 for x in how.values() if x == w) for w in set(how.values())}, file=sys.stderr)
    sites = [{"code": slug(n, k), "kind": k, "name": n, "url": found.get(n),
              "source": ("auto: " + how[n]) if n in found else None} for k, n in esas]
    out = HERE / "sites.json"
    out.write_text(json.dumps(sites, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"found {len(found)}/{len(esas)} → {out}")


if __name__ == "__main__":
    main()
