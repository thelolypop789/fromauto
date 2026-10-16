-- Exam calendar managed by the admin (application window, exam day, results, other notices).
--  * prep.exam_events + prep_exam_calendar(): what signed-in users see (published events near today).
--  * prep_admin_events / prep_admin_event_save / prep_admin_event_delete: admin CRUD.
--  * prep_plan(): the countdown now comes from the next published event of kind 'exam' (no longer a date each user types).
--    prep_set_goal(goal) replaces prep_set_plan for the daily goal; prep_set_plan stays as a compatible wrapper that ignores the date.

create table if not exists prep.exam_events (
  id         int generated always as identity primary key,
  title      text not null check (length(title) between 1 and 120),
  kind       text not null default 'other' check (kind in ('apply', 'exam', 'result', 'other')),
  starts_on  date not null,
  ends_on    date,
  note       text check (note is null or length(note) <= 500),
  link       text check (link is null or (link ~ '^https://' and length(link) <= 300)),
  published  boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on),
  check (starts_on between date '2025-01-01' and date '2035-12-31')
);
create index if not exists exam_events_start on prep.exam_events (starts_on);
alter table prep.exam_events enable row level security;

create or replace function public.prep_exam_calendar() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare t date := prep.today();
begin
  perform prep.uid();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'kind', kind, 'starts_on', starts_on, 'ends_on', ends_on,
                                        'note', note, 'link', link, 'days_to', starts_on - t) order by starts_on, id)
      from prep.exam_events
     where published and coalesce(ends_on, starts_on) >= t - 60 and starts_on <= t + 540), '[]'::jsonb);
end $$;

create or replace function public.prep_admin_events() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'kind', kind, 'starts_on', starts_on, 'ends_on', ends_on,
                                                       'note', note, 'link', link, 'published', published) order by starts_on desc, id desc)
                     from prep.exam_events), '[]'::jsonb);
end $$;

create or replace function public.prep_admin_event_save(
  p_id int, p_title text, p_kind text, p_starts date, p_ends date, p_note text, p_link text, p_published boolean
) returns int
language plpgsql security definer set search_path = '' as $$
declare
  a uuid := prep.require_admin();
  rid int;
  t text := trim(coalesce(p_title, ''));
begin
  if length(t) = 0 or length(t) > 120 then raise exception 'invalid_title'; end if;
  if p_kind not in ('apply', 'exam', 'result', 'other') then raise exception 'invalid_kind'; end if;
  if p_starts is null or p_starts not between date '2025-01-01' and date '2035-12-31' then raise exception 'invalid_date'; end if;
  if p_ends is not null and p_ends < p_starts then raise exception 'invalid_date'; end if;
  if nullif(trim(coalesce(p_link, '')), '') is not null and (trim(p_link) !~ '^https://' or length(trim(p_link)) > 300) then raise exception 'invalid_link'; end if;
  if p_id is null then
    insert into prep.exam_events (title, kind, starts_on, ends_on, note, link, published, created_by)
    values (t, p_kind, p_starts, p_ends, nullif(left(trim(coalesce(p_note, '')), 500), ''), nullif(trim(coalesce(p_link, '')), ''), coalesce(p_published, true), a)
    returning id into rid;
  else
    update prep.exam_events set title = t, kind = p_kind, starts_on = p_starts, ends_on = p_ends,
           note = nullif(left(trim(coalesce(p_note, '')), 500), ''), link = nullif(trim(coalesce(p_link, '')), ''), published = coalesce(p_published, true)
     where id = p_id returning id into rid;
    if rid is null then raise exception 'not_found'; end if;
  end if;
  return rid;
end $$;

create or replace function public.prep_admin_event_delete(p_id int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  delete from prep.exam_events where id = p_id;
  if not found then raise exception 'not_found'; end if;
end $$;

create or replace function public.prep_plan() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p     prep.profiles := prep.lock_profile(prep.uid());
  today date := prep.today();
  d     date;
  n     int := 0;
  ev    prep.exam_events;
begin
  d := case when exists (select 1 from prep.daily_activity where user_id = p.user_id and day = today and answered > 0) then today else today - 1 end;
  while exists (select 1 from prep.daily_activity where user_id = p.user_id and day = d and answered > 0) and n < 1000 loop
    n := n + 1; d := d - 1;
  end loop;
  select * into ev from prep.exam_events where published and kind = 'exam' and coalesce(ends_on, starts_on) >= today order by starts_on, id limit 1;
  return jsonb_build_object(
    'exam_title', ev.title,
    'exam_date', ev.starts_on,
    'daily_goal', p.daily_goal,
    'days_left', case when ev.id is null then null else greatest(ev.starts_on - today, 0) end,
    'answered_today', coalesce((select answered from prep.daily_activity where user_id = p.user_id and day = today), 0),
    'streak', n);
end $$;

create or replace function public.prep_set_goal(p_goal int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.uid();
begin
  if p_goal is null or p_goal not between 10 and 300 then raise exception 'invalid_goal'; end if;
  perform prep.lock_profile(u);
  update prep.profiles set daily_goal = p_goal where user_id = u;
  return public.prep_plan();
end $$;

-- Old signature kept for browsers still running the previous build: only the goal is used.
create or replace function public.prep_set_plan(p_exam_date date, p_goal int) returns jsonb
language sql security definer set search_path = '' as $$ select public.prep_set_goal(p_goal) $$;

revoke execute on function public.prep_exam_calendar() from public, anon;
grant execute on function public.prep_exam_calendar() to authenticated;
revoke execute on function public.prep_admin_events() from public, anon;
grant execute on function public.prep_admin_events() to authenticated;
revoke execute on function public.prep_admin_event_save(int, text, text, date, date, text, text, boolean) from public, anon;
grant execute on function public.prep_admin_event_save(int, text, text, date, date, text, text, boolean) to authenticated;
revoke execute on function public.prep_admin_event_delete(int) from public, anon;
grant execute on function public.prep_admin_event_delete(int) to authenticated;
revoke execute on function public.prep_set_goal(int) from public, anon;
grant execute on function public.prep_set_goal(int) to authenticated;
