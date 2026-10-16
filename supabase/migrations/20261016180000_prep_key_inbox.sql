-- Key inbox: an admin sends a package to a customer by e-mail address from inside the app. The customer sees it in
-- the app after signing in with that e-mail and activates it with one tap; no key text is ever typed or sent by chat.
-- The key itself stays hashed like every other key (no plaintext is stored anywhere); the inbox row points at it.
-- All new: one table, helper functions and public functions. No existing function is replaced.

create table prep.key_inbox (
  id         int generated always as identity primary key,
  email      text not null,                                  -- recipient, lower-case
  key_id     int  not null references prep.keys(id) on delete cascade,
  message    text,
  sent_by    uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz
);
create index key_inbox_email on prep.key_inbox (email);
alter table prep.key_inbox enable row level security;

-- Same grant as prep_redeem_key: a dated key ends at the end of that day (Bangkok), a day-count key extends an
-- active entitlement of the same package, otherwise it is a lifetime grant.
create function prep.grant_from_key(u uuid, k prep.keys) returns timestamptz
language plpgsql set search_path = '' as $$
declare
  base timestamptz;
  exp  timestamptz;
begin
  if k.expires_on is not null then
    exp := ((k.expires_on + 1)::timestamp at time zone 'Asia/Bangkok');
  elsif k.duration_days is not null then
    select greatest(now(), coalesce(max(e.expires_at), now())) into base
      from prep.entitlements e
     where e.user_id = u and e.package = k.package and e.revoked_at is null and e.expires_at > now();
    exp := base + make_interval(days => k.duration_days);
  else
    exp := null;
  end if;
  insert into prep.entitlements (user_id, package, expires_at, key_id) values (u, k.package, exp, k.id);
  update prep.profiles set plan = 'paid', paid_at = now(), redeem_fails = 0 where user_id = u;
  return exp;
end $$;

-- Admin: send a package to an e-mail address. Exactly one of: lifetime (both null), p_duration_days, p_expires_on.
create function public.prep_admin_send_key(
  p_email text, p_package text, p_duration_days int, p_expires_on date, p_note text, p_message text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a   uuid := prep.require_admin();
  em  text := lower(trim(coalesce(p_email, '')));
  kid int;
  iid int;
begin
  if length(em) > 200 or em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if p_package not in ('A', 'B', 'ALL') then raise exception 'invalid_package'; end if;
  if p_duration_days is not null and p_expires_on is not null then raise exception 'invalid_duration'; end if;
  if p_duration_days is not null and (p_duration_days < 1 or p_duration_days > 3650) then raise exception 'invalid_duration'; end if;
  if p_expires_on is not null and p_expires_on < prep.today() then raise exception 'invalid_duration'; end if;
  if (select count(*) from prep.key_inbox ib join prep.keys k on k.id = ib.key_id
       where ib.email = em and ib.claimed_at is null and k.revoked_at is null) >= 5 then
    raise exception 'too_many_pending';
  end if;

  insert into prep.keys (key_hash, note, created_by, package, duration_days, expires_on)
  values (prep.hash_key(encode(extensions.gen_random_bytes(16), 'hex')),
          left(trim(coalesce(p_note, '')) || ' · ส่งในระบบถึง ' || em, 300), a, p_package, p_duration_days, p_expires_on)
  returning id into kid;
  insert into prep.key_inbox (email, key_id, message, sent_by)
  values (em, kid, nullif(left(trim(coalesce(p_message, '')), 300), ''), a)
  returning id into iid;
  return jsonb_build_object('id', iid, 'email', em,
                            'registered', exists (select 1 from auth.users au where lower(au.email) = em));
end $$;

create function public.prep_admin_key_inbox(p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', ib.id, 'key_id', k.id, 'email', ib.email, 'package', k.package,
             'duration_days', k.duration_days, 'expires_on', k.expires_on, 'message', ib.message,
             'created_at', ib.created_at, 'claimed_at', ib.claimed_at,
             'registered', exists (select 1 from auth.users au where lower(au.email) = ib.email),
             'status', case when ib.claimed_at is not null then 'claimed'
                            when k.revoked_at is not null then 'revoked'
                            when k.expires_on is not null and k.expires_on < prep.today() then 'expired'
                            else 'pending' end)
           order by ib.created_at desc)
      from (select * from prep.key_inbox order by created_at desc limit greatest(1, least(coalesce(p_limit, 100), 300))) ib
      join prep.keys k on k.id = ib.key_id), '[]'::jsonb);
end $$;

-- Customer: packages waiting for the signed-in e-mail address.
create function public.prep_my_inbox() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  u  uuid := prep.uid();
  em text := lower((select au.email from auth.users au where au.id = u));
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', ib.id, 'package', k.package, 'duration_days', k.duration_days, 'expires_on', k.expires_on,
             'message', ib.message, 'created_at', ib.created_at)
           order by ib.created_at desc)
      from prep.key_inbox ib join prep.keys k on k.id = ib.key_id
     where ib.email = em and ib.claimed_at is null
       and k.redeemed_by is null and k.revoked_at is null
       and (k.expires_on is null or k.expires_on >= prep.today())), '[]'::jsonb);
end $$;

create function public.prep_claim_inbox(p_id int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u   uuid := prep.uid();
  p   prep.profiles;
  em  text := lower((select au.email from auth.users au where au.id = u));
  ib  prep.key_inbox;
  k   prep.keys;
  exp timestamptz;
begin
  p := prep.lock_profile(u);
  select * into ib from prep.key_inbox where id = p_id and email = em for update;
  if not found then raise exception 'not_found'; end if;
  if ib.claimed_at is not null then raise exception 'already_claimed'; end if;

  update prep.keys set redeemed_by = u, redeemed_at = now()
   where id = ib.key_id and redeemed_by is null and revoked_at is null
     and (expires_on is null or expires_on >= prep.today())
  returning * into k;
  if k.id is null then raise exception 'invalid_key'; end if;

  exp := prep.grant_from_key(u, k);
  update prep.key_inbox set claimed_by = u, claimed_at = now() where id = ib.id;
  return jsonb_build_object('ok', true, 'package', k.package, 'expires_at', exp);
end $$;

revoke execute on function prep.grant_from_key(uuid, prep.keys) from public;
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('prep_admin_send_key', 'prep_admin_key_inbox', 'prep_my_inbox', 'prep_claim_inbox') loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
