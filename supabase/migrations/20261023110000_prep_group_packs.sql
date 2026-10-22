-- Group packs ("ซื้อคู่ / ซื้อกลุ่ม"): one payment for N seats at a lower price per person. The buyer receives N one-time
-- keys in the app (account page) to use themselves or hand to friends; keys use the existing redeem flow, so each
-- friend's own access starts when THEY redeem (round = 90 days from redemption, lifetime = lifetime).
--   * prep.group_deals: seats, name, emoji, % off per person, active. Editable by admins.
--   * Per-seat price = list price x (100 - %) / 100, rounded to a whole baht; total = per seat x seats.
--   * Group packs do not combine with promo codes and ignore upgrade credit (they are always full-price seats).
--   * prep.order_keys keeps the plain keys of a group order so the buyer can see them again; only the owner can read
--     them (prep_my_group_keys). Admins see only that keys were issued.

create table prep.group_deals (
  seats   int primary key check (seats between 2 and 10),
  name    text not null check (char_length(name) between 2 and 30),
  emoji   text not null default '🔥',
  pct_off int  not null check (pct_off between 1 and 60),
  active  boolean not null default true
);
alter table prep.group_deals enable row level security;
insert into prep.group_deals (seats, name, emoji, pct_off) values
  (2, 'คู่หูไฟลุก', '🔥', 20),
  (5, 'แก๊งเปลวไฟ', '🚀', 30);

alter table prep.orders add column seats int not null default 1 check (seats between 1 and 10),
                        add column group_name text;

create table prep.order_keys (
  order_id  int not null references prep.orders(id) on delete cascade,
  key_id    int not null unique references prep.keys(id) on delete cascade,
  key_plain text not null,
  primary key (order_id, key_id)
);
alter table prep.order_keys enable row level security;

create function prep.seat_price(base int, pct int) returns int
language sql immutable set search_path = '' as $$ select greatest(1, round(base * (100 - pct) / 100.0)::int) $$;

-- Every active deal for every price row (what the buy screen shows).
create function public.prep_group_quotes() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'seats', d.seats, 'name', d.name, 'emoji', d.emoji, 'pct_off', d.pct_off,
           'package', p.package, 'term', p.term, 'base', p.amount,
           'per_seat', prep.seat_price(p.amount, d.pct_off), 'total', prep.seat_price(p.amount, d.pct_off) * d.seats,
           'save', p.amount * d.seats - prep.seat_price(p.amount, d.pct_off) * d.seats)
         order by d.seats, case p.package when 'A' then 1 when 'B' then 2 else 3 end, p.term desc), '[]'::jsonb)
    from prep.group_deals d cross join prep.prices p where d.active
$$;

-- Keys for an approved group order (admin approval path only).
create function prep.make_group_keys(p_order int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  o        prep.orders;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b        bytea; k text; kid int;
begin
  select * into o from prep.orders where id = p_order;
  if not found or o.seats < 2 then return; end if;
  if exists (select 1 from prep.order_keys where order_id = p_order) then return; end if;   -- idempotent
  for n in 1..o.seats loop
    b := extensions.gen_random_bytes(12);
    k := 'PREP';
    for j in 0..11 loop
      if j % 4 = 0 then k := k || '-'; end if;
      k := k || substr(alphabet, (get_byte(b, j) % 32) + 1, 1);
    end loop;
    insert into prep.keys (key_hash, note, created_by, package, duration_days, free)
    values (prep.hash_key(k), 'แพ็กกลุ่ม #' || o.id || ' ' || coalesce(o.group_name, ''), o.reviewed_by, o.package,
            case when o.term = 'round' then 90 end, false)
    returning id into kid;
    insert into prep.order_keys (order_id, key_id, key_plain) values (p_order, kid, k);
  end loop;
end $$;

-- The buyer's own group orders with their keys and whether each was used.
create function public.prep_my_group_keys() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'order_id', o.id, 'name', o.group_name, 'seats', o.seats, 'package', o.package, 'term', o.term, 'created_at', o.reviewed_at,
           'keys', (select jsonb_agg(jsonb_build_object('key', ok.key_plain, 'used', k.redeemed_by is not null, 'mine', k.redeemed_by = prep.uid(),
                                                         'revoked', k.revoked_at is not null) order by ok.key_id)
                      from prep.order_keys ok join prep.keys k on k.id = ok.key_id where ok.order_id = o.id))
         order by o.reviewed_at desc), '[]'::jsonb)
    from prep.orders o
   where o.user_id = prep.uid() and o.status = 'approved' and o.seats > 1
$$;

-- Admin: edit a deal (name, % off, on/off). Existing orders keep the price they were made at.
create function public.prep_admin_group_deal_set(p_seats int, p_name text, p_pct int, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  if p_pct is null or p_pct not between 1 and 60 or char_length(coalesce(trim(p_name), '')) not between 2 and 30 then raise exception 'bad_deal'; end if;
  update prep.group_deals set name = trim(p_name), pct_off = p_pct, active = coalesce(p_active, true) where seats = p_seats;
  if not found then raise exception 'not_found'; end if;
end $$;

create function public.prep_admin_group_deals() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return coalesce((select jsonb_agg(to_jsonb(d) order by d.seats) from prep.group_deals d), '[]'::jsonb);
end $$;

-- ---------- ordering ----------
drop function public.prep_submit_order(text, text, integer, text, text, text);
create function public.prep_submit_order(p_package text, p_term text, p_amount integer, p_slip_path text,
                                         p_note text default null, p_promo text default null, p_seats int default 1) returns integer
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.uid(); oid int; q jsonb; d prep.group_deals; base int; n_seats int := coalesce(p_seats, 1);
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
  if n_seats > 1 then
    if nullif(trim(coalesce(p_promo, '')), '') is not null then raise exception 'promo_not_with_group'; end if;
    select * into d from prep.group_deals where group_deals.seats = n_seats and active;
    if not found then raise exception 'invalid_group'; end if;
    select amount into base from prep.prices where package = p_package and term = p_term;
    if base is null then raise exception 'invalid_package'; end if;
    insert into prep.orders (user_id, package, term, amount, credit, slip_path, note, seats, group_name)
    values (u, p_package, p_term, prep.seat_price(base, d.pct_off) * n_seats, 0, p_slip_path,
            nullif(left(trim(coalesce(p_note, '')), 300), ''), n_seats, d.name)
    returning id into oid;
    return oid;
  end if;
  if nullif(trim(coalesce(p_promo, '')), '') is null then
    q := prep.quote(u, p_package, p_term);
  else
    q := prep.promo_quote(u, p_promo, p_package, p_term, true);
  end if;
  if q ? 'error' then raise exception '%', q->>'error'; end if;
  insert into prep.orders (user_id, package, term, amount, credit, slip_path, note, promo_code, discount)
  values (u, p_package, p_term, (q->>'amount')::int, (q->>'credit')::int, p_slip_path,
          nullif(left(trim(coalesce(p_note, '')), 300), ''), q->>'code', coalesce((q->>'discount')::int, 0))
  returning id into oid;
  return oid;
end $$;

-- ---------- list / review functions carry the seats ----------
create or replace function public.prep_admin_review_order(p_id integer, p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if o.seats > 1 then                      -- group pack: the buyer gets one key per seat (shown in the app), no entitlement yet
    perform prep.make_group_keys(o.id);
    return jsonb_build_object('ok', true, 'status', 'approved', 'keys', o.seats, 'kind', 'group');
  end if;

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
end $function$;

create or replace function public.prep_admin_orders(p_status text DEFAULT 'pending'::text, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform prep.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', o.id, 'email', au.email, 'package', o.package, 'term', o.term, 'amount', o.amount,
             'credit', o.credit, 'promo_code', o.promo_code, 'discount', o.discount, 'seats', o.seats, 'group_name', o.group_name,
             'list_price', (select pr.amount from prep.prices pr where pr.package = o.package and pr.term = o.term),
             'slip_path', o.slip_path, 'note', o.note, 'status', o.status, 'admin_note', o.admin_note,
             'created_at', o.created_at, 'reviewed_at', o.reviewed_at,
             'active_packages', to_jsonb(prep.active_packages(o.user_id)))
           order by case when o.status = 'pending' then o.created_at end asc, o.created_at desc)
      from (select * from prep.orders
             where p_status is null or status = p_status
             order by created_at desc limit greatest(1, least(coalesce(p_limit, 50), 200))) o
      left join auth.users au on au.id = o.user_id), '[]'::jsonb);
end $function$;

create or replace function public.prep_my_orders()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid := prep.uid();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', o.id, 'package', o.package, 'term', o.term, 'amount', o.amount, 'status', o.status, 'seats', o.seats, 'group_name', o.group_name,
             'admin_note', o.admin_note, 'created_at', o.created_at, 'reviewed_at', o.reviewed_at,
             'access_until', (select e.expires_at from prep.entitlements e where e.order_id = o.id limit 1))
           order by o.created_at desc)
      from (select * from prep.orders where user_id = u order by created_at desc limit 20) o), '[]'::jsonb);
end $function$;

revoke execute on function prep.seat_price(int, int) from public;
revoke execute on function prep.make_group_keys(int) from public;
do $$
declare f text;
begin
  for f in select unnest(array['public.prep_group_quotes()', 'public.prep_my_group_keys()', 'public.prep_admin_group_deal_set(integer,text,integer,boolean)',
                               'public.prep_admin_group_deals()', 'public.prep_submit_order(text,text,integer,text,text,text,integer)']) loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
