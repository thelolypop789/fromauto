-- เฝ้าเว็บเขตพื้นที่การศึกษา (สพป. 183 + สพม. 62) หาประกาศครูผู้ช่วย — เจ้าของสั่ง 18 พ.ย. 69 ("ทุกเขต ทั้ง สพม ทั้ง สพป")
-- pg_cron ทุก 10 นาที → edge function prep-esa-watch ทยอยเช็กเว็บที่ถึงรอบ (ทุกเว็บราว 2 ชม.ครั้ง; เว็บล่มถอยเวลาเป็นเท่าตัว สูงสุด 24 ชม.)
-- เก็บเฉพาะหัวข้อเกี่ยวกับครูผู้ช่วย (logic.ts) → แจ้ง LINE เจ้าของเป็นสรุป ไม่เกินชั่วโมงละครั้ง เฉพาะ 07:00–21:59 (ที่ค้างตอนกลางคืนรวมไปส่งเช้า)
-- ประกาศที่เจอตอนเช็กเว็บนั้นครั้งแรก = ของเก่า (baseline) เก็บไว้แต่ไม่แจ้ง
-- รายชื่อเขต + เว็บ: scripts/prep/esa/sites.json → python3 scripts/prep/esa/sync_sites.py (เว็บที่ยังไม่รู้ url = null ไม่ถูกเช็ก)
-- ทุกอย่างเรียกผ่าน RPC ของ service_role เท่านั้น (ไม่เปิดให้ anon/authenticated)

create table prep.esa_sites (
  code            text primary key,                       -- spp-chanthaburi-2, spm-nakhonphanom
  kind            text not null check (kind in ('spp', 'spm', 'other')),
  name            text not null unique,                   -- สพป.จันทบุรี เขต 2
  url             text,                                   -- หน้าแรกของเว็บเขต (null = ยังไม่รู้ ไม่เช็ก)
  feed_url        text,                                   -- RSS ที่ตรวจเจอ (WordPress /feed/)
  mode            text check (mode in ('rss', 'html')),   -- null = ยังไม่เคยเช็กสำเร็จ
  active          boolean not null default true,
  next_check_at   timestamptz not null default now(),
  last_checked_at timestamptz,
  last_ok_at      timestamptz,
  fail_count      int not null default 0,
  last_error      text,
  updated_at      timestamptz not null default now()
);
create index esa_sites_due on prep.esa_sites (next_check_at) where active and url is not null;

create table prep.esa_posts (
  id          bigserial primary key,
  site_code   text not null references prep.esa_sites (code) on delete cascade,
  url         text not null unique,
  title       text not null,
  topic       text not null default 'other' check (topic in ('apply', 'eligible', 'result', 'report', 'other')),
  posted_at   timestamptz,                                -- วันที่ใน RSS (หน้าเว็บทั่วไปไม่มี)
  found_at    timestamptz not null default now(),
  baseline    boolean not null default false,             -- เจอตอนเช็กเว็บนั้นครั้งแรก (ประกาศเก่า) ไม่แจ้ง
  notified_at timestamptz
);
create index esa_posts_found on prep.esa_posts (found_at desc);
create index esa_posts_pending on prep.esa_posts (found_at) where notified_at is null;

create table prep.esa_settings (
  id             int primary key default 1 check (id = 1),
  enabled        boolean not null default true,           -- สวิตช์หลัก: false = cron ไม่ปลุก edge function
  last_digest_at timestamptz
);
insert into prep.esa_settings default values;

alter table prep.esa_sites enable row level security;
alter table prep.esa_posts enable row level security;
alter table prep.esa_settings enable row level security;
revoke all on prep.esa_sites, prep.esa_posts, prep.esa_settings from public, anon, authenticated;
revoke all on sequence prep.esa_posts_id_seq from public, anon, authenticated;

-- ---------- RPC สำหรับ edge function (service_role) ----------
create function public.prep_esa_secret_ok(p_secret text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(length(p_secret) >= 16 and p_secret = (select decrypted_secret from vault.decrypted_secrets where name = 'esa_cron_secret'), false);
$$;

-- จองเว็บที่ถึงรอบ (เลื่อน next_check_at ไป 20 นาทีกันสองรอบทับกัน; รายงานผลแล้วจะตั้งรอบถัดไปใหม่)
create function public.prep_esa_claim(p_n int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  with due as (
    select code from prep.esa_sites
     where active and url is not null and next_check_at <= now()
     order by next_check_at limit greatest(1, least(coalesce(p_n, 25), 60))
     for update skip locked),
  upd as (
    update prep.esa_sites s set next_check_at = now() + interval '20 minutes'
      from due where s.code = due.code
    returning s.code, s.name, s.url, s.feed_url, s.mode)
  select coalesce(jsonb_agg(to_jsonb(upd)), '[]'::jsonb) into r from upd;
  return r;
end $$;

-- ผลการเช็กหนึ่งเว็บ: p_items = [{title, url, topic, posted_at}] (กรองแล้ว) → คืนจำนวนประกาศใหม่ที่จะถูกแจ้ง
create function public.prep_esa_report(p_code text, p_ok boolean, p_mode text, p_feed_url text, p_error text, p_items jsonb)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  first boolean;
  n int := 0;
begin
  select last_ok_at is null into first from prep.esa_sites where code = p_code;
  if first is null then raise exception 'unknown site %', p_code; end if;
  if p_ok then
    with ins as (
      insert into prep.esa_posts (site_code, url, title, topic, posted_at, baseline, notified_at)
      select p_code, left(i->>'url', 1000), left(i->>'title', 300),
             case when i->>'topic' in ('apply', 'eligible', 'result', 'report') then i->>'topic' else 'other' end,
             case when (i->>'posted_at') ~ '^\d{4}-\d{2}-\d{2}T' then (i->>'posted_at')::timestamptz end,
             first, case when first then now() end
        from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) i
       where coalesce(i->>'url', '') ~ '^https?://' and length(coalesce(i->>'title', '')) > 0
      on conflict (url) do nothing
      returning baseline)
    select count(*) filter (where not baseline) into n from ins;
    update prep.esa_sites
       set last_checked_at = now(), last_ok_at = now(), fail_count = 0, last_error = null,
           mode = coalesce(p_mode, mode), feed_url = coalesce(p_feed_url, feed_url),
           next_check_at = now() + interval '2 hours', updated_at = now()
     where code = p_code;
  else
    update prep.esa_sites
       set last_checked_at = now(), fail_count = fail_count + 1, last_error = left(p_error, 300),
           next_check_at = now() + least(interval '2 hours' * power(2, least(fail_count, 4)), interval '24 hours'),
           updated_at = now()
     where code = p_code;
  end if;
  return n;
end $$;

-- ประกาศใหม่ที่ยังไม่แจ้ง (ทำเครื่องหมายว่าแจ้งแล้วในคราวเดียว) — คืน [] ถ้าเพิ่งแจ้งไปไม่ถึง p_min_gap หรือเป็นช่วง 22:00–06:59
create function public.prep_esa_take_digest(p_min_gap interval) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  if extract(hour from now() at time zone 'Asia/Bangkok') not between 7 and 21 then return '[]'::jsonb; end if;
  if exists (select 1 from prep.esa_settings where id = 1 and last_digest_at > now() - coalesce(p_min_gap, interval '60 minutes')) then
    return '[]'::jsonb;
  end if;
  with t as (
    update prep.esa_posts p set notified_at = now()
     where p.notified_at is null and not p.baseline
    returning p.site_code, p.title, p.url, p.topic)
  select coalesce(jsonb_agg(jsonb_build_object('site', s.name, 'title', t.title, 'url', t.url, 'topic', t.topic) order by s.name), '[]'::jsonb)
    into r from t join prep.esa_sites s on s.code = t.site_code;
  if jsonb_array_length(r) > 0 then update prep.esa_settings set last_digest_at = now() where id = 1; end if;
  return r;
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.prep_esa_secret_ok(text)', 'public.prep_esa_claim(int)',
                           'public.prep_esa_report(text,boolean,text,text,text,jsonb)', 'public.prep_esa_take_digest(interval)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- ---------- cron: ปลุก edge function ทุก 10 นาที (ปิดได้ด้วย update prep.esa_settings set enabled = false) ----------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'esa_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'esa_cron_secret', 'shared secret between pg_cron and prep-esa-watch');
  end if;
end $$;

create function prep.esa_tick() returns bigint
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce((select enabled from prep.esa_settings where id = 1), false) then return null; end if;
  return net.http_post(
    url := 'https://diprxrkddsqmzzihjjwi.supabase.co/functions/v1/prep-esa-watch',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'esa_cron_secret')),
    body := '{"action":"tick"}'::jsonb,
    timeout_milliseconds := 150000);
end $$;
revoke execute on function prep.esa_tick() from public;

select cron.schedule('prep-esa-tick', '*/10 * * * *', 'select prep.esa_tick()');
