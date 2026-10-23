-- Facebook posts with several pictures: image_path stays the first picture, extra_images holds the rest (up to 9 more,
-- Facebook's limit for one post is 10). The agent posts them as one multi-photo post (unpublished photos + attached_media).
alter table prep.fb_posts add column extra_images text[] not null default '{}'
  check (cardinality(extra_images) <= 9);

create or replace function public.prep_admin_fb_save(p_post jsonb) returns integer
language plpgsql security definer set search_path = '' as $function$
declare
  id_    int := nullif(p_post ->> 'id', '')::int;
  cur    prep.fb_posts;
  cap    text := coalesce(p_post ->> 'caption', '');
  ctext  text := nullif(trim(coalesce(p_post ->> 'comment_text', '')), '');
  delay  int  := coalesce(nullif(p_post ->> 'comment_delay_min', '')::int, 150);
  at_    timestamptz := nullif(p_post ->> 'scheduled_at', '')::timestamptz;
  img    text := nullif(p_post ->> 'image_path', '');
  cimg   text := nullif(p_post ->> 'comment_image_path', '');
  extra  text[] := coalesce((select array_agg(x) from jsonb_array_elements_text(
                     case when jsonb_typeof(p_post -> 'extra_images') = 'array' then p_post -> 'extra_images' else '[]'::jsonb end) x
                     where x <> ''), '{}');
begin
  perform prep.require_admin();
  if length(trim(coalesce(p_post ->> 'title', ''))) = 0 then raise exception 'empty_title'; end if;
  if length(cap) > 8000 or length(coalesce(ctext, '')) > 8000 then raise exception 'too_long'; end if;
  if delay < 0 or delay > 1440 then raise exception 'bad_delay'; end if;
  if img is not null and (img !~ '^[A-Za-z0-9._/-]{1,200}$' or img like '%..%' or img like '/%') then raise exception 'bad_path'; end if;
  if cimg is not null and (cimg !~ '^[A-Za-z0-9._/-]{1,200}$' or cimg like '%..%' or cimg like '/%') then raise exception 'bad_path'; end if;
  if cardinality(extra) > 9 then raise exception 'too_many_images'; end if;
  if exists (select 1 from unnest(extra) x where x !~ '^[A-Za-z0-9._/-]{1,200}$' or x like '%..%' or x like '/%') then raise exception 'bad_path'; end if;
  -- extra pictures only make sense after a first one
  if img is null and cardinality(extra) > 0 then img := extra[1]; extra := extra[2:]; end if;
  if length(trim(cap)) = 0 and img is null then raise exception 'empty_post'; end if;

  if id_ is null then
    insert into prep.fb_posts (title, caption, image_path, extra_images, comment_text, comment_image_path, comment_delay_min, scheduled_at)
    values (trim(p_post ->> 'title'), cap, img, extra, ctext, cimg, delay, at_)
    returning prep.fb_posts.id into id_;
    return id_;
  end if;

  select * into cur from prep.fb_posts where prep.fb_posts.id = id_ for update;
  if not found then raise exception 'not_found'; end if;
  if cur.status in ('posting', 'posted') then raise exception 'locked'; end if;
  update prep.fb_posts
     set title = trim(p_post ->> 'title'), caption = cap, image_path = img, extra_images = extra, comment_text = ctext,
         comment_image_path = cimg, comment_delay_min = delay, scheduled_at = at_, updated_at = now()
   where prep.fb_posts.id = id_;
  return id_;
end $function$;

CREATE OR REPLACE FUNCTION public.prep_fb_claim()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    returning p.id, p.caption, p.image_path, p.extra_images)
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
end $function$;
