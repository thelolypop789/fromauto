-- Phase 1: prices live in the database and the server prices every order, including upgrades.
--
--  * prep.prices: one row per (package, term). Admins can change a price without a deploy.
--  * prep.quote(user, package, term): what this user pays today. A buyer who already holds part of
--    what the target covers gets the paid value of that part deducted (A 99 -> ALL 179 pays 80), and
--    a round upgrade to ALL ends on the date of the round it replaces.
--  * prep_quotes(): the six quotes for the signed-in user (for the buy page).
--  * prep_submit_order: the stored amount is the server quote; the amount the browser sends is ignored.
--  * prep_admin_review_order: approval grants what the quote says (expiry for upgrades).
--  * prep_admin_orders: also returns credit and list_price so the admin sees how the amount was reached.
-- Additive tables/columns; replaces prep_submit_order, prep_admin_review_order, prep_admin_orders
-- (same signatures).

create table prep.prices (
  package text not null check (package in ('A', 'B', 'ALL')),
  term    text not null check (term in ('round', 'lifetime')),
  amount  int  not null check (amount between 1 and 100000),
  primary key (package, term)
);
alter table prep.prices enable row level security;
insert into prep.prices (package, term, amount) values
  ('A', 'round', 49), ('A', 'lifetime', 99),
  ('B', 'round', 69), ('B', 'lifetime', 129),
  ('ALL', 'round', 99), ('ALL', 'lifetime', 179)
on conflict do nothing;

alter table prep.orders add column if not exists credit int not null default 0;

-- Result: {package, term, base, credit, amount, kind, expires_at} or {error}.
-- kind: new | renew | upgrade. expires_at null = lifetime.
create function prep.quote(u uuid, p_pkg text, p_term text) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  base    int;
  credit  int := 0;
  secs    text[];
  s       text;
  held    int;
  exp     timestamptz;
  all_own boolean := true;
  kind    text := 'new';
begin
  select amount into base from prep.prices where package = p_pkg and term = p_term;
  if base is null then return jsonb_build_object('error', 'invalid_package'); end if;
  secs := case p_pkg when 'ALL' then array['A', 'B'] else array[p_pkg] end;

  -- Everything the target grants is already owned for life?
  foreach s in array secs loop
    if not exists (select 1 from prep.entitlements e
                    where e.user_id = u and e.revoked_at is null and e.expires_at is null
                      and e.package in (s, 'ALL')) then
      all_own := false;
    end if;
  end loop;
  if all_own then return jsonb_build_object('error', 'already_owned'); end if;

  -- Credit: paid value of the entitlements of the same section that the target replaces.
  if p_pkg = 'ALL' or p_term = 'lifetime' then
    foreach s in array secs loop
      select max(case when e.expires_at is null
                      then (select amount from prep.prices where package = s and term = 'lifetime')
                      else (select amount from prep.prices where package = s and term = 'round') end)
        into held
        from prep.entitlements e
       where e.user_id = u and e.package = s and e.revoked_at is null
         and (e.expires_at is null or e.expires_at > now());
      credit := credit + coalesce(held, 0);
    end loop;
  end if;

  if base - credit < 20 then return jsonb_build_object('error', 'nothing_to_upgrade'); end if;

  if p_term = 'lifetime' then
    exp := null;
  elsif p_pkg = 'ALL' and credit > 0 then
    -- Upgrade of a running round: ends with the round it replaces.
    select max(e.expires_at) into exp from prep.entitlements e
     where e.user_id = u and e.package in ('A', 'B') and e.revoked_at is null and e.expires_at > now();
    if exp is null then return jsonb_build_object('error', 'nothing_to_upgrade'); end if;
    -- Already upgraded: an ALL entitlement covers that period, a second upgrade would add nothing.
    if exists (select 1 from prep.entitlements e
                where e.user_id = u and e.package = 'ALL' and e.revoked_at is null
                  and (e.expires_at is null or e.expires_at >= exp)) then
      return jsonb_build_object('error', 'already_owned');
    end if;
  else
    -- New or renewed round: 90 days, counted from the end of an active round of the same package.
    select greatest(now(), coalesce(max(e.expires_at), now())) + interval '90 days' into exp
      from prep.entitlements e
     where e.user_id = u and e.package = p_pkg and e.revoked_at is null and e.expires_at > now();
  end if;

  if credit > 0 then kind := 'upgrade';
  elsif exists (select 1 from prep.entitlements e
                 where e.user_id = u and e.package = p_pkg and e.revoked_at is null
                   and (e.expires_at is null or e.expires_at > now())) then kind := 'renew';
  end if;

  return jsonb_build_object('package', p_pkg, 'term', p_term, 'base', base, 'credit', credit,
                            'amount', base - credit, 'kind', kind, 'expires_at', exp);
end $$;

create function public.prep_prices() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('package', package, 'term', term, 'amount', amount)
                            order by package, term desc), '[]'::jsonb)
    from prep.prices
$$;

-- One quote per (package, term) for the signed-in user; an unavailable choice carries its error.
create function public.prep_quotes() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := prep.uid();
begin
  return coalesce((
    select jsonb_agg(prep.quote(u, p.package, p.term) ||
                     jsonb_build_object('package', p.package, 'term', p.term)
                     order by case p.package when 'A' then 1 when 'B' then 2 else 3 end, p.term desc)
      from prep.prices p), '[]'::jsonb);
end $$;

create function public.prep_admin_set_price(p_package text, p_term text, p_amount int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  if p_amount is null or p_amount < 1 or p_amount > 100000 then raise exception 'invalid_price'; end if;
  update prep.prices set amount = p_amount where package = p_package and term = p_term;
  if not found then raise exception 'invalid_package'; end if;
end $$;

-- p_amount is kept for compatibility and ignored: the server prices the order.
create or replace function public.prep_submit_order(p_package text, p_term text, p_amount int, p_slip_path text, p_note text default null)
returns int
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.uid(); oid int; q jsonb;
begin
  if p_package not in ('A', 'B', 'ALL') then raise exception 'invalid_package'; end if;
  if p_term not in ('round', 'lifetime') then raise exception 'invalid_duration'; end if;
  if p_slip_path is null or split_part(p_slip_path, '/', 1) <> u::text then raise exception 'invalid_slip'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'prep-slips' and o.name = p_slip_path) then
    raise exception 'invalid_slip';
  end if;
  if (select count(*) from prep.orders where user_id = u and status = 'pending') >= 3 then
    raise exception 'too_many_orders';
  end if;
  q := prep.quote(u, p_package, p_term);
  if q ? 'error' then raise exception '%', q->>'error'; end if;
  insert into prep.orders (user_id, package, term, amount, credit, slip_path, note)
  values (u, p_package, p_term, (q->>'amount')::int, (q->>'credit')::int, p_slip_path,
          nullif(left(trim(coalesce(p_note, '')), 300), ''))
  returning id into oid;
  return oid;
end $$;

create or replace function public.prep_admin_orders(p_status text default 'pending', p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', o.id, 'email', au.email, 'package', o.package, 'term', o.term, 'amount', o.amount,
             'credit', o.credit,
             'list_price', (select pr.amount from prep.prices pr where pr.package = o.package and pr.term = o.term),
             'slip_path', o.slip_path, 'note', o.note, 'status', o.status, 'admin_note', o.admin_note,
             'created_at', o.created_at, 'reviewed_at', o.reviewed_at,
             'active_packages', to_jsonb(prep.active_packages(o.user_id)))
           order by case when o.status = 'pending' then o.created_at end asc, o.created_at desc)
      from (select * from prep.orders
             where p_status is null or status = p_status
             order by created_at desc limit greatest(1, least(coalesce(p_limit, 50), 200))) o
      left join auth.users au on au.id = o.user_id), '[]'::jsonb);
end $$;

-- Approve: grants what the quote says right now (an upgrade ends with the round it replaces).
-- If the account's situation changed since the slip was sent and no quote exists any more,
-- the plain grant (90 days from any active round, or lifetime) is used.
create or replace function public.prep_admin_review_order(p_id int, p_approve boolean, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a    uuid := prep.require_admin();
  o    prep.orders;
  q    jsonb;
  base timestamptz;
  exp  timestamptz;
begin
  select * into o from prep.orders where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if o.status <> 'pending' then raise exception 'already_reviewed'; end if;

  update prep.orders
     set status = case when p_approve then 'approved' else 'rejected' end,
         admin_note = nullif(trim(coalesce(p_note, '')), ''), reviewed_by = a, reviewed_at = now()
   where id = p_id;
  if not p_approve then return jsonb_build_object('ok', true, 'status', 'rejected'); end if;

  perform prep.lock_profile(o.user_id);
  q := prep.quote(o.user_id, o.package, o.term);
  if not (q ? 'error') then
    exp := (q->>'expires_at')::timestamptz;
  elsif o.term = 'round' then
    select greatest(now(), coalesce(max(e.expires_at), now())) into base
      from prep.entitlements e
     where e.user_id = o.user_id and e.package = o.package and e.revoked_at is null and e.expires_at > now();
    exp := base + interval '90 days';
  else
    exp := null;
  end if;
  insert into prep.entitlements (user_id, package, expires_at, order_id) values (o.user_id, o.package, exp, o.id);
  update prep.profiles set plan = 'paid', paid_at = now() where user_id = o.user_id;
  return jsonb_build_object('ok', true, 'status', 'approved', 'expires_at', exp,
                            'kind', coalesce(q->>'kind', 'new'));
end $$;

revoke execute on function prep.quote(uuid, text, text) from public;
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('prep_prices', 'prep_quotes', 'prep_admin_set_price', 'prep_submit_order',
                               'prep_admin_orders', 'prep_admin_review_order') loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
