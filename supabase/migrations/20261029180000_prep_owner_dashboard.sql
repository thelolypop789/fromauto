-- Owner dashboard: headline numbers against the previous period with a daily series and calendar/post markers,
-- results by acquisition channel with ad spend (cost per buyer), weekly signup cohorts (free vs buyers), and a
-- learning-quality view fed by a nightly readiness snapshot. The numbers live in prep.admin_* SQL functions (no
-- admin check, not callable by API roles) wrapped by public.prep_admin_* functions that require an admin.
-- "Buyer" everywhere = a user with an approved order or a redeemed paid key.

-- ---------------------------------------------------------------- ad spend (typed by the owner, per day and channel)
create table if not exists prep.ad_spend (
  id         serial primary key,
  day        date not null,
  src        text not null check (src ~ '^[a-z0-9_-]{1,40}$'),   -- same value as the link's ?src=
  amount     int not null check (amount >= 0),
  note       text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table prep.ad_spend enable row level security;
revoke all on prep.ad_spend from public, anon, authenticated;

create or replace function public.prep_admin_ad_spend_list() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'day', day, 'src', src, 'amount', amount, 'note', note) order by day desc, id desc)
                     from (select * from prep.ad_spend order by day desc, id desc limit 200) x), '[]'::jsonb);
end $$;

create or replace function public.prep_admin_ad_spend_save(p_day date, p_src text, p_amount int, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.require_admin();
begin
  insert into prep.ad_spend (day, src, amount, note, created_by)
  values (p_day, lower(trim(p_src)), p_amount, nullif(left(trim(coalesce(p_note, '')), 200), ''), u);
end $$;

create or replace function public.prep_admin_ad_spend_delete(p_id int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  delete from prep.ad_spend where id = p_id;
end $$;

-- ---------------------------------------------------------------- readiness snapshot (nightly)
create table if not exists prep.readiness_daily (
  user_id  uuid not null references auth.users(id) on delete cascade,
  day      date not null,
  overall  numeric,
  a        numeric,
  b        numeric,
  answered int,
  primary key (user_id, day)
);
alter table prep.readiness_daily enable row level security;
revoke all on prep.readiness_daily from public, anon, authenticated;

-- Runs prep_readiness as each user who answered anything in the last 14 days (it reads the user from the JWT
-- claims, so the claims are set per user inside this transaction) and keeps one row per user per day.
create or replace function prep.snapshot_readiness() returns int
language plpgsql security definer set search_path = '' as $$
declare
  u uuid;
  r jsonb;
  n int := 0;
begin
  for u in select distinct da.user_id from prep.daily_activity da where da.day > prep.today() - 14 and da.answered > 0 loop
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
      r := public.prep_readiness();
      if r->>'overall' is not null then
        insert into prep.readiness_daily (user_id, day, overall, a, b, answered)
        values (u, prep.today(), (r->>'overall')::numeric,
                (select (s->>'pct')::numeric from jsonb_array_elements(r->'sections') s where s->>'section' = 'A'),
                (select (s->>'pct')::numeric from jsonb_array_elements(r->'sections') s where s->>'section' = 'B'),
                (r->>'answered')::int)
        on conflict (user_id, day) do update set overall = excluded.overall, a = excluded.a, b = excluded.b, answered = excluded.answered;
        n := n + 1;
      end if;
    exception when others then null;   -- one user's data must not stop the rest
    end;
  end loop;
  perform set_config('request.jwt.claims', '', true);
  return n;
end $$;
revoke execute on function prep.snapshot_readiness() from public, anon, authenticated;

-- 23:45 Bangkok, before the 23:55 daily snapshot job.
select cron.unschedule(jobid) from cron.job where jobname = 'prep-readiness-snapshot';
select cron.schedule('prep-readiness-snapshot', '45 16 * * *', 'select prep.snapshot_readiness()');

-- ---------------------------------------------------------------- headline numbers + daily series
create or replace function prep.admin_overview(p_days int, p_track text) returns jsonb
language sql stable set search_path = '' as $$
with rng as (
  select n, d1 - (n - 1) as c0, d1 as c1, d1 - (2 * n - 1) as p0, d1 - n as p1
    from (select least(greatest(coalesce(p_days, 30), 7), 180) as n, prep.today() as d1) x),
days as (select generate_series(p0, c1, interval '1 day')::date as d from rng),
u as (select (p.created_at at time zone 'Asia/Bangkok')::date as d from prep.profiles p, rng
       where p.created_at >= (rng.p0::timestamp at time zone 'Asia/Bangkok') and prep.in_track(p.user_id, p_track)),
ord as (select o.user_id, (o.reviewed_at at time zone 'Asia/Bangkok')::date as d, o.amount from prep.orders o
         where o.status = 'approved' and o.reviewed_at is not null and prep.in_track(o.user_id, p_track)),
kr as (select (k.created_at at time zone 'Asia/Bangkok')::date as d, coalesce(k.amount, 0) as amount from prep.keys k
        where not k.free and k.revoked_at is null and (p_track is null or (k.redeemed_by is not null and prep.in_track(k.redeemed_by, p_track)))),
buy as (select user_id, min(d) as d from (
          select user_id, d from ord
          union all
          select k.redeemed_by, (k.redeemed_at at time zone 'Asia/Bangkok')::date from prep.keys k
           where not k.free and k.revoked_at is null and k.redeemed_by is not null and prep.in_track(k.redeemed_by, p_track)) b
        group by user_id),
act as (select da.day as d, da.user_id, da.answered from prep.daily_activity da, rng
         where da.day >= rng.p0 and da.answered > 0 and prep.in_track(da.user_id, p_track)),
ser as (
  select dd.d,
         coalesce((select sum(amount) from ord where ord.d = dd.d), 0) + coalesce((select sum(amount) from kr where kr.d = dd.d), 0) as revenue,
         (select count(*) from u where u.d = dd.d) as signups,
         (select count(*) from buy where buy.d = dd.d) as buyers,
         (select count(*) from act where act.d = dd.d) as active
    from days dd),
tot as (
  select (s.d >= r.c0) as cur, sum(s.revenue) as revenue, sum(s.signups) as signups, sum(s.buyers) as buyers
    from ser s, rng r group by 1),
lrn as (
  select cur, count(*) as n from (
    select (a.d >= r.c0) as cur, a.user_id from act a, rng r group by 1, 2 having sum(a.answered) >= 10) x
  group by cur)
select jsonb_build_object(
  'n', r.n, 'from', r.c0, 'to', r.c1,
  'cur',  (select jsonb_build_object('revenue', coalesce(revenue, 0), 'signups', coalesce(signups, 0), 'buyers', coalesce(buyers, 0)) from tot where cur),
  'prev', (select jsonb_build_object('revenue', coalesce(revenue, 0), 'signups', coalesce(signups, 0), 'buyers', coalesce(buyers, 0)) from tot where not cur),
  'learners', coalesce((select n from lrn where cur), 0),
  'learners_prev', coalesce((select n from lrn where not cur), 0),
  'series', (select jsonb_agg(jsonb_build_object('d', s.d, 'revenue', s.revenue, 'signups', s.signups, 'buyers', s.buyers, 'active', s.active) order by s.d)
               from ser s where s.d >= r.c0),
  'marks', coalesce((select jsonb_agg(m order by m->>'d') from (
      select jsonb_build_object('d', e.starts_on, 'kind', e.kind, 'label', e.title) as m
        from prep.exam_events e where e.published and e.starts_on between r.c0 and r.c1
      union all
      select jsonb_build_object('d', (f.posted_at at time zone 'Asia/Bangkok')::date, 'kind', 'post', 'label', f.title)
        from prep.fb_posts f where f.posted_at is not null and (f.posted_at at time zone 'Asia/Bangkok')::date between r.c0 and r.c1) z), '[]'::jsonb))
from rng r
$$;

-- ---------------------------------------------------------------- by channel (?src of the first visit)
create or replace function prep.admin_channels(p_days int, p_track text) returns jsonb
language sql stable set search_path = '' as $$
with rng as (select prep.today() - (least(greatest(coalesce(p_days, 30), 7), 180) - 1) as c0, prep.today() as c1),
paid as (select user_id from prep.orders where status = 'approved'
         union select redeemed_by from prep.keys where not free and revoked_at is null and redeemed_by is not null),
rev as (select user_id, sum(amount) as amt from prep.orders where status = 'approved' group by user_id),
u as (select p.user_id, coalesce(nullif(p.src, ''), '(ไม่ทราบ)') as src from prep.profiles p, rng
       where (p.created_at at time zone 'Asia/Bangkok')::date between rng.c0 and rng.c1 and prep.in_track(p.user_id, p_track)),
g as (select u.src, count(*) as signups, count(*) filter (where u.user_id in (select user_id from paid)) as buyers,
             coalesce(sum(rev.amt), 0) as revenue
        from u left join rev using (user_id) group by u.src),
sp as (select a.src, sum(a.amount) as spend from prep.ad_spend a, rng where a.day between rng.c0 and rng.c1 group by a.src)
select coalesce(jsonb_agg(jsonb_build_object('src', coalesce(g.src, sp.src), 'signups', coalesce(g.signups, 0), 'buyers', coalesce(g.buyers, 0),
                                             'revenue', coalesce(g.revenue, 0), 'spend', sp.spend)
                          order by coalesce(g.signups, 0) desc, coalesce(g.src, sp.src)), '[]'::jsonb)
  from g full join sp on sp.src = g.src
$$;

-- ---------------------------------------------------------------- weekly signup cohorts, free vs buyers
create or replace function prep.admin_cohorts(p_weeks int, p_track text) returns jsonb
language sql stable set search_path = '' as $$
with prm as (select least(greatest(coalesce(p_weeks, 8), 2), 26) as k, date_trunc('week', prep.today())::date as w1),
paid as (select user_id from prep.orders where status = 'approved'
         union select redeemed_by from prep.keys where not free and revoked_at is null and redeemed_by is not null),
u as (select p.user_id, date_trunc('week', (p.created_at at time zone 'Asia/Bangkok')::date)::date as wk,
             p.user_id in (select user_id from paid) as paid
        from prep.profiles p, prm
       where (p.created_at at time zone 'Asia/Bangkok')::date >= prm.w1 - 7 * (prm.k - 1) and prep.in_track(p.user_id, p_track)),
aw as (select distinct da.user_id, date_trunc('week', da.day)::date as wk from prep.daily_activity da
        where da.answered > 0 and da.user_id in (select user_id from u)),
cells as (select u.wk, u.paid, (aw.wk - u.wk) / 7 as off, count(distinct u.user_id) as n
            from u join aw on aw.user_id = u.user_id and aw.wk >= u.wk group by 1, 2, 3),
sizes as (select wk, paid, count(*) as size from u group by 1, 2)
select coalesce(jsonb_agg(jsonb_build_object(
         'week', s.wk, 'paid', s.paid, 'size', s.size,
         'active', (select jsonb_agg(coalesce((select c.n from cells c where c.wk = s.wk and c.paid = s.paid and c.off = o), 0) order by o)
                      from generate_series(0, ((select w1 from prm) - s.wk) / 7) o))
       order by s.wk desc, s.paid desc), '[]'::jsonb)
  from sizes s
$$;

-- ---------------------------------------------------------------- learning quality
create or replace function prep.admin_learning(p_days int, p_track text) returns jsonb
language sql stable set search_path = '' as $$
with rng as (select prep.today() - (least(greatest(coalesce(p_days, 30), 7), 180) - 1) as c0, prep.today() as c1),
lr as (select distinct on (r.user_id) r.user_id, r.overall from prep.readiness_daily r, rng
        where r.day between rng.c0 and rng.c1 and prep.in_track(r.user_id, p_track) order by r.user_id, r.day desc),
wk as (select date_trunc('week', r.day)::date as w, r.user_id, (array_agg(r.overall order by r.day desc))[1] as ov
         from prep.readiness_daily r where r.day > prep.today() - 84 and prep.in_track(r.user_id, p_track) group by 1, 2),
mk as (select round(100.0 * m.score / nullif(cardinality(m.question_ids), 0)) as pct from prep.mock_attempts m, rng
        where m.submitted_at is not null and m.score is not null
          and (m.submitted_at at time zone 'Asia/Bangkok')::date between rng.c0 and rng.c1 and prep.in_track(m.user_id, p_track)),
first_ans as (select user_id, correct, row_number() over (partition by user_id order by at, id) as rn
                from (select distinct on (l.user_id, l.question_id) l.user_id, l.correct, l.at, l.id from prep.answer_log l
                       where prep.in_track(l.user_id, p_track) order by l.user_id, l.question_id, l.at, l.id) f),
curve as (select (rn - 1) / 100 as b, count(distinct user_id) as users, round(100 * avg(correct::int)) as acc
            from first_ans where rn <= 1000 group by 1 having count(distinct user_id) >= 5),
tp as (select q.topic, t.name, sum(s.n) as n, sum(s.correct) as c,
              count(*) filter (where prep.item_suspect(q.id, q.status, q.answer, s.n, s.correct, s.choice_counts) is not null) as sus
         from prep.questions q join prep.question_stats s on s.question_id = q.id join prep.topics t on t.code = q.topic
        where q.status = 'approved' group by 1, 2 having sum(s.n) >= 100),
quota as (select mq.topic, sum(mq.n) as slots from prep.mock_quota mq
           where mq.track = coalesce(p_track, 'obec') and mq.topic <> '*MAJOR*' group by 1),
thin as (select qu.topic, t.name, qu.slots, (select count(*) from prep.questions q where q.topic = qu.topic and q.status = 'approved') as have
           from quota qu join prep.topics t on t.code = qu.topic)
select jsonb_build_object(
  'ready', (select jsonb_build_object('n', count(*), 'pass', count(*) filter (where overall >= 60),
             'buckets', (select jsonb_agg((select count(*) from lr l2 where least(floor(l2.overall / 10), 9) = b) order by b) from generate_series(0, 9) b)) from lr),
  'ready_weeks', coalesce((select jsonb_agg(jsonb_build_object('w', w, 'n', n, 'pass', pass) order by w) from (
                   select w, count(*) as n, count(*) filter (where ov >= 60) as pass from wk group by w) x), '[]'::jsonb),
  'mock', (select jsonb_build_object('n', count(*), 'pass', count(*) filter (where pct >= 60),
            'buckets', (select jsonb_agg((select count(*) from mk m2 where least(floor(m2.pct / 10), 9) = b) order by b) from generate_series(0, 9) b)) from mk),
  'curve', coalesce((select jsonb_agg(jsonb_build_object('b', b, 'users', users, 'acc', acc) order by b) from curve), '[]'::jsonb),
  'review', jsonb_build_object(
     'due', (select count(*) from prep.review_schedule rs where rs.due_on <= prep.today() and prep.in_track(rs.user_id, p_track)),
     'overdue7', (select count(*) from prep.review_schedule rs where rs.due_on < prep.today() - 7 and prep.in_track(rs.user_id, p_track)),
     'users_due', (select count(distinct rs.user_id) from prep.review_schedule rs where rs.due_on <= prep.today() and prep.in_track(rs.user_id, p_track)),
     'users_reviewed', (select count(distinct a.user_id) from prep.attempts a join prep.sets s on s.id = a.set_id, rng
                         where s.kind = 'review_due' and (a.started_at at time zone 'Asia/Bangkok')::date between rng.c0 and rng.c1
                           and prep.in_track(a.user_id, p_track))),
  'hard', coalesce((select jsonb_agg(jsonb_build_object('topic', topic, 'name', name, 'n', n, 'pct', round(100.0 * c / n), 'suspect', sus) order by 1.0 * c / n)
                      from (select * from tp order by 1.0 * c / n limit 10) h), '[]'::jsonb),
  'bank', jsonb_build_object(
     'unseen', (select count(*) from prep.questions q left join prep.question_stats s on s.question_id = q.id
                 where q.status = 'approved' and coalesce(s.n, 0) = 0),
     'suspect', (select count(*) from prep.questions q join prep.question_stats s on s.question_id = q.id
                  where prep.item_suspect(q.id, q.status, q.answer, s.n, s.correct, s.choice_counts) is not null),
     'thin', coalesce((select jsonb_agg(jsonb_build_object('topic', topic, 'name', name, 'slots', slots, 'have', have) order by 1.0 * have / slots)
                         from (select * from thin where have < 10 * slots order by 1.0 * have / slots limit 12) t), '[]'::jsonb)))
$$;

do $$
declare f text;
begin
  for f in select unnest(array['prep.admin_overview(integer,text)', 'prep.admin_channels(integer,text)',
                               'prep.admin_cohorts(integer,text)', 'prep.admin_learning(integer,text)']) loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------- admin wrappers
create or replace function public.prep_admin_overview(p_days int default 30, p_track text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin perform prep.require_admin(); return prep.admin_overview(p_days, p_track); end $$;

create or replace function public.prep_admin_channels(p_days int default 30, p_track text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin perform prep.require_admin(); return prep.admin_channels(p_days, p_track); end $$;

create or replace function public.prep_admin_cohorts(p_weeks int default 8, p_track text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin perform prep.require_admin(); return prep.admin_cohorts(p_weeks, p_track); end $$;

create or replace function public.prep_admin_learning(p_days int default 30, p_track text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin perform prep.require_admin(); return prep.admin_learning(p_days, p_track); end $$;

do $$
declare f text;
begin
  for f in select unnest(array['public.prep_admin_ad_spend_list()', 'public.prep_admin_ad_spend_save(date,text,integer,text)',
                               'public.prep_admin_ad_spend_delete(integer)', 'public.prep_admin_overview(integer,text)',
                               'public.prep_admin_channels(integer,text)', 'public.prep_admin_cohorts(integer,text)',
                               'public.prep_admin_learning(integer,text)']) loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- First snapshot now, so the learning tab has data from today.
select prep.snapshot_readiness();
