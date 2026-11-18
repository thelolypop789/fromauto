// เฝ้าเว็บเขตพื้นที่การศึกษา (สพป./สพม.) หาประกาศครูผู้ช่วย แล้วแจ้งเจ้าของทาง LINE เป็นสรุป
//   * pg_cron ทุก 10 นาที (prep.esa_tick): header x-cron-secret (ตรวจในฐานข้อมูล) → action "tick"
//   * แต่ละรอบจองเว็บที่ถึงรอบ ~25 เว็บ (prep_esa_claim) เช็ก RSS (WordPress /feed/) หรือหน้าแรก กรองหัวข้อด้วย logic.ts
//     แล้วรายงานผล (prep_esa_report) จากนั้นขอสรุปที่ยังไม่แจ้ง (prep_esa_take_digest ชั่วโมงละครั้ง) ส่ง LINE push ถึง ops_owners
// อ่านเว็บสาธารณะอย่างเดียว ไม่ล็อกอิน ไม่ส่งข้อมูลใด ๆ ออกไป; ไม่โพสต์อะไรเอง
// Secrets: LINE_CHANNEL_ACCESS_TOKEN (ใช้ร่วมกับ prep-line-bot / prep-ops)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { charsetOf, digestText, type Found, isRss, type Item, parseFeed, parseHtmlLinks, recruitItems, topicOf } from "./logic.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LINE_TOKEN = (Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "").trim();
const UA = "Mozilla/5.0 (compatible; SOBPREP-ESA-watch/1.0; +https://sobprep.com/prep/news/)";
const PER_RUN = 25, PARALLEL = 8, FETCH_MS = 12000, BUDGET_MS = 110000, MAX_BYTES = 3_000_000;
const PAGE_URL = ""; // หน้ารวมลิงก์บนเว็บ (ยังไม่มี)

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const sb = () => createClient(SUPABASE_URL, SERVICE_KEY);

type Site = { code: string; name: string; url: string; feed_url: string | null; mode: "rss" | "html" | null };
type Got = { status: number; ctype: string | null; body: string; url: string };

async function get(url: string): Promise<Got> {
  const res = await fetch(url, {
    redirect: "follow", signal: AbortSignal.timeout(FETCH_MS),
    headers: { "User-Agent": UA, "Accept": "text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.5", "Accept-Language": "th,en;q=0.5" },
  });
  const buf = new Uint8Array(await res.arrayBuffer()).slice(0, MAX_BYTES);
  const ctype = res.headers.get("content-type");
  const head = new TextDecoder("latin1").decode(buf.slice(0, 4000));
  let body: string;
  try { body = new TextDecoder(charsetOf(ctype, head)).decode(buf); } catch { body = new TextDecoder().decode(buf); }
  return { status: res.status, ctype, body, url: res.url || url };
}

type Checked = { ok: boolean; mode?: "rss" | "html"; feed_url?: string | null; error?: string; items: (Item & { topic: string })[] };

async function check(s: Site): Promise<Checked> {
  try {
    let items: Item[] | null = null, mode: "rss" | "html" = "html", feed: string | null = null;
    // 1) RSS: ใช้ที่รู้แล้ว หรือลอง /feed/ ครั้งแรก (เว็บเขตส่วนใหญ่เป็น WordPress)
    if (s.mode !== "html") {
      const f = s.feed_url ?? new URL("feed/", s.url.endsWith("/") ? s.url : s.url + "/").toString();
      try {
        const r = await get(f);
        if (r.status < 400 && isRss(r.ctype, r.body)) { items = parseFeed(r.body, r.url); mode = "rss"; feed = r.url; }
      } catch { /* ไม่มี RSS → ใช้หน้าแรก */ }
    }
    // 2) หน้าแรก: ลิงก์ทุกอันที่เป็นหัวข้อ
    if (!items) {
      const r = await get(s.url);
      if (r.status >= 400) return { ok: false, error: `HTTP ${r.status}`, items: [] };
      items = parseHtmlLinks(r.body, r.url);
      mode = "html";
    }
    const keep = recruitItems(items).slice(0, 40).map((i) => ({ ...i, topic: topicOf(i.title) }));
    return { ok: true, mode, feed_url: feed, items: keep };
  } catch (e) {
    return { ok: false, error: (e as Error).name === "TimeoutError" ? "timeout" : (e as Error).message.slice(0, 200), items: [] };
  }
}

async function pushOwners(text: string): Promise<number> {
  if (!LINE_TOKEN) return 0;
  const { data } = await sb().rpc("prep_ops_owners");
  let sent = 0;
  for (const to of (data as string[] | null) ?? []) {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_TOKEN}` },
      body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
    });
    if (res.ok) sent++; else console.error("LINE push", res.status, await res.text());
  }
  return sent;
}

async function tick() {
  const t0 = Date.now();
  const client = sb();
  const { data, error } = await client.rpc("prep_esa_claim", { p_n: PER_RUN });
  if (error) throw new Error("claim: " + error.message);
  const sites = (data as Site[]) ?? [];
  let checked = 0, failed = 0, fresh = 0, i = 0;
  const worker = async () => {
    while (i < sites.length && Date.now() - t0 < BUDGET_MS) {
      const s = sites[i++];
      const c = await check(s);
      const { data: n, error: e } = await client.rpc("prep_esa_report", {
        p_code: s.code, p_ok: c.ok, p_mode: c.mode ?? null, p_feed_url: c.feed_url ?? null, p_error: c.error ?? null, p_items: c.items,
      });
      if (e) console.error("report", s.code, e.message);
      checked++; if (!c.ok) failed++; fresh += (n as number) ?? 0;
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));

  const { data: dig, error: de } = await client.rpc("prep_esa_take_digest", { p_min_gap: "60 minutes" });
  if (de) console.error("digest", de.message);
  const rows = (dig as Found[] | null) ?? [];
  const pushed = rows.length ? await pushOwners(digestText(rows, PAGE_URL)) : 0;
  return { ok: true, claimed: sites.length, checked, failed, new_posts: fresh, digest: rows.length, pushed, ms: Date.now() - t0 };
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const secret = req.headers.get("x-cron-secret");
  if (!secret) return json({ error: "unauthorized" }, 401);
  const { data: ok } = await sb().rpc("prep_esa_secret_ok", { p_secret: secret });
  if (!ok) return json({ error: "unauthorized" }, 401);
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action !== "tick") return json({ error: "unknown action" }, 400);
    const r = await tick();
    console.log(JSON.stringify(r));
    return json(r);
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
