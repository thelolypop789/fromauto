-- Packages: ภาค ก (A), ภาค ข + วิชาเอก (B), ครบทุกภาค (ALL); each key is lifetime (ซื้อขาด),
-- a number of days, or valid until a date (รอบสอบ). Payment stays manual: admin checks the slip
-- and issues a key. Existing paid users keep a lifetime ALL entitlement.
-- Adds: key columns, prep.entitlements; replaces prep_me, prep_create_set, prep_redeem_key,
-- prep_admin_list_keys, prep_admin_revoke_key, prep_admin_stats with compatible signatures.

alter table prep.keys
  add column if not exists package       text not null default 'ALL' check (package in ('A', 'B', 'ALL')),
  add column if not exists duration_days int  check (duration_days between 1 and 3650),
  add column if not exists expires_on    date;

create table if not exists prep.entitlements (
  id         int generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  package    text not null check (package in ('A', 'B', 'ALL')),
  starts_at  timestamptz not null default now(),
  expires_at timestamptz,                                  -- null = lifetime (ซื้อขาด)
  key_id     int references prep.keys(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists entitlements_user on prep.entitlements (user_id) where revoked_at is null;
alter table prep.entitlements enable row level security;

-- Backfill: every current paid account becomes lifetime ALL (from its key when there is one).
insert into prep.entitlements (user_id, package, starts_at, expires_at, key_id)
select p.user_id, 'ALL', coalesce(k.redeemed_at, p.paid_at, now()), null, k.id
  from prep.profiles p
  left join lateral (select * from prep.keys k where k.redeemed_by = p.user_id and k.revoked_at is null
                     order by k.redeemed_at limit 1) k on true
 where p.plan = 'paid'
   and not exists (select 1 from prep.entitlements e where e.user_id = p.user_id);

-- Active packages of a user: e.g. {B} or {A,B} or {ALL}.
create function prep.active_packages(u uuid) returns text[]
language sql stable set search_path = '' as $$
  select coalesce(array_agg(distinct package), '{}')
    from prep.entitlements
   where user_id = u and revoked_at is null and (expires_at is null or expires_at > now())
$$;

-- True when the packages cover every topic (by section A/B).
create function prep.covers(pkgs text[], topics text[]) returns boolean
language sql stable set search_path = '' as $$
  select 'ALL' = any (pkgs) or (
    cardinality(topics) > 0 and not exists (
      select 1 from prep.topics t where t.code = any (topics) and not (t.section = any (pkgs))))
$$;

create or replace function public.prep_me() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u    uuid := prep.uid();
  p    prep.profiles;
  pkgs text[];
begin
  p := prep.lock_profile(u);
  pkgs := prep.active_packages(u);
  return jsonb_build_object(
    'plan',            case when cardinality(pkgs) > 0 then 'paid' else 'free' end,
    'packages',        coalesce((
       select jsonb_agg(jsonb_build_object('package', package, 'expires_at', expires_at) order by package)
         from (select package, case when bool_or(expires_at is null) then null else max(expires_at) end as expires_at
                 from prep.entitlements
                where user_id = u and revoked_at is null and (expires_at is null or expires_at > now())
                group by package) x), '[]'::jsonb),
    'free_sets_used',  p.free_sets_used,
    'free_sets_limit', 3,
    'max_set_size',    case when cardinality(pkgs) > 0 then 200 else 40 end,
    'is_admin',        prep.is_admin(u),
    'answered_today',  coalesce((select d.answered from prep.daily_activity d
                                  where d.user_id = u and d.day = prep.today()), 0),
    'daily_cap',       1000
  );
end $$;

-- p_mode: 'new' = unseen questions first, 'weak' = questions answered wrong first, 'mixed' = random
-- A set whose topics are all inside the user's packages is unlimited (up to 200 questions);
-- anything else uses the free quota (3 sets, up to 40 questions).
create or replace function public.prep_create_set(p_topics text[], p_size int, p_mode text default 'new', p_title text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  u       uuid := prep.uid();
  p       prep.profiles;
  covered boolean;
  maxsize int;
  ids     int[];
  sid     uuid;
  n_sets  int;
begin
  p := prep.lock_profile(u);                     -- row lock serialises the free quota
  if p_topics is null or cardinality(p_topics) = 0 then
    raise exception 'no_topics';
  end if;
  covered := prep.covers(prep.active_packages(u), p_topics);
  maxsize := case when covered then 200 else 40 end;
  if p_size is null or p_size < 5 or p_size > maxsize then
    raise exception 'invalid_size';
  end if;
  if not covered and p.free_sets_used >= 3 then
    raise exception 'free_quota_exceeded';
  end if;
  if p_mode not in ('new', 'weak', 'mixed') then
    raise exception 'invalid_mode';
  end if;

  select array_agg(x.id) into ids
  from (
    select q.id
    from prep.questions q
    left join prep.user_question_state s on s.user_id = u and s.question_id = q.id
    where q.status = 'approved' and q.topic = any (p_topics)
    order by
      case p_mode
        when 'new'  then case when s.question_id is null then 0 else 1 end
        when 'weak' then case when s.last_correct = false then 0
                              when s.question_id is null then 1 else 2 end
        else 0
      end,
      case when p_mode = 'weak' then -coalesce(s.wrong, 0) else 0 end,
      random()
    limit p_size
  ) x;

  if ids is null or cardinality(ids) < 5 then
    raise exception 'not_enough_questions';
  end if;

  select count(*) into n_sets from prep.sets where user_id = u;

  insert into prep.sets (user_id, title, topics, question_ids, is_free)
  values (u,
          coalesce(nullif(left(trim(p_title), 80), ''), 'ชุดที่ ' || (n_sets + 1)),
          p_topics, ids, not covered)
  returning id into sid;

  if not covered then
    update prep.profiles set free_sets_used = free_sets_used + 1 where user_id = u;
  end if;

  return sid;
end $$;

-- Redeem: adds the key's package. A time-limited key extends an active entitlement of the same
-- package from its current end date; a dated key ends at the end of that day (Bangkok time).
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

  insert into prep.entitlements (user_id, package, expires_at, key_id) values (u, k.package, exp, k.id);
  update prep.profiles set plan = 'paid', paid_at = now(), redeem_fails = 0 where user_id = u;
  return jsonb_build_object('ok', true, 'package', k.package, 'expires_at', exp);
end $$;

-- Admin: keys for a package. Exactly one of: lifetime (both null), p_duration_days, p_expires_on.
create function public.prep_admin_create_package_keys(
  p_count int, p_note text, p_package text, p_duration_days int, p_expires_on date
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
    insert into prep.keys (key_hash, note, created_by, package, duration_days, expires_on)
    values (prep.hash_key(k), p_note, u, p_package, p_duration_days, p_expires_on);
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
    'package', k.package, 'duration_days', k.duration_days, 'expires_on', k.expires_on,
    'access_until', (select e.expires_at from prep.entitlements e where e.key_id = k.id order by e.id desc limit 1)
  ) order by k.created_at desc), '[]'::jsonb) into res
  from prep.keys k left join auth.users au on au.id = k.redeemed_by;
  return res;
end $$;

-- Revoking a key removes the access it granted; the account is free again if nothing else is active.
create or replace function public.prep_admin_revoke_key(p_id int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := prep.require_admin();
  r uuid;
begin
  update prep.keys set revoked_at = now() where id = p_id and revoked_at is null returning redeemed_by into r;
  update prep.entitlements set revoked_at = now() where key_id = p_id and revoked_at is null;
  if r is not null and cardinality(prep.active_packages(r)) = 0 then
    update prep.profiles set plan = 'free', paid_at = null where user_id = r;
  end if;
end $$;

create or replace function public.prep_admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return jsonb_build_object(
    'users',          (select count(*) from prep.profiles),
    'paid',           (select count(distinct user_id) from prep.entitlements
                        where revoked_at is null and (expires_at is null or expires_at > now())),
    'answered_today', coalesce((select sum(answered) from prep.daily_activity where day = prep.today()), 0),
    'active_today',   (select count(*) from prep.daily_activity where day = prep.today()),
    'questions',      (select jsonb_object_agg(status, n) from
                        (select status, count(*) n from prep.questions group by status) s),
    'open_reports',   (select count(*) from prep.reports where status = 'open'),
    'keys_unused',    (select count(*) from prep.keys where redeemed_by is null and revoked_at is null)
  );
end $$;

revoke execute on function prep.active_packages(uuid) from public;
revoke execute on function prep.covers(text[], text[]) from public;
revoke execute on function public.prep_admin_create_package_keys(int, text, text, int, date) from public, anon;
grant execute on function public.prep_admin_create_package_keys(int, text, text, int, date) to authenticated;
