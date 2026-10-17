-- When do people use the app? Hour-of-day / day-of-week usage from prep.presence_log (one row per user per 10 minutes
-- while a signed-in tab is open), in Thai time. Admin-only, read-only.
--
-- Also keeps the log 90 days instead of 14 so weekly patterns can be read before the exam. This replaces prep_ping with the
-- same body except the retention interval.

create or replace function public.prep_ping() returns void
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := prep.uid();
  b timestamptz := to_timestamp(floor(extract(epoch from now()) / 600) * 600);
begin
  insert into prep.presence (user_id, last_seen) values (u, now())
  on conflict (user_id) do update set last_seen = now() where prep.presence.last_seen < now() - interval '20 seconds';
  insert into prep.presence_log (user_id, bucket) values (u, b) on conflict do nothing;
  if random() < 0.01 then delete from prep.presence_log where bucket < now() - interval '90 days'; end if;
end $$;

-- "People" below = distinct signed-in users seen in that hour, averaged over the days in the window.
create function public.prep_admin_time_stats(p_days int default 14) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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
        from prep.presence_log g left join prep.profiles p on p.user_id = g.user_id
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
end $$;

revoke execute on function public.prep_admin_time_stats(int) from public, anon;
grant execute on function public.prep_admin_time_stats(int) to authenticated;
