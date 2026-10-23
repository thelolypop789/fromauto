-- Admin analytics split by exam track (สพฐ. = obec, สอศ. = vec): p_track null = everyone.
-- Every per-user table read by these functions is filtered through prep.in_track(user_id, p_track).
-- Not split: question-level aggregates (prep.question_stats) and content/queue counters (questions, reports, keys).

create or replace function prep.in_track(p_user uuid, p_track text) returns boolean
language sql stable set search_path = '' as $$
  select p_track is null or exists (select 1 from prep.profiles p where p.user_id = p_user and p.track = p_track)
$$;

drop function public.prep_admin_dashboard();
CREATE FUNCTION public.prep_admin_dashboard(p_track text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  t0  timestamptz := prep.today()::timestamp at time zone 'Asia/Bangkok';
  t7  timestamptz;
  t30 timestamptz;
  m0  timestamptz := date_trunc('month', prep.today())::timestamp at time zone 'Asia/Bangkok';
begin
  perform prep.require_admin();
  t7 := t0 - interval '6 days';
  t30 := t0 - interval '29 days';
  return jsonb_build_object(
    'todo', jsonb_build_object(
      'pending_orders',   (select count(*) from (select * from prep.orders where prep.in_track(user_id, p_track)) where status = 'pending'),
      'oldest_pending_at',(select min(created_at) from (select * from prep.orders where prep.in_track(user_id, p_track)) where status = 'pending'),
      'open_reports',     (select count(*) from prep.reports where status = 'open'),
      'review_queue',     (select count(*) from prep.questions where status = 'review'),
      'expiring_7d',      (select count(distinct user_id) from (select * from prep.expiring_soon(7) where prep.in_track(user_id, p_track)))),
    'revenue', jsonb_build_object(
      'today',  coalesce((select sum(amount) from (select * from prep.orders where prep.in_track(user_id, p_track)) where status = 'approved' and reviewed_at >= t0), 0),
      'last7',  coalesce((select sum(amount) from (select * from prep.orders where prep.in_track(user_id, p_track)) where status = 'approved' and reviewed_at >= t7), 0),
      'last30', coalesce((select sum(amount) from (select * from prep.orders where prep.in_track(user_id, p_track)) where status = 'approved' and reviewed_at >= t30), 0),
      'month',  coalesce((select sum(amount) from (select * from prep.orders where prep.in_track(user_id, p_track)) where status = 'approved' and reviewed_at >= m0), 0),
      'submitted_30d', (select count(*) from (select * from prep.orders where prep.in_track(user_id, p_track)) where created_at >= t30),
      'approved_30d',  (select count(*) from (select * from prep.orders where prep.in_track(user_id, p_track)) where status = 'approved' and reviewed_at >= t30),
      'rejected_30d',  (select count(*) from (select * from prep.orders where prep.in_track(user_id, p_track)) where status = 'rejected' and reviewed_at >= t30),
      'avg_review_minutes_30d',
        (select round(avg(extract(epoch from (reviewed_at - created_at)) / 60))::int
           from (select * from prep.orders where prep.in_track(user_id, p_track)) where status in ('approved', 'rejected') and reviewed_at >= t30),
      'upgrade_orders_30d', (select count(*) from (select * from prep.orders where prep.in_track(user_id, p_track)) where status = 'approved' and credit > 0 and reviewed_at >= t30),
      'upgrade_amount_30d', coalesce((select sum(amount) from (select * from prep.orders where prep.in_track(user_id, p_track)) where status = 'approved' and credit > 0 and reviewed_at >= t30), 0),
      'by_package', coalesce((
        select jsonb_agg(jsonb_build_object('package', package, 'term', term, 'orders', n, 'amount', amt) order by amt desc)
          from (select package, term, count(*) n, sum(amount) amt from (select * from prep.orders where prep.in_track(user_id, p_track))
                 where status = 'approved' and reviewed_at >= t30 group by package, term) x), '[]'::jsonb)),
    'expiring', coalesce((
      select jsonb_agg(jsonb_build_object('email', au.email, 'package', x.package, 'expires_at', x.exp) order by x.exp)
        from (select * from (select * from prep.expiring_soon(7) where prep.in_track(user_id, p_track)) order by exp limit 30) x
        join auth.users au on au.id = x.user_id), '[]'::jsonb));
end $function$;
revoke execute on function public.prep_admin_dashboard from public, anon;
grant execute on function public.prep_admin_dashboard to authenticated, service_role;

drop function public.prep_admin_stats();
CREATE FUNCTION public.prep_admin_stats(p_track text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform prep.require_admin();
  return jsonb_build_object(
    'users',          (select count(*) from (select * from prep.profiles where p_track is null or track = p_track)),
    'paid',           (select count(distinct user_id) from (select * from prep.entitlements where prep.in_track(user_id, p_track))
                        where revoked_at is null and (expires_at is null or expires_at > now()) and not free),
    'free_members',   (select count(distinct user_id) from (select * from prep.entitlements where prep.in_track(user_id, p_track)) e
                        where revoked_at is null and (expires_at is null or expires_at > now()) and free
                          and not exists (select 1 from (select * from prep.entitlements where prep.in_track(user_id, p_track)) x where x.user_id = e.user_id and not x.free
                                           and x.revoked_at is null and (x.expires_at is null or x.expires_at > now()))),
    'answered_today', coalesce((select sum(answered) from (select * from prep.daily_activity where prep.in_track(user_id, p_track)) where day = prep.today()), 0),
    'active_today',   (select count(*) from (select * from prep.daily_activity where prep.in_track(user_id, p_track)) where day = prep.today()),
    'questions',      (select jsonb_object_agg(status, n) from
                        (select status, count(*) n from prep.questions group by status) s),
    'open_reports',   (select count(*) from prep.reports where status = 'open'),
    'keys_unused',    (select count(*) from prep.keys where redeemed_by is null and revoked_at is null)
  );
end $function$;
revoke execute on function public.prep_admin_stats from public, anon;
grant execute on function public.prep_admin_stats to authenticated, service_role;

drop function public.prep_admin_live();
CREATE FUNCTION public.prep_admin_live(p_track text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  b_now timestamptz := to_timestamp(floor(extract(epoch from now()) / 600) * 600);
begin
  perform prep.require_admin();
  return jsonb_build_object(
    'now', now(),
    'online_now', (select count(*) from (select * from prep.presence where prep.in_track(user_id, p_track)) where last_seen > now() - interval '2 minutes'),
    'online_15m', (select count(*) from (select * from prep.presence where prep.in_track(user_id, p_track)) where last_seen > now() - interval '15 minutes'),
    'rounds_in_progress', (select count(*) from (select * from prep.attempts where prep.in_track(user_id, p_track)) where submitted_at is null and started_at > now() - interval '2 hours')
                          + (select count(*) from (select * from prep.mock_attempts where prep.in_track(user_id, p_track)) where submitted_at is null and deadline > now()),
    'rounds_last_hour', (select count(*) from (select * from prep.attempts where prep.in_track(user_id, p_track)) where submitted_at > now() - interval '1 hour')
                        + (select count(*) from (select * from prep.mock_attempts where prep.in_track(user_id, p_track)) where submitted_at > now() - interval '1 hour'),
    'signups_today', (select count(*) from (select * from prep.profiles where p_track is null or track = p_track) where (created_at at time zone 'Asia/Bangkok')::date = prep.today()),
    'peak_today', (select jsonb_build_object('users', c, 'at', bucket) from (
                     select bucket, count(*) c from (select * from prep.presence_log where prep.in_track(user_id, p_track))
                      where (bucket at time zone 'Asia/Bangkok')::date = prep.today()
                      group by bucket order by c desc, bucket desc limit 1) x),
    'users24', (select jsonb_agg(jsonb_build_object('t', g.t, 'users', coalesce(l.c, 0)) order by g.t)
                  from generate_series(b_now - interval '23 hours 50 minutes', b_now, interval '10 minutes') g(t)
                  left join (select bucket, count(*) c from (select * from prep.presence_log where prep.in_track(user_id, p_track))
                              where bucket >= b_now - interval '24 hours' group by bucket) l on l.bucket = g.t),
    'rounds24', (select jsonb_agg(jsonb_build_object('t', g.t, 'rounds', coalesce(r.c, 0)) order by g.t)
                   from generate_series(date_trunc('hour', now()) - interval '23 hours', date_trunc('hour', now()), interval '1 hour') g(t)
                   left join (select h, count(*) c from (
                                select date_trunc('hour', submitted_at) h from (select * from prep.attempts where prep.in_track(user_id, p_track)) where submitted_at >= now() - interval '25 hours'
                                union all
                                select date_trunc('hour', submitted_at) from (select * from prep.mock_attempts where prep.in_track(user_id, p_track)) where submitted_at >= now() - interval '25 hours') s
                              group by h) r on r.h = g.t));
end $function$;
revoke execute on function public.prep_admin_live from public, anon;
grant execute on function public.prep_admin_live to authenticated, service_role;

drop function public.prep_admin_compare(integer, date);
CREATE FUNCTION public.prep_admin_compare(p_days integer DEFAULT 14, p_mark date DEFAULT NULL::date, p_track text DEFAULT NULL::text)
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
    'cur', prep.range_totals(c0, c1, p_track),
    'prev', prep.range_totals(p0, p1, p_track),
    'series', (select jsonb_agg(jsonb_build_object('i', g.i, 'cur_day', c0 + g.i, 'prev_day', p0 + g.i,
                                                    'cur', prep.day_metrics(c0 + g.i, p_track), 'prev', prep.day_metrics(p0 + g.i, p_track)) order by g.i)
                 from generate_series(0, n - 1) g(i)),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('src', x.src, 'users', x.users, 'buyers', x.buyers, 'revenue', x.revenue,
                                          'prev_users', x.prev_users, 'prev_buyers', x.prev_buyers) order by x.users desc, x.revenue desc)
        from (select coalesce(p.src, '(ไม่ทราบ)') as src,
                     count(*) filter (where (p.created_at at time zone 'Asia/Bangkok')::date between c0 and c1) as users,
                     count(*) filter (where (p.created_at at time zone 'Asia/Bangkok')::date between c0 and c1
                                        and exists (select 1 from (select * from prep.orders where prep.in_track(user_id, p_track)) o where o.user_id = p.user_id and o.status = 'approved')) as buyers,
                     coalesce(sum((select sum(o.amount) from (select * from prep.orders where prep.in_track(user_id, p_track)) o where o.user_id = p.user_id and o.status = 'approved')::int)
                              filter (where (p.created_at at time zone 'Asia/Bangkok')::date between c0 and c1), 0) as revenue,
                     count(*) filter (where (p.created_at at time zone 'Asia/Bangkok')::date between p0 and p1) as prev_users,
                     count(*) filter (where (p.created_at at time zone 'Asia/Bangkok')::date between p0 and p1
                                        and exists (select 1 from (select * from prep.orders where prep.in_track(user_id, p_track)) o where o.user_id = p.user_id and o.status = 'approved')) as prev_buyers
                from (select * from prep.profiles where p_track is null or track = p_track) p
               where (p.created_at at time zone 'Asia/Bangkok')::date between p0 and c1
               group by 1) x
       where x.users + x.prev_users > 0), '[]'::jsonb),
    'features', (select jsonb_object_agg(e.name, jsonb_build_object(
                   'cur',  (select count(distinct v.user_id) from (select * from prep.events where prep.in_track(user_id, p_track)) v where v.name = e.name and v.day between c0 and c1),
                   'prev', (select count(distinct v.user_id) from (select * from prep.events where prep.in_track(user_id, p_track)) v where v.name = e.name and v.day between p0 and p1),
                   'first_day', (select min(v.day) from (select * from prep.events where prep.in_track(user_id, p_track)) v where v.name = e.name)))
                   from unnest(ev) as e(name)),
    'promo', jsonb_build_object(
      'orders_cur',  (select count(*) from (select * from prep.orders where prep.in_track(user_id, p_track)) o where o.promo_code is not null and o.status in ('pending', 'approved')
                       and (o.created_at at time zone 'Asia/Bangkok')::date between c0 and c1),
      'orders_prev', (select count(*) from (select * from prep.orders where prep.in_track(user_id, p_track)) o where o.promo_code is not null and o.status in ('pending', 'approved')
                       and (o.created_at at time zone 'Asia/Bangkok')::date between p0 and p1),
      'discount_cur', coalesce((select sum(o.discount) from (select * from prep.orders where prep.in_track(user_id, p_track)) o where o.promo_code is not null and o.status = 'approved'
                       and (o.reviewed_at at time zone 'Asia/Bangkok')::date between c0 and c1), 0)),
    'marks', coalesce((select jsonb_agg(jsonb_build_object('day', m.day, 'label', m.label) order by m.day)
                         from prep.release_marks m where m.day between p0 and c1), '[]'::jsonb),
    'all_marks', coalesce((select jsonb_agg(jsonb_build_object('day', m.day, 'label', m.label) order by m.day desc) from prep.release_marks m), '[]'::jsonb),
    'snapshots', coalesce((select jsonb_agg(jsonb_build_object('day', s.day, 'users', s.users_total, 'paid', s.paid_total,
                                                               'majors', s.major_total, 'approved', s.approved_total, 'tagged', s.tagged_total)
                                            order by s.day)
                             from prep.daily_snapshot s where s.day between p0 and c1), '[]'::jsonb));
end $function$;
revoke execute on function public.prep_admin_compare from public, anon;
grant execute on function public.prep_admin_compare to authenticated, service_role;

drop function public.prep_admin_charts(integer);
CREATE FUNCTION public.prep_admin_charts(p_days integer DEFAULT 30, p_track text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
                 'new_users', (select count(*) from (select * from prep.profiles where p_track is null or track = p_track) p where p.created_at >= t0),
                 'active_users', (select count(distinct a.user_id) from (select * from prep.daily_activity where prep.in_track(user_id, p_track)) a where a.day between d0 and d_end),
                 'answers', coalesce((select sum(a.answered) from (select * from prep.daily_activity where prep.in_track(user_id, p_track)) a where a.day between d0 and d_end), 0),
                 'revenue', coalesce((select sum(o.amount) from (select * from prep.orders where prep.in_track(user_id, p_track)) o where o.status = 'approved'
                                       and (o.reviewed_at at time zone 'Asia/Bangkok')::date between d0 and d_end), 0))),
    'previous', (select jsonb_build_object(
                 'new_users', (select count(*) from (select * from prep.profiles where p_track is null or track = p_track) p
                                where (p.created_at at time zone 'Asia/Bangkok')::date between d0 - v_n and d0 - 1),
                 'active_users', (select count(distinct a.user_id) from (select * from prep.daily_activity where prep.in_track(user_id, p_track)) a where a.day between d0 - v_n and d0 - 1),
                 'answers', coalesce((select sum(a.answered) from (select * from prep.daily_activity where prep.in_track(user_id, p_track)) a where a.day between d0 - v_n and d0 - 1), 0),
                 'revenue', coalesce((select sum(o.amount) from (select * from prep.orders where prep.in_track(user_id, p_track)) o where o.status = 'approved'
                                       and (o.reviewed_at at time zone 'Asia/Bangkok')::date between d0 - v_n and d0 - 1), 0))),
    'series', (
      select jsonb_agg(jsonb_build_object(
               'day', g.d,
               'new_users', (select count(*) from (select * from prep.profiles where p_track is null or track = p_track) p where (p.created_at at time zone 'Asia/Bangkok')::date = g.d),
               'active_users', (select count(*) from (select * from prep.daily_activity where prep.in_track(user_id, p_track)) a where a.day = g.d),
               'answers', coalesce((select sum(a.answered) from (select * from prep.daily_activity where prep.in_track(user_id, p_track)) a where a.day = g.d), 0),
               'revenue', coalesce((select sum(o.amount) from (select * from prep.orders where prep.in_track(user_id, p_track)) o
                                     where o.status = 'approved' and (o.reviewed_at at time zone 'Asia/Bangkok')::date = g.d), 0)
             ) order by g.d)
        from generate_series(d0, d_end, interval '1 day') as g(d)),
    'funnel', (
      with cohort as (select user_id from (select * from prep.profiles where p_track is null or track = p_track) where created_at >= t0),
      ords as (select distinct user_id from (select * from prep.orders where prep.in_track(user_id, p_track))),
      paid as (select distinct user_id from (select * from prep.orders where prep.in_track(user_id, p_track)) where status = 'approved')
      select jsonb_build_array(
        jsonb_build_object('step', 'สมัคร/เข้าแอปครั้งแรก', 'n', (select count(*) from cohort)),
        jsonb_build_object('step', 'สร้างชุดฝึกแล้ว', 'n', (select count(*) from cohort c where exists (select 1 from (select * from prep.sets where prep.in_track(user_id, p_track)) s where s.user_id = c.user_id))),
        jsonb_build_object('step', 'เปิดหน้าซื้อ', 'n', (select count(*) from cohort c where exists (select 1 from (select * from prep.events where prep.in_track(user_id, p_track)) e where e.user_id = c.user_id and e.name = 'buy_view')
                                                           or c.user_id in (select user_id from ords))),
        jsonb_build_object('step', 'ส่งสลิป', 'n', (select count(*) from cohort c where c.user_id in (select user_id from ords))),
        jsonb_build_object('step', 'ซื้อสำเร็จ', 'n', (select count(*) from cohort c where c.user_id in (select user_id from paid))))),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('src', s, 'users', users, 'paid', paid) order by users desc)
        from (select coalesce(p.src, '(ไม่ระบุ)') s, count(*) users,
                     count(*) filter (where exists (select 1 from (select * from prep.orders where prep.in_track(user_id, p_track)) o where o.user_id = p.user_id and o.status = 'approved')) paid
                from (select * from prep.profiles where p_track is null or track = p_track) p where p.created_at >= t0 group by 1 order by 2 desc limit 12) x), '[]'::jsonb),
    'retention', jsonb_build_object(
      'd1_users', (select count(*) from (select * from prep.profiles where p_track is null or track = p_track) p where (p.created_at at time zone 'Asia/Bangkok')::date between d0 and d_end - 1),
      'd1_back',  (select count(*) from (select * from prep.profiles where p_track is null or track = p_track) p where (p.created_at at time zone 'Asia/Bangkok')::date between d0 and d_end - 1
                      and exists (select 1 from (select * from prep.daily_activity where prep.in_track(user_id, p_track)) a where a.user_id = p.user_id and a.day = (p.created_at at time zone 'Asia/Bangkok')::date + 1)),
      'd7_users', (select count(*) from (select * from prep.profiles where p_track is null or track = p_track) p where (p.created_at at time zone 'Asia/Bangkok')::date between d0 and d_end - 7),
      'd7_back',  (select count(*) from (select * from prep.profiles where p_track is null or track = p_track) p where (p.created_at at time zone 'Asia/Bangkok')::date between d0 and d_end - 7
                      and exists (select 1 from (select * from prep.daily_activity where prep.in_track(user_id, p_track)) a where a.user_id = p.user_id and a.day = (p.created_at at time zone 'Asia/Bangkok')::date + 7))),
    'weak_topics', coalesce((
      select jsonb_agg(jsonb_build_object('topic', name, 'n', n, 'pct', pct) order by pct)
        from (select t.name, sum(s.n)::int n, round(100.0 * sum(s.correct) / sum(s.n))::int pct
                from (select * from prep.user_topic_stats where prep.in_track(user_id, p_track)) s join prep.topics t on t.code = s.topic
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
                from prep.mock_subjects m left join (select * from prep.mock_attempts where prep.in_track(user_id, p_track)) a on a.subject = m.code and a.started_at >= t0
               group by m.code, m.name, m.sort) x), '[]'::jsonb));
end $function$;
revoke execute on function public.prep_admin_charts from public, anon;
grant execute on function public.prep_admin_charts to authenticated, service_role;

drop function public.prep_admin_major_stats(integer);
CREATE FUNCTION public.prep_admin_major_stats(p_days integer DEFAULT 30, p_track text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  d     int := greatest(1, least(coalesce(p_days, 30), 365));
  since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
begin
  perform prep.require_admin();
  return (
    with u as (
      select p.user_id, coalesce(p.major, '') as code, p.plan, p.created_at,
             coalesce((select sum(s.n) from (select * from prep.user_topic_stats where prep.in_track(user_id, p_track)) s where s.user_id = p.user_id), 0)::bigint as answered,
             (select count(*) from (select * from prep.sets where prep.in_track(user_id, p_track)) x where x.user_id = p.user_id) as sets,
             coalesce((select sum(o.amount) from (select * from prep.orders where prep.in_track(user_id, p_track)) o where o.user_id = p.user_id and o.status = 'approved'), 0)::bigint as revenue,
             exists (select 1 from (select * from prep.events where prep.in_track(user_id, p_track)) e where e.user_id = p.user_id and e.name = 'visit' and e.created_at >= since) as active
        from (select * from prep.profiles where p_track is null or track = p_track) p),
    per as (
      select code, count(*) as users,
             count(*) filter (where created_at >= since) as new_n,
             count(*) filter (where active) as active,
             sum(answered)::bigint as answered, sum(sets)::bigint as sets,
             count(*) filter (where plan = 'paid') as paid, sum(revenue)::bigint as revenue
        from u group by code)
    select jsonb_build_object(
      'days', d,
      'funnel', jsonb_build_object(
        'users', (select count(*) from u),
        'picked_major', (select count(*) from u where code <> ''),
        'answered_10', (select count(*) from u where answered >= 10),
        'paid', (select count(*) from u where plan = 'paid'),
        'active', (select count(*) from u where active),
        'revenue', (select coalesce(sum(revenue), 0) from u)),
      'majors', coalesce((
        select jsonb_agg(to_jsonb(r) order by r.users desc, r.name)
          from (select per.code, coalesce(t.name, 'ยังไม่เลือกวิชาเอก') as name, per.users, per.new_n, per.active,
                       per.answered, per.sets, per.paid, per.revenue,
                       coalesce((select jsonb_agg(jsonb_build_object('name', tt.name, 'n', x.n) order by x.n desc)
                                   from (select s.topic, sum(s.n)::bigint as n
                                           from (select * from prep.user_topic_stats where prep.in_track(user_id, p_track)) s join u uu on uu.user_id = s.user_id and uu.code = per.code
                                          group by s.topic order by 2 desc limit 5) x
                                   join prep.topics tt on tt.code = x.topic), '[]'::jsonb) as top_topics
                  from per left join prep.topics t on t.code = per.code) r), '[]'::jsonb)));
end $function$;
revoke execute on function public.prep_admin_major_stats from public, anon;
grant execute on function public.prep_admin_major_stats to authenticated, service_role;

drop function public.prep_admin_time_stats(integer);
CREATE FUNCTION public.prep_admin_time_stats(p_days integer DEFAULT 14, p_track text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  d     int := greatest(1, least(coalesce(p_days, 14), 90));
  since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 14), 90)));
begin
  perform prep.require_admin();
  return (
    with l as (
      select g.user_id,
             (g.bucket at time zone 'Asia/Bangkok')::date as day,
             extract(hour from g.bucket at time zone 'Asia/Bangkok')::int as h,
             extract(dow from g.bucket at time zone 'Asia/Bangkok')::int as dow,
             coalesce(p.major, '') as major, p.plan
        from (select * from prep.presence_log where prep.in_track(user_id, p_track)) g left join (select * from prep.profiles where p_track is null or track = p_track) p on p.user_id = g.user_id
       where g.bucket >= since),
    nd as (select greatest(1, count(distinct day)) as n from l),
    hourly as (select day, h, dow, count(distinct user_id) as n from l group by 1, 2, 3),
    by_hour as (
      select s.h, round(coalesce(sum(hh.n), 0)::numeric / (select n from nd), 2) as people
        from generate_series(0, 23) s(h) left join hourly hh on hh.h = s.h group by s.h),
    dow_days as (select dow, count(distinct day) as n from l group by dow),
    grid as (
      select hh.dow, hh.h, round(sum(hh.n)::numeric / dd.n, 2) as people
        from hourly hh join dow_days dd on dd.dow = hh.dow group by hh.dow, hh.h, dd.n),
    by_dow as (
      select s.dow, round(coalesce((select sum(u.c)::numeric from (select day, count(distinct user_id) c from l where l.dow = s.dow group by day) u)
                                   / nullif((select n from dow_days where dow = s.dow), 0), 0), 1) as people
        from generate_series(0, 6) s(dow)),
    seg as (
      select case when plan = 'paid' then 'paid' else 'free' end as k, h, count(distinct (day, user_id)) as n from l group by 1, 2),
    mjh as (select major, h, count(distinct user_id) as n from l group by major, h),
    mj as (
      select major,
             (select count(distinct l2.user_id) from l l2 where l2.major = mjh.major) as users,
             (array_agg(h order by n desc, h))[1] as peak_h,
             round(100.0 * sum(n) filter (where h >= 18) / nullif(sum(n), 0)) as evening_pct
        from mjh group by major)
    select jsonb_build_object(
      'days', d,
      'days_with_data', (select count(distinct day) from l),
      'first_day', (select min(day) from l),
      'active_users', (select count(distinct user_id) from l),
      'by_hour', (select jsonb_agg(jsonb_build_object('h', h, 'people', people) order by h) from by_hour),
      'by_dow', (select jsonb_agg(jsonb_build_object('dow', dow, 'people', people) order by dow) from by_dow),
      'grid', coalesce((select jsonb_agg(jsonb_build_object('dow', dow, 'h', h, 'people', people)) from grid), '[]'::jsonb),
      'segments', jsonb_build_object(
        'paid', coalesce((select jsonb_agg(jsonb_build_object('h', h, 'n', n) order by h) from seg where k = 'paid'), '[]'::jsonb),
        'free', coalesce((select jsonb_agg(jsonb_build_object('h', h, 'n', n) order by h) from seg where k = 'free'), '[]'::jsonb)),
      'majors', coalesce((
        select jsonb_agg(jsonb_build_object('name', coalesce(t.name, 'ยังไม่เลือกวิชาเอก'), 'users', mj.users, 'peak_h', mj.peak_h, 'evening_pct', mj.evening_pct)
                         order by mj.users desc)
          from mj left join prep.topics t on t.code = mj.major where mj.users >= 3), '[]'::jsonb)));
end $function$;
revoke execute on function public.prep_admin_time_stats from public, anon;
grant execute on function public.prep_admin_time_stats to authenticated, service_role;

drop function public.prep_admin_list_users(text, integer, integer);
CREATE FUNCTION public.prep_admin_list_users(p_filter text DEFAULT 'all'::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 50, p_track text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare lim int := greatest(1, least(coalesce(p_limit, 50), 100)); off_ int := greatest(0, coalesce(p_offset, 0));
begin
  perform prep.require_admin();
  if p_filter not in ('all', 'paid', 'free', 'nomajor') then raise exception 'bad_filter'; end if;
  return (
    with f as (
      select p.user_id, p.major, p.plan, p.created_at, p.src,
             (select max(a.day) from (select * from prep.daily_activity where prep.in_track(user_id, p_track)) a where a.user_id = p.user_id) as last_active
        from (select * from prep.profiles where p_track is null or track = p_track) p
       where case p_filter when 'paid' then p.plan = 'paid' when 'free' then p.plan <> 'paid'
                           when 'nomajor' then p.major is null else true end),
    page as (
      select * from f order by last_active desc nulls last, created_at desc limit lim offset off_)
    select jsonb_build_object(
      'total', (select count(*) from f),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', g.user_id, 'email', au.email, 'created_at', g.created_at, 'last_active', g.last_active,
                 'major_name', (select t.name from prep.topics t where t.code = g.major),
                 'src', g.src,
                 'packages', to_jsonb(prep.active_packages(g.user_id)),
                 'orders', (select count(*) from (select * from prep.orders where prep.in_track(user_id, p_track)) o where o.user_id = g.user_id),
                 'answered', coalesce((select sum(s.n) from (select * from prep.user_topic_stats where prep.in_track(user_id, p_track)) s where s.user_id = g.user_id), 0),
                 'sets', (select count(*) from (select * from prep.sets where prep.in_track(user_id, p_track)) x where x.user_id = g.user_id))
               order by g.last_active desc nulls last, g.created_at desc)
          from page g join auth.users au on au.id = g.user_id), '[]'::jsonb)));
end $function$;
revoke execute on function public.prep_admin_list_users from public, anon;
grant execute on function public.prep_admin_list_users to authenticated, service_role;

drop function prep.range_totals(date, date);
CREATE FUNCTION prep.range_totals(a date, b date, p_track text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with cohort as (select p.user_id, (p.created_at at time zone 'Asia/Bangkok')::date as d from (select * from prep.profiles where p_track is null or track = p_track) p
                   where (p.created_at at time zone 'Asia/Bangkok')::date between a and b),
       act as (select count(distinct user_id) as users, coalesce(sum(answered), 0) as answers
                 from (select * from prep.daily_activity where prep.in_track(user_id, p_track)) where day between a and b)
  select jsonb_build_object(
    'active',  (select users from act),
    'new',     (select count(*) from cohort),
    'answers', (select answers from act),
    'revenue', coalesce((select sum(o.amount) from (select * from prep.orders where prep.in_track(user_id, p_track)) o where o.status = 'approved'
                          and (o.reviewed_at at time zone 'Asia/Bangkok')::date between a and b), 0),
    'buyers',  (select count(distinct o.user_id) from (select * from prep.orders where prep.in_track(user_id, p_track)) o where o.status = 'approved'
                 and (o.reviewed_at at time zone 'Asia/Bangkok')::date between a and b),
    'mocks',   (select count(*) from (select * from prep.mock_attempts where prep.in_track(user_id, p_track)) m where (m.started_at at time zone 'Asia/Bangkok')::date between a and b),
    'd1_users', (select count(*) from cohort c where c.d <= prep.today() - 1),
    'd1_back',  (select count(*) from cohort c where c.d <= prep.today() - 1
                   and exists (select 1 from (select * from prep.daily_activity where prep.in_track(user_id, p_track)) x where x.user_id = c.user_id and x.day = c.d + 1)),
    'funnel', jsonb_build_array(
      (select count(*) from cohort),
      (select count(*) from cohort c where exists (select 1 from (select * from prep.sets where prep.in_track(user_id, p_track)) s where s.user_id = c.user_id)),
      (select count(*) from cohort c where exists (select 1 from (select * from prep.events where prep.in_track(user_id, p_track)) e where e.user_id = c.user_id and e.name = 'buy_view')
                                         or exists (select 1 from (select * from prep.orders where prep.in_track(user_id, p_track)) o where o.user_id = c.user_id)),
      (select count(*) from cohort c where exists (select 1 from (select * from prep.orders where prep.in_track(user_id, p_track)) o where o.user_id = c.user_id)),
      (select count(*) from cohort c where exists (select 1 from (select * from prep.orders where prep.in_track(user_id, p_track)) o where o.user_id = c.user_id and o.status = 'approved'))))
$function$;

drop function prep.day_metrics(date);
CREATE FUNCTION prep.day_metrics(d date, p_track text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'active',  (select count(*) from (select * from prep.daily_activity where prep.in_track(user_id, p_track)) a where a.day = d),
    'new',     (select count(*) from (select * from prep.profiles where p_track is null or track = p_track) p where (p.created_at at time zone 'Asia/Bangkok')::date = d),
    'answers', coalesce((select sum(a.answered) from (select * from prep.daily_activity where prep.in_track(user_id, p_track)) a where a.day = d), 0),
    'revenue', coalesce((select sum(o.amount) from (select * from prep.orders where prep.in_track(user_id, p_track)) o where o.status = 'approved' and (o.reviewed_at at time zone 'Asia/Bangkok')::date = d), 0),
    'buyers',  (select count(*) from (select * from prep.orders where prep.in_track(user_id, p_track)) o where o.status = 'approved' and (o.reviewed_at at time zone 'Asia/Bangkok')::date = d),
    'mocks',   (select count(*) from (select * from prep.mock_attempts where prep.in_track(user_id, p_track)) m where (m.started_at at time zone 'Asia/Bangkok')::date = d))
$function$;
