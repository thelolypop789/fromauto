-- Admin analytics by major + a users list that opens already sorted (no search needed).
-- Read-only: two new functions, nothing existing is changed.

-- One row per major (plus "no major yet"): users, new users, active users (opened the app in the last p_days), answers,
-- sets created, paying users, revenue from approved orders, and the three topics the major's users answered most.
create function public.prep_admin_major_stats(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  d     int := greatest(1, least(coalesce(p_days, 30), 365));
  since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
begin
  perform prep.require_admin();
  return (
    with u as (
      select p.user_id, coalesce(p.major, '') as code, p.plan, p.created_at,
             coalesce((select sum(s.n) from prep.user_topic_stats s where s.user_id = p.user_id), 0)::bigint as answered,
             (select count(*) from prep.sets x where x.user_id = p.user_id) as sets,
             coalesce((select sum(o.amount) from prep.orders o where o.user_id = p.user_id and o.status = 'approved'), 0)::bigint as revenue,
             exists (select 1 from prep.events e where e.user_id = p.user_id and e.name = 'visit' and e.created_at >= since) as active
        from prep.profiles p),
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
                                           from prep.user_topic_stats s join u uu on uu.user_id = s.user_id and uu.code = per.code
                                          group by s.topic order by 2 desc limit 5) x
                                   join prep.topics tt on tt.code = x.topic), '[]'::jsonb) as top_topics
                  from per left join prep.topics t on t.code = per.code) r), '[]'::jsonb)));
end $$;

-- Users sorted by last activity (never-active ones last, newest sign-ups first among them).
-- p_filter: all | paid | free | nomajor.
create function public.prep_admin_list_users(p_filter text default 'all', p_offset int default 0, p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := greatest(1, least(coalesce(p_limit, 50), 100)); off_ int := greatest(0, coalesce(p_offset, 0));
begin
  perform prep.require_admin();
  if p_filter not in ('all', 'paid', 'free', 'nomajor') then raise exception 'bad_filter'; end if;
  return (
    with f as (
      select p.user_id, p.major, p.plan, p.created_at, p.src,
             (select max(a.day) from prep.daily_activity a where a.user_id = p.user_id) as last_active
        from prep.profiles p
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
                 'orders', (select count(*) from prep.orders o where o.user_id = g.user_id),
                 'answered', coalesce((select sum(s.n) from prep.user_topic_stats s where s.user_id = g.user_id), 0),
                 'sets', (select count(*) from prep.sets x where x.user_id = g.user_id))
               order by g.last_active desc nulls last, g.created_at desc)
          from page g join auth.users au on au.id = g.user_id), '[]'::jsonb)));
end $$;

do $$
declare f text;
begin
  for f in select unnest(array['public.prep_admin_major_stats(int)', 'public.prep_admin_list_users(text,int,int)']) loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
