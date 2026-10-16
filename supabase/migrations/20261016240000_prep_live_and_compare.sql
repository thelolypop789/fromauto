-- Live traffic + comparison charts.
--  * prep.presence / prep.presence_log: a signed-in app sends prep_ping() about once a minute while the tab is visible.
--    presence keeps the last time per user; presence_log keeps one row per user per 10-minute bucket (pruned after 14 days).
--  * prep_admin_live(): who is online now, rounds in progress, a 24h line of concurrent users, rounds finished per hour.
--  * prep_admin_user_stats(user): one user's last 30 days, topics vs everyone's average, mock results vs average.
--  * prep_admin_charts: adds 'totals' and 'previous' (the equal window before) so the tab can show up/down changes.

create table if not exists prep.presence (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  last_seen timestamptz not null default now()
);
create table if not exists prep.presence_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket  timestamptz not null,
  primary key (bucket, user_id)
);
alter table prep.presence enable row level security;
alter table prep.presence_log enable row level security;

create or replace function public.prep_ping() returns void
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := prep.uid();
  b timestamptz := to_timestamp(floor(extract(epoch from now()) / 600) * 600);
begin
  insert into prep.presence (user_id, last_seen) values (u, now())
  on conflict (user_id) do update set last_seen = now() where prep.presence.last_seen < now() - interval '20 seconds';
  insert into prep.presence_log (user_id, bucket) values (u, b) on conflict do nothing;
  if random() < 0.01 then delete from prep.presence_log where bucket < now() - interval '14 days'; end if;
end $$;

create or replace function public.prep_admin_live() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  b_now timestamptz := to_timestamp(floor(extract(epoch from now()) / 600) * 600);
begin
  perform prep.require_admin();
  return jsonb_build_object(
    'now', now(),
    'online_now', (select count(*) from prep.presence where last_seen > now() - interval '2 minutes'),
    'online_15m', (select count(*) from prep.presence where last_seen > now() - interval '15 minutes'),
    'rounds_in_progress', (select count(*) from prep.attempts where submitted_at is null and started_at > now() - interval '2 hours')
                          + (select count(*) from prep.mock_attempts where submitted_at is null and deadline > now()),
    'rounds_last_hour', (select count(*) from prep.attempts where submitted_at > now() - interval '1 hour')
                        + (select count(*) from prep.mock_attempts where submitted_at > now() - interval '1 hour'),
    'signups_today', (select count(*) from prep.profiles where (created_at at time zone 'Asia/Bangkok')::date = prep.today()),
    'peak_today', (select jsonb_build_object('users', c, 'at', bucket) from (
                     select bucket, count(*) c from prep.presence_log
                      where (bucket at time zone 'Asia/Bangkok')::date = prep.today()
                      group by bucket order by c desc, bucket desc limit 1) x),
    'users24', (select jsonb_agg(jsonb_build_object('t', g.t, 'users', coalesce(l.c, 0)) order by g.t)
                  from generate_series(b_now - interval '23 hours 50 minutes', b_now, interval '10 minutes') g(t)
                  left join (select bucket, count(*) c from prep.presence_log
                              where bucket >= b_now - interval '24 hours' group by bucket) l on l.bucket = g.t),
    'rounds24', (select jsonb_agg(jsonb_build_object('t', g.t, 'rounds', coalesce(r.c, 0)) order by g.t)
                   from generate_series(date_trunc('hour', now()) - interval '23 hours', date_trunc('hour', now()), interval '1 hour') g(t)
                   left join (select h, count(*) c from (
                                select date_trunc('hour', submitted_at) h from prep.attempts where submitted_at >= now() - interval '25 hours'
                                union all
                                select date_trunc('hour', submitted_at) from prep.mock_attempts where submitted_at >= now() - interval '25 hours') s
                              group by h) r on r.h = g.t));
end $$;

create or replace function public.prep_admin_user_stats(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare d_end date := prep.today();
begin
  perform prep.require_admin();
  return jsonb_build_object(
    'days', (select jsonb_agg(jsonb_build_object('day', g.d, 'answered', coalesce(a.answered, 0), 'correct', coalesce(a.correct, 0)) order by g.d)
               from generate_series(d_end - 29, d_end, interval '1 day') as g(d)
               left join prep.daily_activity a on a.user_id = p_user and a.day = g.d),
    'overall', jsonb_build_object(
      'user_n', coalesce((select sum(n) from prep.user_topic_stats where user_id = p_user), 0),
      'user_correct', coalesce((select sum(correct) from prep.user_topic_stats where user_id = p_user), 0),
      'all_n', coalesce((select sum(n) from prep.user_topic_stats), 0),
      'all_correct', coalesce((select sum(correct) from prep.user_topic_stats), 0)),
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object('topic', name, 'n', n, 'pct', pct, 'avg_pct', avg_pct) order by n desc)
        from (select t.name, s.n, round(100.0 * s.correct / nullif(s.n, 0))::int pct,
                     (select round(100.0 * sum(x.correct) / nullif(sum(x.n), 0))::int from prep.user_topic_stats x where x.topic = s.topic) avg_pct
                from prep.user_topic_stats s join prep.topics t on t.code = s.topic
               where s.user_id = p_user and s.n >= 5 order by s.n desc limit 12) z), '[]'::jsonb),
    'mock', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'pct', pct, 'avg_pct', avg_pct, 'at', at) order by at desc)
        from (select m.name, round(100.0 * a.score / cardinality(a.question_ids))::int pct, a.submitted_at at,
                     (select round(avg(100.0 * y.score / cardinality(y.question_ids)))::int from prep.mock_attempts y
                       where y.subject = a.subject and y.submitted_at is not null and y.score is not null) avg_pct
                from prep.mock_attempts a join prep.mock_subjects m on m.code = a.subject
               where a.user_id = p_user and a.submitted_at is not null and a.score is not null
               order by a.submitted_at desc limit 8) w), '[]'::jsonb));
end $$;

create or replace function public.prep_admin_charts(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_n   int := least(greatest(coalesce(p_days, 30), 7), 90);
  d_end date := prep.today();
  d0    date;
  t0    timestamptz;
begin
  perform prep.require_admin();
  d0 := d_end - (v_n - 1);
  t0 := d0::timestamp at time zone 'Asia/Bangkok';
  return jsonb_build_object(
    'days', v_n,
    'totals', (select jsonb_build_object(
                 'new_users', (select count(*) from prep.profiles p where p.created_at >= t0),
                 'active_users', (select count(distinct a.user_id) from prep.daily_activity a where a.day between d0 and d_end),
                 'answers', coalesce((select sum(a.answered) from prep.daily_activity a where a.day between d0 and d_end), 0),
                 'revenue', coalesce((select sum(o.amount) from prep.orders o where o.status = 'approved'
                                       and (o.reviewed_at at time zone 'Asia/Bangkok')::date between d0 and d_end), 0))),
    'previous', (select jsonb_build_object(
                 'new_users', (select count(*) from prep.profiles p
                                where (p.created_at at time zone 'Asia/Bangkok')::date between d0 - v_n and d0 - 1),
                 'active_users', (select count(distinct a.user_id) from prep.daily_activity a where a.day between d0 - v_n and d0 - 1),
                 'answers', coalesce((select sum(a.answered) from prep.daily_activity a where a.day between d0 - v_n and d0 - 1), 0),
                 'revenue', coalesce((select sum(o.amount) from prep.orders o where o.status = 'approved'
                                       and (o.reviewed_at at time zone 'Asia/Bangkok')::date between d0 - v_n and d0 - 1), 0))),
    'series', (
      select jsonb_agg(jsonb_build_object(
               'day', g.d,
               'new_users', (select count(*) from prep.profiles p where (p.created_at at time zone 'Asia/Bangkok')::date = g.d),
               'active_users', (select count(*) from prep.daily_activity a where a.day = g.d),
               'answers', coalesce((select sum(a.answered) from prep.daily_activity a where a.day = g.d), 0),
               'revenue', coalesce((select sum(o.amount) from prep.orders o
                                     where o.status = 'approved' and (o.reviewed_at at time zone 'Asia/Bangkok')::date = g.d), 0)
             ) order by g.d)
        from generate_series(d0, d_end, interval '1 day') as g(d)),
    'funnel', (
      with cohort as (select user_id from prep.profiles where created_at >= t0),
      ords as (select distinct user_id from prep.orders),
      paid as (select distinct user_id from prep.orders where status = 'approved')
      select jsonb_build_array(
        jsonb_build_object('step', 'สมัคร/เข้าแอปครั้งแรก', 'n', (select count(*) from cohort)),
        jsonb_build_object('step', 'สร้างชุดฝึกแล้ว', 'n', (select count(*) from cohort c where exists (select 1 from prep.sets s where s.user_id = c.user_id))),
        jsonb_build_object('step', 'เปิดหน้าซื้อ', 'n', (select count(*) from cohort c where exists (select 1 from prep.events e where e.user_id = c.user_id and e.name = 'buy_view')
                                                           or c.user_id in (select user_id from ords))),
        jsonb_build_object('step', 'ส่งสลิป', 'n', (select count(*) from cohort c where c.user_id in (select user_id from ords))),
        jsonb_build_object('step', 'ซื้อสำเร็จ', 'n', (select count(*) from cohort c where c.user_id in (select user_id from paid))))),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('src', s, 'users', users, 'paid', paid) order by users desc)
        from (select coalesce(p.src, '(ไม่ระบุ)') s, count(*) users,
                     count(*) filter (where exists (select 1 from prep.orders o where o.user_id = p.user_id and o.status = 'approved')) paid
                from prep.profiles p where p.created_at >= t0 group by 1 order by 2 desc limit 12) x), '[]'::jsonb),
    'retention', jsonb_build_object(
      'd1_users', (select count(*) from prep.profiles p where (p.created_at at time zone 'Asia/Bangkok')::date between d0 and d_end - 1),
      'd1_back',  (select count(*) from prep.profiles p where (p.created_at at time zone 'Asia/Bangkok')::date between d0 and d_end - 1
                      and exists (select 1 from prep.daily_activity a where a.user_id = p.user_id and a.day = (p.created_at at time zone 'Asia/Bangkok')::date + 1)),
      'd7_users', (select count(*) from prep.profiles p where (p.created_at at time zone 'Asia/Bangkok')::date between d0 and d_end - 7),
      'd7_back',  (select count(*) from prep.profiles p where (p.created_at at time zone 'Asia/Bangkok')::date between d0 and d_end - 7
                      and exists (select 1 from prep.daily_activity a where a.user_id = p.user_id and a.day = (p.created_at at time zone 'Asia/Bangkok')::date + 7))),
    'weak_topics', coalesce((
      select jsonb_agg(jsonb_build_object('topic', name, 'n', n, 'pct', pct) order by pct)
        from (select t.name, sum(s.n)::int n, round(100.0 * sum(s.correct) / sum(s.n))::int pct
                from prep.user_topic_stats s join prep.topics t on t.code = s.topic
               group by t.name having sum(s.n) >= 30 order by 3 limit 10) x), '[]'::jsonb),
    'tricky', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'topic', topic, 'stem', stem, 'n', n, 'pct', pct,
                                          'wrong_choice', wrong_choice, 'wrong_pct', wrong_pct) order by pct)
        from (select q.id, t.name topic, q.stem, s.n, round(100.0 * s.correct / s.n)::int pct,
                     q.choices->>(w.i - 1) wrong_choice, round(100.0 * s.choice_counts[w.i] / s.n)::int wrong_pct
                from prep.question_stats s
                join prep.questions q on q.id = s.question_id join prep.topics t on t.code = q.topic
                cross join lateral (select g as i from generate_series(1, 4) g where g <> q.answer + 1
                                     order by s.choice_counts[g] desc limit 1) w
               where q.status = 'approved' and s.n >= 10
               order by s.correct::numeric / s.n limit 10) x), '[]'::jsonb),
    'mock', coalesce((
      select jsonb_agg(jsonb_build_object('code', code, 'name', name, 'started', started, 'submitted', submitted,
                                          'auto', auto, 'avg_pct', avg_pct) order by sort)
        from (select m.code, m.name, m.sort, count(a.id) started, count(a.id) filter (where a.submitted_at is not null) submitted,
                     count(a.id) filter (where a.submitted_at >= a.deadline - interval '2 seconds') auto,
                     round(avg(100.0 * a.score / cardinality(a.question_ids)) filter (where a.score is not null))::int avg_pct
                from prep.mock_subjects m left join prep.mock_attempts a on a.subject = m.code and a.started_at >= t0
               group by m.code, m.name, m.sort) x), '[]'::jsonb));
end $$;

revoke execute on function public.prep_ping() from public, anon;
grant execute on function public.prep_ping() to authenticated;
revoke execute on function public.prep_admin_live() from public, anon;
grant execute on function public.prep_admin_live() to authenticated;
revoke execute on function public.prep_admin_user_stats(uuid) from public, anon;
grant execute on function public.prep_admin_user_stats(uuid) to authenticated;
