-- Discounts given by hand (a friend, a school group, a complaint...): until now these were keys with a free-text note
-- such as "ส่วนลด tep 100 บาท", so nobody could add up what was given, who used it, or whether the money came in.
-- A discount is still delivered as a normal package key (same redeem flow for the user); this table records the deal.
-- Additive only: one table, new admin functions.

create table prep.discounts (
  id          int generated always as identity primary key,
  recipient   text not null check (length(trim(recipient)) between 1 and 120),
  contact     text check (contact is null or length(contact) <= 120),
  reason      text check (reason is null or length(reason) <= 300),
  package     text not null check (package in ('A', 'B', 'ALL')),
  term        text not null check (term in ('round', 'lifetime')),
  list_price  int not null check (list_price >= 0),
  price       int not null check (price >= 0),            -- what the person pays (0 = free)
  key_id      int not null references prep.keys(id) on delete restrict,
  paid_at     timestamptz,                                -- money received (not used when price = 0)
  cancelled_at timestamptz,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (price <= list_price)
);
create index discounts_created on prep.discounts (created_at desc);
alter table prep.discounts enable row level security;

-- Creates the key and the record together. Returns the key in clear text once (only its hash is stored).
create function public.prep_admin_discount_create(p_recipient text, p_contact text, p_reason text, p_package text, p_term text, p_price int)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u     uuid := prep.require_admin();
  lp    int;
  k     text;
  kid   int;
  did   int;
begin
  if length(trim(coalesce(p_recipient, ''))) = 0 then raise exception 'empty_recipient'; end if;
  if p_term not in ('round', 'lifetime') then raise exception 'invalid_duration'; end if;
  select amount into lp from prep.prices where package = p_package and term = p_term;
  if lp is null then raise exception 'invalid_package'; end if;
  if p_price is null or p_price < 0 or p_price > lp then raise exception 'invalid_price'; end if;
  k := (public.prep_admin_create_package_keys(
          1,
          left(format('ส่วนลด: %s · %s บาท (ปกติ %s)', trim(p_recipient), p_price, lp), 200),
          p_package,
          case when p_term = 'round' then 90 end,
          null,
          p_price = 0))[1];
  select id into kid from prep.keys where key_hash = prep.hash_key(k);
  insert into prep.discounts (recipient, contact, reason, package, term, list_price, price, key_id, created_by)
  values (trim(p_recipient), nullif(trim(coalesce(p_contact, '')), ''), nullif(trim(coalesce(p_reason, '')), ''),
          p_package, p_term, lp, p_price, kid, u)
  returning id into did;
  return jsonb_build_object('id', did, 'key', k, 'list_price', lp, 'price', p_price);
end $$;

create function public.prep_admin_discounts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return (
    with x as (
      select d.*, k.redeemed_at, k.revoked_at, au.email as redeemed_email
        from prep.discounts d join prep.keys k on k.id = d.key_id
        left join auth.users au on au.id = k.redeemed_by)
    select jsonb_build_object(
      'totals', jsonb_build_object(
        'count', (select count(*) from x where cancelled_at is null),
        'discount_given', (select coalesce(sum(list_price - price), 0) from x where cancelled_at is null),
        'received', (select coalesce(sum(price), 0) from x where cancelled_at is null and paid_at is not null),
        'awaiting_payment', (select coalesce(sum(price), 0) from x where cancelled_at is null and paid_at is null and price > 0),
        'unused', (select count(*) from x where cancelled_at is null and redeemed_at is null)),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', id, 'recipient', recipient, 'contact', contact, 'reason', reason, 'package', package, 'term', term,
                 'list_price', list_price, 'price', price, 'created_at', created_at, 'paid_at', paid_at,
                 'cancelled_at', cancelled_at, 'redeemed_at', redeemed_at, 'redeemed_email', redeemed_email) order by created_at desc)
          from x), '[]'::jsonb)));
end $$;

create function public.prep_admin_discount_mark_paid(p_id int, p_paid boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  update prep.discounts set paid_at = case when p_paid then coalesce(paid_at, now()) end
   where id = p_id and cancelled_at is null and price > 0;
  if not found then raise exception 'not_found'; end if;
end $$;

-- Only a key nobody has used yet can be cancelled (a used one is a package someone already has: revoke it in Users).
create function public.prep_admin_discount_cancel(p_id int) returns void
language plpgsql security definer set search_path = '' as $$
declare d prep.discounts; red timestamptz;
begin
  perform prep.require_admin();
  select * into d from prep.discounts where id = p_id for update;
  if not found or d.cancelled_at is not null then raise exception 'not_found'; end if;
  select redeemed_at into red from prep.keys where id = d.key_id for update;
  if red is not null then raise exception 'already_redeemed'; end if;
  update prep.keys set revoked_at = now() where id = d.key_id and revoked_at is null;
  update prep.discounts set cancelled_at = now() where id = p_id;
end $$;

do $$
declare f text;
begin
  for f in select unnest(array['public.prep_admin_discount_create(text,text,text,text,text,int)', 'public.prep_admin_discounts()',
                               'public.prep_admin_discount_mark_paid(int,boolean)', 'public.prep_admin_discount_cancel(int)']) loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
