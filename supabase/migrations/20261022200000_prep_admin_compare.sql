-- Admin comparison dashboard: one RPC returns everything the page needs for "this period vs the previous one" or
-- "after a release vs the same number of days before it". Also: release marks (what shipped when), a daily snapshot of
-- numbers that cannot be rebuilt later, and event names for the new learner features (one row per user per day).

-- ---------- events for the new features ----------
create or replace function public.prep_track(p_name text, p_props jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  u   uuid := prep.uid();
  v_src text;
begin
  if p_name not in ('visit', 'buy_view', 'free_limit', 'level_view', 'readiness_view', 'subtopic_pick', 'promo_apply', 'scoredist_view') then
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

-- ---------- release marks ----------
create table prep.release_marks (
  day   date primary key,
  label text not null check (length(label) between 1 and 80)
);
alter table prep.release_marks enable row level security;
insert into prep.release_marks (day, label) values
  ('2026-10-18', 'แดชบอร์ดรายเอก · บังคับเลือกวิชาเอก'),
  ('2026-10-22', 'มาสคอต · เลเวล · เกจความพร้อม · โค้ดส่วนลด · หมวดย่อยเอก');

create function public.prep_admin_release_mark_set(p_day date, p_label text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  if p_day is null or p_day > prep.today() + 1 then raise exception 'bad_date'; end if;
  if nullif(trim(coalesce(p_label, '')), '') is null then
    delete from prep.release_marks where day = p_day;
  else
    insert into prep.release_marks (day, label) values (p_day, left(trim(p_label), 80))
    on conflict (day) do update set label = excluded.label;
  end if;
end $$;

-- ---------- daily snapshot (numbers that cannot be rebuilt from history later) ----------
create table prep.daily_snapshot (
  day            date primary key,
  users_total    int not null,
  paid_total     int not null,
  major_total    int not null,
  approved_total int not null,
  review_total   int not null,
  tagged_total   int not null,
  by_major       jsonb not null default '{}'::jsonb,
  taken_at       timestamptz not null default now()
);
alter table prep.daily_snapshot enable row level security;

create function prep.take_snapshot() returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into prep.daily_snapshot as s (day, users_total, paid_total, major_total, approved_total, review_total, tagged_total, by_major)
  select prep.today(),
         (select count(*) from prep.profiles),
         (select count(*) from prep.profiles where plan = 'paid'),
         (select count(*) from prep.profiles where major is not null),
         (select count(*) from prep.questions where status = 'approved'),
         (select count(*) from prep.questions where status = 'review'),
         (select count(*) from prep.questions where status = 'approved' and subtopic is not null),
         coalesce((select jsonb_object_agg(topic, n) from (select topic, count(*) n from prep.questions
                                                            where status = 'approved' and topic like 'B3-%' group by topic) x), '{}'::jsonb)
  on conflict (day) do update set users_total = excluded.users_total, paid_total = excluded.paid_total, major_total = excluded.major_total,
    approved_total = excluded.approved_total, review_total = excluded.review_total, tagged_total = excluded.tagged_total,
    by_major = excluded.by_major, taken_at = now();
end $$;
revoke execute on function prep.take_snapshot() from public;
select prep.take_snapshot();
select cron.schedule('prep-daily-snapshot', '55 16 * * *', 'select prep.take_snapshot()');   -- 23:55 Thai time

-- ---------- helpers ----------
create function prep.day_metrics(d date) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'active',  (select count(*) from prep.daily_activity a where a.day = d),
    'new',     (select count(*) from prep.profiles p where (p.created_at at time zone 'Asia/Bangkok')::date = d),
    'answers', coalesce((select sum(a.answered) from prep.daily_activity a where a.day = d), 0),
    'revenue', coalesce((select sum(o.amount) from prep.orders o where o.status = 'approved' and (o.reviewed_at at time zone 'Asia/Bangkok')::date = d), 0),
    'buyers',  (select count(*) from prep.orders o where o.status = 'approved' and (o.reviewed_at at time zone 'Asia/Bangkok')::date = d),
    'mocks',   (select count(*) from prep.mock_attempts m where (m.started_at at time zone 'Asia/Bangkok')::date = d))
$$;

-- Totals and the signup-to-purchase funnel for [a, b] (Thai dates, inclusive).
create function prep.range_totals(a date, b date) returns jsonb
language sql stable set search_path = '' as $$
  with cohort as (select p.user_id, (p.created_at at time zone 'Asia/Bangkok')::date as d from prep.profiles p
                   where (p.created_at at time zone 'Asia/Bangkok')::date between a and b),
       act as (select count(distinct user_id) as users, coalesce(sum(answered), 0) as answers
                 from prep.daily_activity where day between a and b)
  select jsonb_build_object(
    'active',  (select users from act),
    'new',     (select count(*) from cohort),
    'answers', (select answers from act),
    'revenue', coalesce((select sum(o.amount) from prep.orders o where o.status = 'approved'
                          and (o.reviewed_at at time zone 'Asia/Bangkok')::date between a and b), 0),
    'buyers',  (select count(distinct o.user_id) from prep.orders o where o.status = 'approved'
                 and (o.reviewed_at at time zone 'Asia/Bangkok')::date between a and b),
    'mocks',   (select count(*) from prep.mock_attempts m where (m.started_at at time zone 'Asia/Bangkok')::date between a and b),
    'd1_users', (select count(*) from cohort c where c.d <= prep.today() - 1),
    'd1_back',  (select count(*) from cohort c where c.d <= prep.today() - 1
                   and exists (select 1 from prep.daily_activity x where x.user_id = c.user_id and x.day = c.d + 1)),
    'funnel', jsonb_build_array(
      (select count(*) from cohort),
      (select count(*) from cohort c where exists (select 1 from prep.sets s where s.user_id = c.user_id)),
      (select count(*) from cohort c where exists (select 1 from prep.events e where e.user_id = c.user_id and e.name = 'buy_view')
                                         or exists (select 1 from prep.orders o where o.user_id = c.user_id)),
      (select count(*) from cohort c where exists (select 1 from prep.orders o where o.user_id = c.user_id)),
      (select count(*) from cohort c where exists (select 1 from prep.orders o where o.user_id = c.user_id and o.status = 'approved'))))
$$;

-- ---------- the dashboard ----------
-- p_mark null: the last p_days days against the p_days before them.
-- p_mark = a date: from that day until today against the same number of days right before it.
create function public.prep_admin_compare(p_days int default 14, p_mark date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  today date := prep.today();
  n int; c0 date; c1 date; p0 date; p1 date;
  ev text[] := array['level_view', 'readiness_view', 'subtopic_pick', 'promo_apply', 'scoredist_view', 'buy_view'];
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
end $$;

do $$
declare f text;
begin
  for f in select unnest(array['public.prep_admin_compare(integer,date)', 'public.prep_admin_release_mark_set(date,text)',
                               'public.prep_track(text,jsonb)']) loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
