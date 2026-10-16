-- Admin dashboard: a "to do today" block, revenue, packages about to expire, and user search with grant/revoke.
-- All new: one log table and new functions; no existing function or table is changed.
--  * prep_admin_dashboard(): to-do counts, revenue (Bangkok calendar days), order stats, expiring packages.
--  * prep_admin_find_user / prep_admin_user_detail: look a customer up by e-mail (prep users only).
--  * prep_admin_grant / prep_admin_revoke_entitlement: support actions, each written to prep.admin_actions.

create table prep.admin_actions (
  id         int generated always as identity primary key,
  admin_id   uuid references auth.users(id) on delete set null,
  user_id    uuid references auth.users(id) on delete set null,
  action     text not null,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_actions_user on prep.admin_actions (user_id, created_at desc);
alter table prep.admin_actions enable row level security;

-- Round packages ending within p_days that no other grant covers (a lifetime or longer grant of the same
-- package or of ALL means the customer is not about to lose access).
create function prep.expiring_soon(p_days int default 7)
returns table (user_id uuid, package text, exp timestamptz)
language sql stable set search_path = '' as $$
  select e.user_id, e.package, max(e.expires_at)
    from prep.entitlements e
   where e.revoked_at is null and e.expires_at > now() and e.expires_at <= now() + make_interval(days => p_days)
     and not exists (select 1 from prep.entitlements e2
                      where e2.user_id = e.user_id and e2.revoked_at is null
                        and (e2.expires_at is null or e2.expires_at > now() + make_interval(days => p_days))
                        and (e2.package = e.package or e2.package = 'ALL'))
   group by e.user_id, e.package
$$;

create function public.prep_admin_dashboard() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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
      'pending_orders',   (select count(*) from prep.orders where status = 'pending'),
      'oldest_pending_at',(select min(created_at) from prep.orders where status = 'pending'),
      'open_reports',     (select count(*) from prep.reports where status = 'open'),
      'review_queue',     (select count(*) from prep.questions where status = 'review'),
      'expiring_7d',      (select count(distinct user_id) from prep.expiring_soon(7))),
    'revenue', jsonb_build_object(
      'today',  coalesce((select sum(amount) from prep.orders where status = 'approved' and reviewed_at >= t0), 0),
      'last7',  coalesce((select sum(amount) from prep.orders where status = 'approved' and reviewed_at >= t7), 0),
      'last30', coalesce((select sum(amount) from prep.orders where status = 'approved' and reviewed_at >= t30), 0),
      'month',  coalesce((select sum(amount) from prep.orders where status = 'approved' and reviewed_at >= m0), 0),
      'submitted_30d', (select count(*) from prep.orders where created_at >= t30),
      'approved_30d',  (select count(*) from prep.orders where status = 'approved' and reviewed_at >= t30),
      'rejected_30d',  (select count(*) from prep.orders where status = 'rejected' and reviewed_at >= t30),
      'avg_review_minutes_30d',
        (select round(avg(extract(epoch from (reviewed_at - created_at)) / 60))::int
           from prep.orders where status in ('approved', 'rejected') and reviewed_at >= t30),
      'upgrade_orders_30d', (select count(*) from prep.orders where status = 'approved' and credit > 0 and reviewed_at >= t30),
      'upgrade_amount_30d', coalesce((select sum(amount) from prep.orders where status = 'approved' and credit > 0 and reviewed_at >= t30), 0),
      'by_package', coalesce((
        select jsonb_agg(jsonb_build_object('package', package, 'term', term, 'orders', n, 'amount', amt) order by amt desc)
          from (select package, term, count(*) n, sum(amount) amt from prep.orders
                 where status = 'approved' and reviewed_at >= t30 group by package, term) x), '[]'::jsonb)),
    'expiring', coalesce((
      select jsonb_agg(jsonb_build_object('email', au.email, 'package', x.package, 'expires_at', x.exp) order by x.exp)
        from (select * from prep.expiring_soon(7) order by exp limit 30) x
        join auth.users au on au.id = x.user_id), '[]'::jsonb));
end $$;

-- Customers who have used the prep app, by e-mail fragment (3+ characters, at most 10 results).
create function public.prep_admin_find_user(p_query text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare q text := lower(trim(coalesce(p_query, '')));
begin
  perform prep.require_admin();
  if length(q) < 3 then raise exception 'query_too_short'; end if;
  q := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', x.id, 'email', x.email, 'created_at', x.created_at,
             'packages', to_jsonb(prep.active_packages(x.id)),
             'last_active', (select max(d.day) from prep.daily_activity d where d.user_id = x.id),
             'orders', (select count(*) from prep.orders o where o.user_id = x.id)) order by x.created_at desc)
      from (select au.id, au.email, au.created_at
              from auth.users au join prep.profiles p on p.user_id = au.id
             where lower(au.email) like '%' || q || '%' escape '\'
             order by au.created_at desc limit 10) x), '[]'::jsonb);
end $$;

create function public.prep_admin_user_detail(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare au record;
begin
  perform prep.require_admin();
  select u.id, u.email, u.created_at, p.plan, p.free_sets_used, p.free_mock_used,
         (select t.name from prep.topics t where t.code = p.major) as major_name
    into au from auth.users u join prep.profiles p on p.user_id = u.id where u.id = p_user;
  if au.id is null then raise exception 'not_found'; end if;
  return jsonb_build_object(
    'user', jsonb_build_object('id', au.id, 'email', au.email, 'created_at', au.created_at, 'plan', au.plan,
                               'major_name', au.major_name, 'free_sets_used', au.free_sets_used, 'free_mock_used', au.free_mock_used),
    'entitlements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'package', e.package, 'starts_at', e.starts_at, 'expires_at', e.expires_at, 'revoked_at', e.revoked_at,
               'source', case when e.order_id is not null then 'คำสั่งซื้อ #' || e.order_id
                              when e.key_id is not null then 'คีย์' else 'แอดมินให้' end,
               'active', e.revoked_at is null and (e.expires_at is null or e.expires_at > now())) order by e.id desc)
        from prep.entitlements e where e.user_id = p_user), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'package', o.package, 'term', o.term, 'amount', o.amount, 'credit', o.credit,
                                          'status', o.status, 'created_at', o.created_at, 'reviewed_at', o.reviewed_at,
                                          'admin_note', o.admin_note) order by o.id desc)
        from (select * from prep.orders where user_id = p_user order by id desc limit 20) o), '[]'::jsonb),
    'activity', jsonb_build_object(
      'answered_total', coalesce((select sum(answered) from prep.daily_activity where user_id = p_user), 0),
      'last_active', (select max(day) from prep.daily_activity where user_id = p_user),
      'sets', (select count(*) from prep.sets where user_id = p_user),
      'mock_done', (select count(*) from prep.mock_attempts where user_id = p_user and submitted_at is not null)),
    'actions', coalesce((
      select jsonb_agg(jsonb_build_object('action', a.action, 'detail', a.detail, 'created_at', a.created_at) order by a.id desc)
        from (select * from prep.admin_actions where user_id = p_user order by id desc limit 10) a), '[]'::jsonb));
end $$;

-- Support grant: lifetime when p_duration_days is null, otherwise that many days (extends an active grant of the same package).
create function public.prep_admin_grant(p_user uuid, p_package text, p_duration_days int, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a    uuid := prep.require_admin();
  base timestamptz;
  exp  timestamptz;
begin
  if p_package not in ('A', 'B', 'ALL') then raise exception 'invalid_package'; end if;
  if p_duration_days is not null and (p_duration_days < 1 or p_duration_days > 3650) then raise exception 'invalid_duration'; end if;
  if not exists (select 1 from prep.profiles where user_id = p_user) then raise exception 'not_found'; end if;
  perform prep.lock_profile(p_user);
  if p_duration_days is not null then
    select greatest(now(), coalesce(max(e.expires_at), now())) into base
      from prep.entitlements e
     where e.user_id = p_user and e.package = p_package and e.revoked_at is null and e.expires_at > now();
    exp := base + make_interval(days => p_duration_days);
  end if;
  insert into prep.entitlements (user_id, package, expires_at) values (p_user, p_package, exp);
  update prep.profiles set plan = 'paid', paid_at = now() where user_id = p_user;
  insert into prep.admin_actions (admin_id, user_id, action, detail)
  values (a, p_user, 'grant', jsonb_build_object('package', p_package, 'days', p_duration_days, 'expires_at', exp,
                                                  'note', nullif(left(trim(coalesce(p_note, '')), 200), '')));
  return jsonb_build_object('ok', true, 'expires_at', exp);
end $$;

create function public.prep_admin_revoke_entitlement(p_id int, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a uuid := prep.require_admin();
  e prep.entitlements;
begin
  update prep.entitlements set revoked_at = now() where id = p_id and revoked_at is null returning * into e;
  if e.id is null then raise exception 'not_found'; end if;
  if cardinality(prep.active_packages(e.user_id)) = 0 then
    update prep.profiles set plan = 'free', paid_at = null where user_id = e.user_id;
  end if;
  insert into prep.admin_actions (admin_id, user_id, action, detail)
  values (a, e.user_id, 'revoke', jsonb_build_object('entitlement', e.id, 'package', e.package, 'expires_at', e.expires_at,
                                                      'note', nullif(left(trim(coalesce(p_note, '')), 200), '')));
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function prep.expiring_soon(int) from public;
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('prep_admin_dashboard', 'prep_admin_find_user', 'prep_admin_user_detail',
                               'prep_admin_grant', 'prep_admin_revoke_entitlement') loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
