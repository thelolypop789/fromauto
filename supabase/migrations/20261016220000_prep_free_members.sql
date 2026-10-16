-- Free memberships are told apart from paid ones.
--  * prep.keys.free / prep.entitlements.free: set when the admin makes a giveaway key, copied to the entitlement on redeem.
--  * Admin grants (support action) are always free; existing ones (no order, no key) are backfilled as free.
--  * prep_admin_stats: 'paid' no longer counts free-only members; new 'free_members'.
-- Keys sold by hand stay non-free (free = false), so earlier keys keep counting as paid.

alter table prep.keys add column if not exists free boolean not null default false;
alter table prep.entitlements add column if not exists free boolean not null default false;
update prep.entitlements set free = true where order_id is null and key_id is null and not free;

create or replace function public.prep_redeem_key(p_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u    uuid := prep.uid();
  p    prep.profiles;
  k    prep.keys;
  base timestamptz;
  exp  timestamptz;
begin
  p := prep.lock_profile(u);
  if p.redeem_fails >= 5 and p.redeem_fail_at > now() - interval '15 minutes' then
    return jsonb_build_object('ok', false, 'error', 'too_many_attempts');
  end if;

  update prep.keys
     set redeemed_by = u, redeemed_at = now()
   where key_hash = prep.hash_key(p_key) and redeemed_by is null and revoked_at is null
     and (expires_on is null or expires_on >= prep.today())
  returning * into k;

  if k.id is null then
    update prep.profiles
       set redeem_fails = case when redeem_fail_at > now() - interval '15 minutes' then redeem_fails + 1 else 1 end,
           redeem_fail_at = now()
     where user_id = u;
    return jsonb_build_object('ok', false, 'error', 'invalid_key');
  end if;

  if k.expires_on is not null then
    exp := ((k.expires_on + 1)::timestamp at time zone 'Asia/Bangkok');
  elsif k.duration_days is not null then
    select greatest(now(), coalesce(max(e.expires_at), now())) into base
      from prep.entitlements e
     where e.user_id = u and e.package = k.package and e.revoked_at is null and e.expires_at > now();
    exp := base + make_interval(days => k.duration_days);
  else
    exp := null;   -- lifetime
  end if;

  insert into prep.entitlements (user_id, package, expires_at, key_id, free) values (u, k.package, exp, k.id, k.free);
  update prep.profiles set plan = 'paid', paid_at = now(), redeem_fails = 0 where user_id = u;
  return jsonb_build_object('ok', true, 'package', k.package, 'expires_at', exp);
end $$;


drop function if exists public.prep_admin_create_package_keys(int, text, text, int, date);
create function public.prep_admin_create_package_keys(
  p_count int, p_note text, p_package text, p_duration_days int, p_expires_on date, p_free boolean default false
) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  u        uuid := prep.require_admin();
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- no 0/O/1/I
  b        bytea;
  k        text;
  out      text[] := '{}';
begin
  if p_count is null or p_count < 1 or p_count > 50 then raise exception 'invalid_count'; end if;
  if p_package not in ('A', 'B', 'ALL') then raise exception 'invalid_package'; end if;
  if p_duration_days is not null and p_expires_on is not null then raise exception 'invalid_duration'; end if;
  if p_duration_days is not null and (p_duration_days < 1 or p_duration_days > 3650) then raise exception 'invalid_duration'; end if;
  if p_expires_on is not null and p_expires_on < prep.today() then raise exception 'invalid_duration'; end if;
  for n in 1..p_count loop
    b := extensions.gen_random_bytes(12);
    k := 'PREP';
    for j in 0..11 loop
      if j % 4 = 0 then k := k || '-'; end if;
      k := k || substr(alphabet, (get_byte(b, j) % 32) + 1, 1);
    end loop;
    insert into prep.keys (key_hash, note, created_by, package, duration_days, expires_on, free)
    values (prep.hash_key(k), p_note, u, p_package, p_duration_days, p_expires_on, coalesce(p_free, false));
    out := out || k;
  end loop;
  return out;
end $$;

create or replace function public.prep_admin_list_keys() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare res jsonb;
begin
  perform prep.require_admin();
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', k.id, 'note', k.note, 'created_at', k.created_at,
    'redeemed_at', k.redeemed_at, 'redeemed_email', au.email, 'revoked_at', k.revoked_at,
    'package', k.package, 'free', k.free, 'duration_days', k.duration_days, 'expires_on', k.expires_on,
    'access_until', (select e.expires_at from prep.entitlements e where e.key_id = k.id order by e.id desc limit 1)
  ) order by k.created_at desc), '[]'::jsonb) into res
  from prep.keys k left join auth.users au on au.id = k.redeemed_by;
  return res;
end $$;

create or replace function public.prep_admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return jsonb_build_object(
    'users',          (select count(*) from prep.profiles),
    'paid',           (select count(distinct user_id) from prep.entitlements
                        where revoked_at is null and (expires_at is null or expires_at > now()) and not free),
    'free_members',   (select count(distinct user_id) from prep.entitlements e
                        where revoked_at is null and (expires_at is null or expires_at > now()) and free
                          and not exists (select 1 from prep.entitlements x where x.user_id = e.user_id and not x.free
                                           and x.revoked_at is null and (x.expires_at is null or x.expires_at > now()))),
    'answered_today', coalesce((select sum(answered) from prep.daily_activity where day = prep.today()), 0),
    'active_today',   (select count(*) from prep.daily_activity where day = prep.today()),
    'questions',      (select jsonb_object_agg(status, n) from
                        (select status, count(*) n from prep.questions group by status) s),
    'open_reports',   (select count(*) from prep.reports where status = 'open'),
    'keys_unused',    (select count(*) from prep.keys where redeemed_by is null and revoked_at is null)
  );
end $$;

create or replace function public.prep_admin_user_detail(p_user uuid) returns jsonb
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
                              when e.key_id is not null then (case when e.free then 'คีย์ฟรี' else 'คีย์' end) else 'แอดมินให้ (ฟรี)' end, 'free', e.free,
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

create or replace function public.prep_admin_grant(p_user uuid, p_package text, p_duration_days int, p_note text default null) returns jsonb
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
  insert into prep.entitlements (user_id, package, expires_at, free) values (p_user, p_package, exp, true);
  update prep.profiles set plan = 'paid', paid_at = now() where user_id = p_user;
  insert into prep.admin_actions (admin_id, user_id, action, detail)
  values (a, p_user, 'grant', jsonb_build_object('package', p_package, 'days', p_duration_days, 'expires_at', exp,
                                                  'note', nullif(left(trim(coalesce(p_note, '')), 200), '')));
  return jsonb_build_object('ok', true, 'expires_at', exp);
end $$;

revoke execute on function public.prep_admin_create_package_keys(int, text, text, int, date, boolean) from public, anon;
grant execute on function public.prep_admin_create_package_keys(int, text, text, int, date, boolean) to authenticated;
