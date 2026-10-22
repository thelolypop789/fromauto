-- Leaderboards and community stats. Everyone appears under an anonymous handle ("นักสู้ #A3F2") unless they chose a
-- nickname; they can also hide completely. Admin accounts are never ranked. Aggregates only; no emails leave the database.
--
-- Boards: xp (level), correct, answered, accuracy (min answers), streak (current), mock (best mock score %).
-- Periods: week (Mon-Sun, Thai time), month (last 30 days), all.

alter table prep.profiles add column nickname text check (nickname is null or char_length(nickname) between 2 and 16),
                          add column board_hidden boolean not null default false;

create function public.prep_board_profile() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('nickname', p.nickname, 'hidden', p.board_hidden, 'handle', 'นักสู้ #' || upper(left(md5(p.user_id::text), 4)))
    from prep.profiles p where p.user_id = prep.uid()
$$;

-- Nickname: Thai/English letters, digits, space, dot, dash, underscore; no links. Empty = back to the anonymous handle.
create function public.prep_set_board_profile(p_nickname text, p_hidden boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.uid(); n text := nullif(trim(coalesce(p_nickname, '')), '');
begin
  perform prep.lock_profile(u);
  if n is not null and (char_length(n) not between 2 and 16 or n !~ '^[ก-๙A-Za-z0-9 ._-]+$' or n ~* '(http|www|\.com|line)') then
    raise exception 'bad_nickname';
  end if;
  update prep.profiles set nickname = n, board_hidden = coalesce(p_hidden, false) where user_id = u;
  return public.prep_board_profile();
end $$;

create function public.prep_admin_clear_nickname(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  update prep.profiles set nickname = null where user_id = p_user;
end $$;

-- XP exactly as prep_progress: answers + correct answers + 20 per finished daily quiz + 50 per submitted mock.
create function prep.user_xp(u uuid) returns bigint
language sql stable set search_path = '' as $$
  select coalesce((select sum(answered + correct) from prep.daily_activity where user_id = u), 0)
       + 20 * (select count(*) from prep.daily_answers x where x.user_id = u and not exists (select 1 from unnest(x.answers) v where v is null))
       + 50 * (select count(*) from prep.mock_attempts where user_id = u and submitted_at is not null)
$$;

create function public.prep_leaderboard(p_board text, p_period text default 'week') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me     uuid := prep.uid();
  today  date := prep.today();
  d0     date := case p_period when 'week' then today - ((extract(isodow from today)::int) - 1)
                               when 'month' then today - 29 else date '2000-01-01' end;
  minans int  := case p_period when 'week' then 30 else 100 end;
  is_admin boolean := exists (select 1 from prep.admins a where a.user_id = prep.uid());   -- only admins get user ids (to clear a nickname)
  out    jsonb;
begin
  if p_board not in ('xp', 'correct', 'answered', 'accuracy', 'streak', 'mock') then raise exception 'bad_board'; end if;
  if p_period not in ('week', 'month', 'all') then raise exception 'bad_period'; end if;

  with pool as (select p.user_id, p.nickname, p.board_hidden from prep.profiles p
                 where not exists (select 1 from prep.admins a where a.user_id = p.user_id)),
  act as (select user_id, sum(answered) as answered, sum(correct) as correct from prep.daily_activity
           where day >= d0 group by user_id),
  runs as (select user_id, day, day - (row_number() over (partition by user_id order by day))::int as grp
             from prep.daily_activity where answered > 0),
  streaks as (select user_id, count(*) as n, max(day) as last from runs group by user_id, grp),
  cur_streak as (select user_id, max(n) as n from streaks where last >= today - 1 group by user_id),
  mock as (select user_id, max(round(100.0 * score / greatest(cardinality(question_ids), 1)))::int as best
             from prep.mock_attempts where submitted_at is not null and score is not null
              and (submitted_at at time zone 'Asia/Bangkok')::date >= d0
              and exists (select 1 from unnest(answers) v where v is not null) group by user_id),
  vals as (
    select p.user_id, p.nickname, p.board_hidden,
           coalesce(act.answered, 0) as answered, coalesce(act.correct, 0) as correct,
           case p_board
             when 'xp' then case when p_period = 'all' then prep.user_xp(p.user_id)
                                 else coalesce(act.answered, 0) + coalesce(act.correct, 0)
                                    + 20 * (select count(*) from prep.daily_answers x where x.user_id = p.user_id and x.day >= d0
                                              and not exists (select 1 from unnest(x.answers) v where v is null))
                                    + 50 * (select count(*) from prep.mock_attempts m where m.user_id = p.user_id and m.submitted_at is not null
                                              and (m.submitted_at at time zone 'Asia/Bangkok')::date >= d0) end
             when 'correct' then coalesce(act.correct, 0)
             when 'answered' then coalesce(act.answered, 0)
             when 'accuracy' then case when coalesce(act.answered, 0) >= minans then round(100.0 * act.correct / act.answered, 1) end
             when 'streak' then cs.n
             when 'mock' then mock.best end as v
      from pool p left join act on act.user_id = p.user_id left join cur_streak cs on cs.user_id = p.user_id
      left join mock on mock.user_id = p.user_id),
  ranked as (
    select vals.*, rank() over (order by v desc, answered desc) as rk from vals where v is not null and v > 0),
  shown as (select * from ranked where not board_hidden or user_id = me)
  select jsonb_build_object(
    'board', p_board, 'period', p_period, 'min_answers', case when p_board = 'accuracy' then minans end,
    'players', (select count(*) from ranked where not board_hidden),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
              'rank', r.rk, 'name', coalesce(r.nickname, 'นักสู้ #' || upper(left(md5(r.user_id::text), 4))),
              'value', r.v, 'xp', prep.user_xp(r.user_id), 'you', r.user_id = me,
              'uid', case when is_admin then r.user_id end) order by r.rk, r.answered desc)
              from (select * from shown where not board_hidden order by rk, answered desc limit 20) r), '[]'::jsonb),
    'me', (select jsonb_build_object('rank', r.rk, 'value', r.v, 'hidden', r.board_hidden) from ranked r where r.user_id = me))
  into out;
  return out;
end $$;

-- Interesting numbers for the board page: today, this week, the most popular majors, the longest streaks.
create function public.prep_community_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare today date := prep.today(); w0 date := today - ((extract(isodow from today)::int) - 1);
begin
  return jsonb_build_object(
    'users', (select count(*) from prep.profiles),
    'active_today', (select count(*) from prep.daily_activity where day = today and answered > 0),
    'answers_today', coalesce((select sum(answered) from prep.daily_activity where day = today), 0),
    'answers_week', coalesce((select sum(answered) from prep.daily_activity where day >= w0), 0),
    'answers_total', coalesce((select sum(answered) from prep.daily_activity), 0),
    'accuracy_week', (select round(100.0 * sum(correct) / nullif(sum(answered), 0)) from prep.daily_activity where day >= w0),
    'daily_done_today', (select count(*) from prep.daily_answers x where x.day = today and not exists (select 1 from unnest(x.answers) v where v is null)),
    'mocks_week', (select count(*) from prep.mock_attempts where submitted_at is not null and (submitted_at at time zone 'Asia/Bangkok')::date >= w0),
    'top_majors', coalesce((
      select jsonb_agg(jsonb_build_object('name', x.name, 'answers', x.n) order by x.n desc)
        from (select t.name, sum(d.answered)::int as n
                from prep.daily_activity d join prep.profiles p on p.user_id = d.user_id join prep.topics t on t.code = p.major
               where d.day >= w0 and not exists (select 1 from prep.admins a where a.user_id = d.user_id)
               group by t.name order by 2 desc limit 3) x), '[]'::jsonb),
    'hardest_topic', (select jsonb_build_object('name', x.name, 'pct', x.pct)
                        from (select t.name, round(100.0 * sum(s.correct) / sum(s.n))::int as pct
                                from prep.user_topic_stats s join prep.topics t on t.code = s.topic
                               group by t.name having sum(s.n) >= 300 order by 2 limit 1) x),
    'easiest_topic', (select jsonb_build_object('name', x.name, 'pct', x.pct)
                        from (select t.name, round(100.0 * sum(s.correct) / sum(s.n))::int as pct
                                from prep.user_topic_stats s join prep.topics t on t.code = s.topic
                               group by t.name having sum(s.n) >= 300 order by 2 desc limit 1) x));
end $$;

-- new event for the board page
create or replace function public.prep_track(p_name text, p_props jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  u   uuid := prep.uid();
  v_src text;
begin
  if p_name not in ('visit', 'buy_view', 'free_limit', 'level_view', 'readiness_view', 'subtopic_pick', 'promo_apply', 'scoredist_view', 'board_view') then
    raise exception 'invalid_event';
  end if;
  perform prep.lock_profile(u);
  if p_name = 'visit' then
    v_src := nullif(left(regexp_replace(lower(coalesce(p_props->>'src', '')), '[^a-z0-9_-]', '', 'g'), 40), '');
    if v_src is not null then update prep.profiles set src = v_src where user_id = u and profiles.src is null; end if;
  end if;
  insert into prep.events (user_id, name, props)
  values (u, p_name, case when p_name = 'visit' and v_src is not null then jsonb_build_object('src', v_src) else '{}'::jsonb end)
  on conflict (user_id, name, day) do nothing;
end $$;

revoke execute on function prep.user_xp(uuid) from public;
do $$
declare f text;
begin
  for f in select unnest(array['public.prep_board_profile()', 'public.prep_set_board_profile(text,boolean)', 'public.prep_admin_clear_nickname(uuid)',
                               'public.prep_leaderboard(text,text)', 'public.prep_community_stats()', 'public.prep_track(text,jsonb)']) loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- the comparison dashboard also counts people who opened the leaderboard
CREATE OR REPLACE FUNCTION public.prep_admin_compare(p_days integer DEFAULT 14, p_mark date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  today date := prep.today();
  n int; c0 date; c1 date; p0 date; p1 date;
  ev text[] := array['level_view', 'readiness_view', 'subtopic_pick', 'promo_apply', 'scoredist_view', 'buy_view', 'board_view'];
begin
  perform prep.require_admin();
  if p_mark is not null and p_mark <= today then
    c0 := p_mark; c1 := today; n := least(c1 - c0 + 1, 90); c0 := c1 - (n - 1);
  else
    n := least(greatest(coalesce(p_days, 14), 3), 90); c1 := today; c0 := c1 - (n - 1);
  end if;
  p1 := c0 - 1; p0 := p1 - (n - 1);

  return jsonb_build_object(
    'range', jsonb_build_object('mode', case when p_mark is null then 'previous' else 'mark' end, 'n', n,
                                'cur_from', c0, 'cur_to', c1, 'prev_from', p0, 'prev_to', p1),
    'cur', prep.range_totals(c0, c1),
    'prev', prep.range_totals(p0, p1),
    'series', (select jsonb_agg(jsonb_build_object('i', g.i, 'cur_day', c0 + g.i, 'prev_day', p0 + g.i,
                                                    'cur', prep.day_metrics(c0 + g.i), 'prev', prep.day_metrics(p0 + g.i)) order by g.i)
                 from generate_series(0, n - 1) g(i)),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('src', x.src, 'users', x.users, 'buyers', x.buyers, 'revenue', x.revenue,
                                          'prev_users', x.prev_users, 'prev_buyers', x.prev_buyers) order by x.users desc, x.revenue desc)
        from (select coalesce(p.src, '(ไม่ทราบ)') as src,
                     count(*) filter (where (p.created_at at time zone 'Asia/Bangkok')::date between c0 and c1) as users,
                     count(*) filter (where (p.created_at at time zone 'Asia/Bangkok')::date between c0 and c1
                                        and exists (select 1 from prep.orders o where o.user_id = p.user_id and o.status = 'approved')) as buyers,
                     coalesce(sum((select sum(o.amount) from prep.orders o where o.user_id = p.user_id and o.status = 'approved')::int)
                              filter (where (p.created_at at time zone 'Asia/Bangkok')::date between c0 and c1), 0) as revenue,
                     count(*) filter (where (p.created_at at time zone 'Asia/Bangkok')::date between p0 and p1) as prev_users,
                     count(*) filter (where (p.created_at at time zone 'Asia/Bangkok')::date between p0 and p1
                                        and exists (select 1 from prep.orders o where o.user_id = p.user_id and o.status = 'approved')) as prev_buyers
                from prep.profiles p
               where (p.created_at at time zone 'Asia/Bangkok')::date between p0 and c1
               group by 1) x
       where x.users + x.prev_users > 0), '[]'::jsonb),
    'features', (select jsonb_object_agg(e.name, jsonb_build_object(
                   'cur',  (select count(distinct v.user_id) from prep.events v where v.name = e.name and v.day between c0 and c1),
                   'prev', (select count(distinct v.user_id) from prep.events v where v.name = e.name and v.day between p0 and p1),
                   'first_day', (select min(v.day) from prep.events v where v.name = e.name)))
                   from unnest(ev) as e(name)),
    'promo', jsonb_build_object(
      'orders_cur',  (select count(*) from prep.orders o where o.promo_code is not null and o.status in ('pending', 'approved')
                       and (o.created_at at time zone 'Asia/Bangkok')::date between c0 and c1),
      'orders_prev', (select count(*) from prep.orders o where o.promo_code is not null and o.status in ('pending', 'approved')
                       and (o.created_at at time zone 'Asia/Bangkok')::date between p0 and p1),
      'discount_cur', coalesce((select sum(o.discount) from prep.orders o where o.promo_code is not null and o.status = 'approved'
                       and (o.reviewed_at at time zone 'Asia/Bangkok')::date between c0 and c1), 0)),
    'marks', coalesce((select jsonb_agg(jsonb_build_object('day', m.day, 'label', m.label) order by m.day)
                         from prep.release_marks m where m.day between p0 and c1), '[]'::jsonb),
    'all_marks', coalesce((select jsonb_agg(jsonb_build_object('day', m.day, 'label', m.label) order by m.day desc) from prep.release_marks m), '[]'::jsonb),
    'snapshots', coalesce((select jsonb_agg(jsonb_build_object('day', s.day, 'users', s.users_total, 'paid', s.paid_total,
                                                               'majors', s.major_total, 'approved', s.approved_total, 'tagged', s.tagged_total)
                                            order by s.day)
                             from prep.daily_snapshot s where s.day between p0 and c1), '[]'::jsonb));
end $function$;
