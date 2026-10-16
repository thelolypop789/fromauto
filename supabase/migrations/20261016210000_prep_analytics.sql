-- Analytics for the admin dashboard, kept to what answers business questions.
--  * prep.events: only three event names (visit, buy_view, free_limit) with a tiny props blob; one row per user,
--    event and day. No IP, no device, no location. Everything else (answers, sets, mock exams, orders) is already
--    stored and is read from the existing tables.
--  * prep.profiles.src: where the user first came from (the ?src= value of the link), set once.
--  * Deletion requests: a user can ask for their data to be deleted; the admin sees and closes the request.
--  * prep_admin_charts(days): daily series, sales funnel, sources, retention, weakest topics, tricky questions, mock exams.
-- New table/column/functions only; nothing existing is replaced.

alter table prep.profiles add column if not exists src text;

create table prep.events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null check (name in ('visit', 'buy_view', 'free_limit')),
  props      jsonb not null default '{}'::jsonb,
  day        date not null default prep.today(),
  created_at timestamptz not null default now()
);
create unique index events_once_a_day on prep.events (user_id, name, day);
create index events_by_name on prep.events (name, day);
alter table prep.events enable row level security;

create table prep.deletion_requests (
  id         int generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  note       text,
  status     text not null default 'pending' check (status in ('pending', 'done', 'rejected')),
  created_at timestamptz not null default now(),
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  admin_note text
);
create unique index deletion_one_pending on prep.deletion_requests (user_id) where status = 'pending';
alter table prep.deletion_requests enable row level security;

-- Fire-and-forget from the app. At most one row per user, event and day; the first 'visit' stores the source.
create function public.prep_track(p_name text, p_props jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  u   uuid := prep.uid();
  v_src text;
begin
  if p_name not in ('visit', 'buy_view', 'free_limit') then raise exception 'invalid_event'; end if;
  perform prep.lock_profile(u);
  if p_name = 'visit' then
    v_src := nullif(left(regexp_replace(lower(coalesce(p_props->>'src', '')), '[^a-z0-9_-]', '', 'g'), 40), '');
    if v_src is not null then update prep.profiles set src = v_src where user_id = u and profiles.src is null; end if;
  end if;
  insert into prep.events (user_id, name, props)
  values (u, p_name, case when p_name = 'visit' and v_src is not null then jsonb_build_object('src', v_src) else '{}'::jsonb end)
  on conflict (user_id, name, day) do nothing;
end $$;

create function public.prep_request_deletion(p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := prep.uid();
  r prep.deletion_requests;
begin
  select * into r from prep.deletion_requests where user_id = u and status = 'pending';
  if r.id is null then
    insert into prep.deletion_requests (user_id, note) values (u, nullif(left(trim(coalesce(p_note, '')), 300), ''))
    returning * into r;
  end if;
  return jsonb_build_object('id', r.id, 'status', r.status, 'created_at', r.created_at);
end $$;

create function public.prep_my_deletion() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object('id', id, 'status', status, 'created_at', created_at, 'handled_at', handled_at)
                     from prep.deletion_requests where user_id = prep.uid() order by id desc limit 1), 'null'::jsonb)
$$;

create function public.prep_admin_deletion_requests(p_status text default 'pending') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', d.id, 'email', au.email, 'user_id', d.user_id, 'note', d.note, 'status', d.status,
                                        'created_at', d.created_at, 'handled_at', d.handled_at, 'admin_note', d.admin_note)
                     order by d.created_at)
      from prep.deletion_requests d left join auth.users au on au.id = d.user_id
     where p_status is null or d.status = p_status), '[]'::jsonb);
end $$;

create function public.prep_admin_resolve_deletion(p_id int, p_status text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a uuid := prep.require_admin();
begin
  if p_status not in ('done', 'rejected') then raise exception 'invalid_status'; end if;
  update prep.deletion_requests
     set status = p_status, handled_by = a, handled_at = now(), admin_note = nullif(left(trim(coalesce(p_note, '')), 300), '')
   where id = p_id and status = 'pending';
  if not found then raise exception 'not_found'; end if;
  insert into prep.admin_actions (admin_id, user_id, action, detail)
  values (a, (select user_id from prep.deletion_requests where id = p_id), 'deletion_' || p_status,
          jsonb_build_object('request', p_id, 'note', nullif(left(trim(coalesce(p_note, '')), 300), '')));
  return jsonb_build_object('ok', true);
end $$;

-- Everything the chart tab draws, in one call. p_days is clamped to 7..90 (Bangkok calendar days, today included).
create function public.prep_admin_charts(p_days int default 30) returns jsonb
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

revoke execute on function public.prep_track(text, jsonb) from public, anon;
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('prep_track', 'prep_request_deletion', 'prep_my_deletion', 'prep_admin_deletion_requests',
                               'prep_admin_resolve_deletion', 'prep_admin_charts') loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
