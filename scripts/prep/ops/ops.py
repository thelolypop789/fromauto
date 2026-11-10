#!/usr/bin/env python3
"""เครื่องมือของเอเจนต์ SOBPREP ฝั่ง Claude Code (docs/ops-agents.md, skill .claude/skills/sobprep-ops)

ใช้ใน cloud session ที่ proxy แนบ credential ของ api.supabase.com และ api.line.me ให้แล้ว (ไม่ต้องมี key)

  python3 scripts/prep/ops/ops.py sql FILE|-              รัน SQL (Management API) พิมพ์ JSON
  python3 scripts/prep/ops/ops.py cmd ID                   ดูคำสั่ง/งาน (owner_commands + ops_actions ที่ผูกไว้)
  python3 scripts/prep/ops/ops.py push TEXT|-              ส่งข้อความหาเจ้าของทุกคน (prep.ops_owners)
  python3 scripts/prep/ops/ops.py ask KIND REF TITLE [DETAIL_JSON] [TEXT|-]
                                                           สร้างเรื่องรออนุมัติ + ส่งข้อความและปุ่ม ✅/❌ (24 ชม., ครั้งเดียว)
  python3 scripts/prep/ops/ops.py done ID STATUS RESULT|- [SESSION_URL] [--quiet]
                                                           ปิดงาน (done/failed) แล้วส่งผลหาเจ้าของ (--quiet = ไม่ส่ง LINE)

KIND: answer hide feedback bot broadcast deploy content other  (slip เป็นของ prep-ops เท่านั้น)
ข้อความที่ส่งหาเจ้าของ: สั้น อ่านบนมือถือ ≤ 15 บรรทัด
"""
import json, secrets, subprocess, sys

REF = "diprxrkddsqmzzihjjwi"
KINDS = {"answer", "hide", "feedback", "bot", "broadcast", "deploy", "content", "other"}


def lit(s: str) -> str:
    """SQL literal ที่ปลอดภัยกับข้อความใดๆ (dollar quote แท็กสุ่ม)"""
    tag = "q" + secrets.token_hex(6)
    return f"${tag}${s}${tag}$"


def curl(url: str, body: dict) -> str:
    out = subprocess.run(["curl", "-sS", "-X", "POST", url, "-H", "content-type: application/json", "--data-binary", "@-"],
                         input=json.dumps(body).encode(), capture_output=True, check=False)
    if out.returncode:
        sys.exit(out.stderr.decode())
    return out.stdout.decode()


def sql(q: str):
    raw = curl(f"https://api.supabase.com/v1/projects/{REF}/database/query", {"query": q})
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        sys.exit("SQL: " + raw[:500])
    if isinstance(data, dict) and data.get("message"):
        sys.exit("SQL error: " + data["message"])
    return data


def owners() -> list[str]:
    rows = sql("select line_user_id from prep.ops_owners order by added_at")
    if not rows:
        sys.exit("ยังไม่มีเจ้าของใน prep.ops_owners (ให้เจ้าของพิมพ์ 'สั่ง: ลงทะเบียน' ใน LINE แล้วบอกรหัส)")
    return [r["line_user_id"] for r in rows]


def line_push(messages: list[dict]):
    for u in owners():
        raw = curl("https://api.line.me/v2/bot/message/push", {"to": u, "messages": messages[:5]})
        if '"sentMessages"' not in raw and raw.strip() not in ("{}", ""):
            print("LINE:", raw[:300], file=sys.stderr)


def text_msg(t: str) -> dict:
    return {"type": "text", "text": t.strip()[:4900]}


def confirm(token: str, title: str) -> dict:   # same shape as confirmMessage in supabase/functions/prep-ops/logic.ts
    return {"type": "template", "altText": f"รออนุมัติ: {title}"[:400], "template": {
        "type": "confirm", "text": f"{title}\n(ปุ่มใช้ได้ครั้งเดียว ภายใน 24 ชม.)"[:240],
        "actions": [
            {"type": "postback", "label": "✅ อนุมัติ", "data": f"ops:{token}:y", "displayText": f"✅ อนุมัติ — {title}"[:300]},
            {"type": "postback", "label": "❌ ไม่อนุมัติ", "data": f"ops:{token}:n", "displayText": f"❌ ไม่อนุมัติ — {title}"[:300]},
        ]}}


def arg_text(a: str) -> str:
    return sys.stdin.read() if a == "-" else a


def main(argv: list[str]):
    quiet = "--quiet" in argv
    argv = [a for a in argv if a != "--quiet"]
    if len(argv) < 2:
        sys.exit(__doc__)
    op = argv[1]
    if op == "sql":
        q = sys.stdin.read() if argv[2] == "-" else open(argv[2], encoding="utf-8").read()
        print(json.dumps(sql(q), ensure_ascii=False, indent=1))
    elif op == "cmd":
        cid = int(argv[2])
        print(json.dumps(sql(f"""select c.*, to_jsonb(a) as action from prep.owner_commands c
                                 left join prep.ops_actions a on a.id = c.action_id where c.id = {cid}"""), ensure_ascii=False, indent=1))
    elif op == "push":
        line_push([text_msg(arg_text(argv[2]))])
    elif op == "ask":
        kind, ref, title = argv[2], argv[3], argv[4]
        if kind not in KINDS:
            sys.exit(f"KIND ต้องเป็นหนึ่งใน {sorted(KINDS)}")
        detail = argv[5] if len(argv) > 5 else "{}"
        json.loads(detail)
        row = sql(f"""insert into prep.ops_actions (kind, ref, title, detail)
                      values ({lit(kind)}, {lit(ref)}, {lit(title[:200])}, {lit(detail)}::jsonb) returning id, token""")[0]
        msgs = [text_msg(arg_text(argv[6]))] if len(argv) > 6 else []
        line_push(msgs + [confirm(row["token"], title[:120])])
        print(json.dumps(row))
    elif op == "done":
        cid, status, result = int(argv[2]), argv[3], arg_text(argv[4])
        if status not in ("done", "failed"):
            sys.exit("STATUS = done | failed")
        url = argv[5] if len(argv) > 5 else ""
        sql(f"""update prep.owner_commands set status = {lit(status)}, result = {lit(result[:4000])},
                  session_url = coalesce(nullif({lit(url)}, ''), session_url), finished_at = now() where id = {cid}""")
        if quiet:
            return
        head = "✅ เสร็จ" if status == "done" else "⚠️ ทำไม่สำเร็จ"
        line_push([text_msg(f"{head} งาน #{cid}\n{result}" + (f"\n{url}" if url else ""))])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv)
