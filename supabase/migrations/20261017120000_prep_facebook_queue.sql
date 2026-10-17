-- Facebook page post queue: schedule photo posts and a follow-up "answer" comment, published by the Edge Function
-- prep-fb-agent (Graph API). Additive only: two tables, a private storage bucket, new functions, one cron job.
--
-- Safety model:
--   * nothing is ever published unless an admin moved the post from 'draft' to 'scheduled' AND switched the master
--     switch (prep.fb_settings.enabled) on; the switch is off by default
--   * a post is claimed ('posting') before the Graph call, and a claim that never finished is marked 'failed' and is
--     NOT retried automatically (it may already be on the page; a retry could double-post)
--   * the page token lives only in the Edge Function secret FB_PAGE_TOKEN, never in the database or the browser

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table prep.fb_settings (
  id          smallint primary key default 1 check (id = 1),
  enabled     boolean not null default false,
  daily_limit smallint not null default 6 check (daily_limit between 1 and 25),
  updated_at  timestamptz not null default now()
);
insert into prep.fb_settings default values;
alter table prep.fb_settings enable row level security;

create table prep.fb_posts (
  id             int generated always as identity primary key,
  title          text not null,                          -- admin-only label, e.g. 'วัน 1 · ภาค ก ข้อ 1'
  caption        text not null default '',
  image_path     text,                                   -- object in the private bucket fb-media
  comment_text   text,                                   -- the answer comment (optional)
  comment_image_path text,
  comment_delay_min int not null default 150 check (comment_delay_min between 0 and 1440),
  scheduled_at   timestamptz,
  status         text not null default 'draft'
                   check (status in ('draft', 'scheduled', 'posting', 'posted', 'failed', 'cancelled')),
  fb_post_id     text,
  posted_at      timestamptz,
  comment_status text not null default 'none'
                   check (comment_status in ('none', 'pending', 'commenting', 'done', 'failed')),
  fb_comment_id  text,
  commented_at   timestamptz,
  error          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index fb_posts_due on prep.fb_posts (status, scheduled_at);
alter table prep.fb_posts enable row level security;

-- ---------- private bucket for the images (admins only) ----------
insert into storage.buckets (id, name, public) values ('fb-media', 'fb-media', false) on conflict (id) do nothing;
create policy fb_media_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'fb-media' and public.prep_admin_check());
create policy fb_media_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'fb-media' and public.prep_admin_check());
create policy fb_media_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'fb-media' and public.prep_admin_check());

-- ---------- admin RPCs ----------
create function public.prep_admin_fb_list() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return jsonb_build_object(
    'settings', (select to_jsonb(s) from prep.fb_settings s where id = 1),
    'posted_24h', (select count(*) from prep.fb_posts where status in ('posting', 'posted') and coalesce(posted_at, updated_at) > now() - interval '24 hours'),
    'posts', coalesce((select jsonb_agg(to_jsonb(p) order by p.scheduled_at nulls last, p.id) from prep.fb_posts p), '[]'::jsonb));
end $$;

create function public.prep_admin_fb_settings(p_enabled boolean, p_daily_limit int default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  update prep.fb_settings
     set enabled = p_enabled, daily_limit = coalesce(p_daily_limit, daily_limit)::smallint, updated_at = now()
   where id = 1;
end $$;

-- Create or edit a post. Only draft / scheduled / failed / cancelled posts are editable; the status is not set here.
create function public.prep_admin_fb_save(p_post jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  id_    int := nullif(p_post ->> 'id', '')::int;
  cur    prep.fb_posts;
  cap    text := coalesce(p_post ->> 'caption', '');
  ctext  text := nullif(trim(coalesce(p_post ->> 'comment_text', '')), '');
  delay  int  := coalesce(nullif(p_post ->> 'comment_delay_min', '')::int, 150);
  at_    timestamptz := nullif(p_post ->> 'scheduled_at', '')::timestamptz;
  img    text := nullif(p_post ->> 'image_path', '');
  cimg   text := nullif(p_post ->> 'comment_image_path', '');
begin
  perform prep.require_admin();
  if length(trim(coalesce(p_post ->> 'title', ''))) = 0 then raise exception 'empty_title'; end if;
  if length(cap) > 8000 or length(coalesce(ctext, '')) > 8000 then raise exception 'too_long'; end if;
  if delay < 0 or delay > 1440 then raise exception 'bad_delay'; end if;
  if img is not null and (img !~ '^[A-Za-z0-9._/-]{1,200}$' or img like '%..%' or img like '/%') then raise exception 'bad_path'; end if;
  if cimg is not null and (cimg !~ '^[A-Za-z0-9._/-]{1,200}$' or cimg like '%..%' or cimg like '/%') then raise exception 'bad_path'; end if;
  if length(trim(cap)) = 0 and img is null then raise exception 'empty_post'; end if;

  if id_ is null then
    insert into prep.fb_posts (title, caption, image_path, comment_text, comment_image_path, comment_delay_min, scheduled_at)
    values (trim(p_post ->> 'title'), cap, img, ctext, cimg, delay, at_)
    returning prep.fb_posts.id into id_;
    return id_;
  end if;

  select * into cur from prep.fb_posts where prep.fb_posts.id = id_ for update;
  if not found then raise exception 'not_found'; end if;
  if cur.status in ('posting', 'posted') then raise exception 'locked'; end if;
  update prep.fb_posts
     set title = trim(p_post ->> 'title'), caption = cap, image_path = img, comment_text = ctext,
         comment_image_path = cimg, comment_delay_min = delay, scheduled_at = at_, updated_at = now()
   where prep.fb_posts.id = id_;
  return id_;
end $$;

-- draft -> scheduled (approve), scheduled -> draft (pull back), any unpublished -> cancelled, failed/cancelled -> draft.
create function public.prep_admin_fb_set_status(p_ids int[], p_status text) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform prep.require_admin();
  if p_status not in ('draft', 'scheduled', 'cancelled') then raise exception 'bad_status'; end if;
  if p_status = 'scheduled' and exists (
       select 1 from prep.fb_posts where id = any (p_ids) and status in ('draft', 'failed', 'cancelled')
         and (scheduled_at is null or (image_path is null and length(trim(caption)) = 0))) then
    raise exception 'incomplete';
  end if;
  if p_status = 'scheduled' and exists (
       select 1 from prep.fb_posts where id = any (p_ids) and status in ('draft', 'failed', 'cancelled')
         and scheduled_at < now() - interval '5 minutes') then
    raise exception 'in_past';
  end if;
  update prep.fb_posts
     set status = p_status,
         error = case when p_status = 'draft' then null else error end,
         comment_status = case when comment_text is not null and p_status = 'scheduled' then 'pending'
                               when p_status in ('draft', 'cancelled') then 'none' else comment_status end,
         updated_at = now()
   where id = any (p_ids)
     and status in ('draft', 'scheduled', 'failed', 'cancelled')
     and not (p_status = 'scheduled' and status = 'scheduled');
  get diagnostics n = row_count;
  return n;
end $$;

create function public.prep_admin_fb_delete(p_id int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  delete from prep.fb_posts where id = p_id and status in ('draft', 'cancelled', 'failed') and fb_post_id is null;
  if not found then raise exception 'locked'; end if;
end $$;

-- Retry a failed comment (the post itself is never retried by code).
create function public.prep_admin_fb_retry_comment(p_id int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  update prep.fb_posts set comment_status = 'pending', error = null, updated_at = now()
   where id = p_id and status = 'posted' and comment_status = 'failed' and comment_text is not null;
  if not found then raise exception 'locked'; end if;
end $$;

-- ---------- service-role RPCs, used only by the Edge Function ----------
create function public.prep_fb_secret_ok(p_secret text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(length(p_secret) >= 16 and p_secret = (select decrypted_secret from vault.decrypted_secrets where name = 'fb_cron_secret'), false);
$$;

-- Claims the work that is due. Posts: scheduled and due, within the daily limit, at most 3 per run.
-- Comments: posted at least comment_delay_min ago, at most 5 per run. A 'posting' / 'commenting' claim older than
-- 15 minutes never finished: it is marked failed (no automatic retry) so a human checks the page first.
create function public.prep_fb_claim() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  st      prep.fb_settings;
  room    int;
  posts_  jsonb;
  comments_ jsonb;
begin
  select * into st from prep.fb_settings where id = 1;
  update prep.fb_posts
     set status = 'failed', error = 'ไม่ทราบผลการโพสต์ (ฟังก์ชันหยุดกลางทาง) ตรวจที่เพจก่อนว่าโพสต์ขึ้นแล้วหรือยัง', updated_at = now()
   where status = 'posting' and updated_at < now() - interval '15 minutes';
  update prep.fb_posts
     set comment_status = 'failed', error = 'ไม่ทราบผลการคอมเมนต์ (ฟังก์ชันหยุดกลางทาง) ตรวจที่เพจก่อนว่าคอมเมนต์ขึ้นแล้วหรือยัง', updated_at = now()
   where comment_status = 'commenting' and updated_at < now() - interval '15 minutes';
  if not st.enabled then
    return jsonb_build_object('enabled', false, 'posts', '[]'::jsonb, 'comments', '[]'::jsonb);
  end if;
  room := greatest(0, least(3, st.daily_limit - (select count(*) from prep.fb_posts
            where status in ('posting', 'posted') and coalesce(posted_at, updated_at) > now() - interval '24 hours')));

  with c as (
    select id from prep.fb_posts where status = 'scheduled' and scheduled_at <= now()
     order by scheduled_at, id limit room for update skip locked),
  u as (
    update prep.fb_posts p set status = 'posting', updated_at = now() from c where p.id = c.id
    returning p.id, p.caption, p.image_path)
  select coalesce(jsonb_agg(to_jsonb(u) order by u.id), '[]'::jsonb) into posts_ from u;

  with c as (
    select id from prep.fb_posts
     where status = 'posted' and comment_status = 'pending' and comment_text is not null
       and posted_at + make_interval(mins => comment_delay_min) <= now()
     order by posted_at, id limit 5 for update skip locked),
  u as (
    update prep.fb_posts p set comment_status = 'commenting', updated_at = now() from c where p.id = c.id
    returning p.id, p.fb_post_id, p.comment_text as text, p.comment_image_path as image_path)
  select coalesce(jsonb_agg(to_jsonb(u) order by u.id), '[]'::jsonb) into comments_ from u;

  return jsonb_build_object('enabled', true, 'posts', posts_, 'comments', comments_);
end $$;

create function public.prep_fb_post_done(p_id int, p_fb_post_id text) returns void
language sql security definer set search_path = '' as $$
  update prep.fb_posts
     set status = 'posted', fb_post_id = p_fb_post_id, posted_at = now(), error = null, updated_at = now(),
         comment_status = case when comment_text is not null then 'pending' else 'none' end
   where id = p_id and status = 'posting';
$$;
create function public.prep_fb_post_failed(p_id int, p_error text) returns void
language sql security definer set search_path = '' as $$
  update prep.fb_posts set status = 'failed', error = left(p_error, 500), updated_at = now() where id = p_id and status = 'posting';
$$;
create function public.prep_fb_comment_done(p_id int, p_comment_id text) returns void
language sql security definer set search_path = '' as $$
  update prep.fb_posts set comment_status = 'done', fb_comment_id = p_comment_id, commented_at = now(), error = null, updated_at = now()
   where id = p_id and comment_status = 'commenting';
$$;
create function public.prep_fb_comment_failed(p_id int, p_error text) returns void
language sql security definer set search_path = '' as $$
  update prep.fb_posts set comment_status = 'failed', error = left(p_error, 500), updated_at = now()
   where id = p_id and comment_status = 'commenting';
$$;
do $$
declare f text;
begin
  for f in select unnest(array[
      'public.prep_admin_fb_list()', 'public.prep_admin_fb_settings(boolean,int)', 'public.prep_admin_fb_save(jsonb)',
      'public.prep_admin_fb_set_status(int[],text)', 'public.prep_admin_fb_delete(int)', 'public.prep_admin_fb_retry_comment(int)']) loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  for f in select unnest(array[
      'public.prep_fb_secret_ok(text)', 'public.prep_fb_claim()', 'public.prep_fb_post_done(int,text)', 'public.prep_fb_post_failed(int,text)',
      'public.prep_fb_comment_done(int,text)', 'public.prep_fb_comment_failed(int,text)']) loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- ---------- cron: poke the Edge Function every 10 minutes, only while the master switch is on ----------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'fb_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'fb_cron_secret', 'shared secret between pg_cron and prep-fb-agent');
  end if;
end $$;

create function prep.fb_tick() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce((select enabled from prep.fb_settings where id = 1), false) then return; end if;
  perform net.http_post(
    url := 'https://diprxrkddsqmzzihjjwi.supabase.co/functions/v1/prep-fb-agent',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'fb_cron_secret')),
    body := '{"action":"tick"}'::jsonb,
    timeout_milliseconds := 55000);
end $$;
revoke execute on function prep.fb_tick() from public;

select cron.schedule('prep-fb-tick', '*/10 * * * *', 'select prep.fb_tick()');
