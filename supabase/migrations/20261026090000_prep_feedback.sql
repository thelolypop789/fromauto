-- รีวิว / ข้อเสนอแนะ: users rate the app or send an idea or a problem from the account page. Admins read them in
-- แอดมิน → ผู้ใช้ → ข้อเสนอแนะ and may reply; a reply reaches the user as a notification ("ข่าวจากทีมงาน") and under
-- "ข้อเสนอแนะของฉัน". `public_ok` records consent to quote a review (without the email) in marketing.
create table prep.feedback (
  id          int generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete set null,
  kind        text not null check (kind in ('review', 'idea', 'bug')),
  rating      smallint check (rating between 1 and 5),
  body        text not null default '' check (length(body) <= 1000),
  public_ok   boolean not null default false,
  page        text check (length(page) <= 40),
  status      text not null default 'new' check (status in ('new', 'seen', 'done')),
  admin_note  text check (length(admin_note) <= 1000),
  created_at  timestamptz not null default now(),
  replied_at  timestamptz,
  check (kind <> 'review' or rating is not null),
  check (kind = 'review' or length(trim(body)) > 0)
);
create index feedback_status_created on prep.feedback (status, created_at desc);
create index feedback_user on prep.feedback (user_id, created_at desc);
alter table prep.feedback enable row level security;   -- no policies: read and written through the functions below

alter table prep.notifications add column feedback_id int references prep.feedback(id) on delete set null;

create function public.prep_feedback_submit(p_kind text, p_rating int, p_body text, p_public boolean, p_page text default null)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  u  uuid := prep.uid();
  b  text := left(trim(coalesce(p_body, '')), 1000);
  v_id int;
begin
  if u is null then raise exception 'not_signed_in'; end if;
  if p_kind not in ('review', 'idea', 'bug') then raise exception 'invalid_kind'; end if;
  if p_kind = 'review' and (p_rating is null or p_rating not between 1 and 5) then raise exception 'invalid_rating'; end if;
  if p_kind <> 'review' and b = '' then raise exception 'empty_feedback'; end if;
  if (select count(*) from prep.feedback where user_id = u and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too_many_feedback';
  end if;
  insert into prep.feedback (user_id, kind, rating, body, public_ok, page)
  values (u, p_kind, case when p_kind = 'review' then p_rating end, b,
          p_kind = 'review' and coalesce(p_public, false), left(nullif(trim(coalesce(p_page, '')), ''), 40))
  returning feedback.id into v_id;
  return v_id;
end $$;

create function public.prep_my_feedback() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', f.id, 'kind', f.kind, 'rating', f.rating, 'body', f.body, 'status', f.status,
           'admin_note', f.admin_note, 'created_at', f.created_at, 'replied_at', f.replied_at) order by f.created_at desc), '[]'::jsonb)
    from (select * from prep.feedback where user_id = prep.uid() order by created_at desc limit 20) f
$$;

create function public.prep_admin_feedback(p_status text default null, p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return jsonb_build_object(
    'counts', (select jsonb_build_object(
                 'new', count(*) filter (where status = 'new'),
                 'all', count(*),
                 'reviews', count(*) filter (where kind = 'review'),
                 'avg', round(avg(rating) filter (where kind = 'review'), 2))
                 from prep.feedback),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', f.id, 'kind', f.kind, 'rating', f.rating, 'body', f.body, 'public_ok', f.public_ok, 'page', f.page,
               'status', f.status, 'admin_note', f.admin_note, 'created_at', f.created_at, 'replied_at', f.replied_at,
               'email', au.email, 'packages', prep.active_packages(f.user_id)) order by f.created_at desc)
        from (select * from prep.feedback where p_status is null or status = p_status
               order by created_at desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) f
        left join auth.users au on au.id = f.user_id), '[]'::jsonb));
end $$;

-- Sets the status; a new or changed reply also notifies the user.
create function public.prep_admin_feedback_set(p_id int, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  f prep.feedback;
  n text := nullif(left(trim(coalesce(p_note, '')), 1000), '');
begin
  perform prep.require_admin();
  if p_status not in ('new', 'seen', 'done') then raise exception 'invalid_status'; end if;
  select * into f from prep.feedback where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  update prep.feedback
     set status = p_status,
         admin_note = coalesce(n, admin_note),
         replied_at = case when n is not null and n is distinct from f.admin_note then now() else replied_at end
   where id = p_id;
  if n is not null and n is distinct from f.admin_note and f.user_id is not null then
    insert into prep.notifications (user_id, kind, title, body, feedback_id)
    values (f.user_id, 'feedback_reply',
            case f.kind when 'review' then 'ทีมงานตอบรีวิวของคุณ' when 'bug' then 'ทีมงานตอบเรื่องที่คุณแจ้ง' else 'ทีมงานตอบข้อเสนอแนะของคุณ' end,
            n, p_id);
  end if;
end $$;

do $$
declare f text;
begin
  for f in select unnest(array[
      'public.prep_feedback_submit(text,integer,text,boolean,text)', 'public.prep_my_feedback()',
      'public.prep_admin_feedback(text,integer)', 'public.prep_admin_feedback_set(integer,text,text)']) loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
