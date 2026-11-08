-- ราคาใหม่หลังปิดขายแพ็กซื้อขาด (มีผล 16 พ.ย. 2569 00:00 น. เวลาไทย)
--   แพ็กครบทุกภาค: รายปี 219 · รายรอบ 3 เดือน 129
--   แพ็กภาค ข + วิชาเอก: รายปี 169 · รายรอบ 3 เดือน 99
--   แพ็กภาค ก: ปิดการขายตั้งแต่ตอนรัน migration นี้ · ซื้อขาด: ปิดการขาย 16 พ.ย. (ดู 20261108130000_prep_lifetime_cutoff.sql)
-- * term ใหม่ 'year' = 365 วัน ต่อจากวันหมดอายุเดิมของแพ็กเดียวกัน (เหมือนต่อรายรอบ ไม่มีเครดิตอัปเกรด)
-- * prep.prices.active: ราคาที่ปิดการขายยังเก็บไว้ (ใช้คิดเครดิตอัปเกรดของคนที่ถือแพ็กเดิม) แต่ไม่แสดง/ไม่รับซื้อ
-- * เปลี่ยนราคาตรงเวลาด้วย pg_cron (prep.apply_pricing_2026_11 รันครั้งเดียวแล้วลบงานตัวเอง); ถ้ารัน migration หลังเวลานั้นจะเปลี่ยนทันที
-- * เครดิตอัปเกรด (แพ็กแยก → ครบทุกภาค / → ซื้อขาด) คิดจากราคาที่ลูกค้าจ่ายจริงในคำสั่งซื้อนั้น ไม่ใช่ราคาปัจจุบัน
--   (ราคารายรอบขึ้น: คนที่ซื้อภาค ข 69 บาทจะไม่ได้เครดิต 99 บาท)
-- * โค้ด SOB10 ใช้ได้ต่อเนื่อง (ไม่มีวันหมดอายุ ไม่จำกัดจำนวน คนละ 1 ครั้งเหมือนเดิม)

-- ---------- term 'year' ----------
alter table prep.prices    drop constraint if exists prices_term_check;
alter table prep.prices    add  constraint prices_term_check    check (term in ('round', 'lifetime', 'year'));
alter table prep.orders    drop constraint if exists orders_term_check;
alter table prep.orders    add  constraint orders_term_check    check (term in ('round', 'lifetime', 'year'));
alter table prep.discounts drop constraint if exists discounts_term_check;
alter table prep.discounts add  constraint discounts_term_check check (term in ('round', 'lifetime', 'year'));

alter table prep.prices add column if not exists active boolean not null default true;
insert into prep.prices (package, term, amount, active) values ('ALL', 'year', 219, false), ('B', 'year', 169, false)
on conflict (package, term) do nothing;
update prep.prices set active = false where package = 'A';           -- ภาค ก ปิดการขายเลย

update prep.promo_codes set expires_at = null, max_uses = null where code = 'SOB10';

-- ---------- เปลี่ยนราคา 16 พ.ย. 00:00 ----------
create or replace function prep.apply_pricing_2026_11() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update prep.prices set amount = 129 where package = 'ALL' and term = 'round';
  update prep.prices set amount = 99  where package = 'B'   and term = 'round';
  update prep.prices set amount = 219, active = true where package = 'ALL' and term = 'year';
  update prep.prices set amount = 169, active = true where package = 'B'   and term = 'year';
  update prep.prices set active = false where term = 'lifetime' or package = 'A';
  if exists (select 1 from cron.job where jobname = 'prep-pricing-2026-11') then
    perform cron.unschedule('prep-pricing-2026-11');
  end if;
end $$;
revoke execute on function prep.apply_pricing_2026_11() from public;

do $$
begin
  if now() >= timestamptz '2026-11-16 00:00:00+07' then
    perform prep.apply_pricing_2026_11();
  else
    if exists (select 1 from cron.job where jobname = 'prep-pricing-2026-11') then perform cron.unschedule('prep-pricing-2026-11'); end if;
    perform cron.schedule('prep-pricing-2026-11', '0 17 15 11 *', 'select prep.apply_pricing_2026_11()');   -- 17:00 UTC = 00:00 ไทย
  end if;
end $$;

-- ---------- ราคาต่อบัญชี ----------
-- มูลค่าที่ลูกค้าจ่ายจริงสำหรับสิทธิ์หนึ่งรายการ (ราคาก่อนหักโค้ด/เครดิต) ถ้าไม่มีคำสั่งซื้อ (คีย์) ใช้ราคาตามรายการ
create or replace function prep.paid_value(e prep.entitlements) returns int
language sql stable set search_path = '' as $$
  select coalesce(
    (select o.amount + coalesce(o.credit, 0) + coalesce(o.discount, 0) from prep.orders o where o.id = e.order_id and coalesce(o.seats, 1) = 1),
    (select amount from prep.prices where package = e.package and term = case when e.expires_at is null then 'lifetime' else 'round' end))
$$;
revoke execute on function prep.paid_value(prep.entitlements) from public;

create or replace function prep.quote(u uuid, p_pkg text, p_term text) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  base    int;
  act     boolean;
  credit  int := 0;
  secs    text[];
  s       text;
  held    int;
  exp     timestamptz;
  all_own boolean := true;
  kind    text := 'new';
begin
  select amount, active into base, act from prep.prices where package = p_pkg and term = p_term;
  if base is null then return jsonb_build_object('error', 'invalid_package'); end if;
  if not act then return jsonb_build_object('error', 'not_for_sale'); end if;
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

  -- Credit: what was paid for the entitlements of the same section that the target replaces.
  -- รายปีไม่มีเครดิต: ต่อจากวันหมดอายุเดิมของแพ็กเดียวกัน
  if p_term <> 'year' and (p_pkg = 'ALL' or p_term = 'lifetime') then
    foreach s in array secs loop
      select max(prep.paid_value(e)) into held
        from prep.entitlements e
       where e.user_id = u and e.package = s and e.revoked_at is null
         and (e.expires_at is null or e.expires_at > now());
      credit := credit + coalesce(held, 0);
    end loop;
  end if;

  -- ALL รายรอบ → ALL ซื้อขาด: หักราคารายรอบที่จ่ายไปแล้ว
  if p_pkg = 'ALL' and p_term = 'lifetime' then
    select greatest(credit, coalesce(max(prep.paid_value(e)), 0)) into credit
      from prep.entitlements e
     where e.user_id = u and e.package = 'ALL' and e.revoked_at is null and e.expires_at > now();
  end if;

  if base - credit < 20 then return jsonb_build_object('error', 'nothing_to_upgrade'); end if;

  if p_term = 'lifetime' then
    exp := null;
  elsif p_term = 'year' then
    -- 365 วัน นับต่อจากวันหมดอายุของแพ็กเดียวกันที่ยังใช้อยู่
    select greatest(now(), coalesce(max(e.expires_at), now())) + interval '365 days' into exp
      from prep.entitlements e
     where e.user_id = u and e.package = p_pkg and e.revoked_at is null and e.expires_at > now();
  elsif p_pkg = 'ALL' and credit > 0 then
    -- Upgrade of a running round: ends with the round it replaces.
    select max(e.expires_at) into exp from prep.entitlements e
     where e.user_id = u and e.package in ('A', 'B') and e.revoked_at is null and e.expires_at > now();
    if exp is null then return jsonb_build_object('error', 'nothing_to_upgrade'); end if;
    if exists (select 1 from prep.entitlements e
                where e.user_id = u and e.package = 'ALL' and e.revoked_at is null
                  and (e.expires_at is null or e.expires_at >= exp)) then
      return jsonb_build_object('error', 'already_owned');
    end if;
  else
    -- New or renewed round: 90 days, counted from the end of an active entitlement of the same package.
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

-- ราคาที่เปิดขายเท่านั้น (เรียง: แพ็ก, แล้ว year → round → lifetime)
create or replace function public.prep_prices() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('package', package, 'term', term, 'amount', amount)
                            order by package, term desc), '[]'::jsonb)
    from prep.prices where active
$$;

create or replace function public.prep_quotes() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := prep.uid();
begin
  return coalesce((
    select jsonb_agg(prep.quote(u, p.package, p.term) ||
                     jsonb_build_object('package', p.package, 'term', p.term)
                     order by case p.package when 'A' then 1 when 'B' then 2 else 3 end, p.term desc)
      from prep.prices p where p.active), '[]'::jsonb);
end $$;

create or replace function public.prep_group_quotes() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'seats', d.seats, 'name', d.name, 'emoji', d.emoji, 'pct_off', d.pct_off,
           'package', p.package, 'term', p.term, 'base', p.amount,
           'per_seat', prep.seat_price(p.amount, d.pct_off), 'total', prep.seat_price(p.amount, d.pct_off) * d.seats,
           'save', p.amount * d.seats - prep.seat_price(p.amount, d.pct_off) * d.seats)
         order by d.seats, case p.package when 'A' then 1 when 'B' then 2 else 3 end, p.term desc), '[]'::jsonb)
    from prep.group_deals d cross join prep.prices p where d.active and p.active
$$;

create or replace function public.prep_submit_order(p_package text, p_term text, p_amount integer, p_slip_path text,
  p_note text default null, p_promo text default null, p_seats integer default 1) returns integer
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.uid(); oid int; q jsonb; d prep.group_deals; base int; act boolean; n_seats int := coalesce(p_seats, 1);
begin
  if p_package not in ('A', 'B', 'ALL') then raise exception 'invalid_package'; end if;
  if p_term not in ('round', 'lifetime', 'year') then raise exception 'invalid_duration'; end if;
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
    select amount, active into base, act from prep.prices where package = p_package and term = p_term;
    if base is null then raise exception 'invalid_package'; end if;
    if not act then raise exception 'not_for_sale'; end if;
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

-- อนุมัติคำสั่งซื้อ: ถ้าราคาปิดขายไปแล้วระหว่างรอตรวจ (เช่น ส่งสลิปซื้อขาดคืน 15 พ.ย. อนุมัติวันที่ 16) ยังให้สิทธิ์ตามที่ซื้อ
create or replace function public.prep_admin_review_order(p_id integer, p_approve boolean, p_note text default null) returns jsonb
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
  if o.seats > 1 then
    perform prep.make_group_keys(o.id);
    return jsonb_build_object('ok', true, 'status', 'approved', 'keys', o.seats, 'kind', 'group');
  end if;

  perform prep.lock_profile(o.user_id);
  q := prep.quote(o.user_id, o.package, o.term);
  if not (q ? 'error') then
    exp := (q->>'expires_at')::timestamptz;
  elsif o.term in ('round', 'year') then
    select greatest(now(), coalesce(max(e.expires_at), now())) into base
      from prep.entitlements e
     where e.user_id = o.user_id and e.package = o.package and e.revoked_at is null and e.expires_at > now();
    exp := base + case o.term when 'year' then interval '365 days' else interval '90 days' end;
  else
    exp := null;
  end if;
  insert into prep.entitlements (user_id, package, expires_at, order_id) values (o.user_id, o.package, exp, o.id);
  update prep.profiles set plan = 'paid', paid_at = now() where user_id = o.user_id;
  return jsonb_build_object('ok', true, 'status', 'approved', 'expires_at', exp,
                            'kind', coalesce(q->>'kind', 'new'));
end $$;

create or replace function prep.make_group_keys(p_order integer) returns void
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
            case o.term when 'round' then 90 when 'year' then 365 end, false)
    returning id into kid;
    insert into prep.order_keys (order_id, key_id, key_plain) values (p_order, kid, k);
  end loop;
end $$;

create or replace function public.prep_admin_discount_create(p_recipient text, p_contact text, p_reason text, p_package text, p_term text, p_price integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u     uuid := prep.require_admin();
  lp    int;
  k     text;
  kid   int;
  did   int;
begin
  if length(trim(coalesce(p_recipient, ''))) = 0 then raise exception 'empty_recipient'; end if;
  if p_term not in ('round', 'lifetime', 'year') then raise exception 'invalid_duration'; end if;
  select amount into lp from prep.prices where package = p_package and term = p_term;
  if lp is null then raise exception 'invalid_package'; end if;
  if p_price is null or p_price < 0 or p_price > lp then raise exception 'invalid_price'; end if;
  k := (public.prep_admin_create_package_keys(
          1,
          left(format('ส่วนลด: %s · %s บาท (ปกติ %s)', trim(p_recipient), p_price, lp), 200),
          p_package,
          case p_term when 'round' then 90 when 'year' then 365 end,
          null,
          p_price = 0))[1];
  select id into kid from prep.keys where key_hash = prep.hash_key(k);
  insert into prep.discounts (recipient, contact, reason, package, term, list_price, price, key_id, created_by)
  values (trim(p_recipient), nullif(trim(coalesce(p_contact, '')), ''), nullif(trim(coalesce(p_reason, '')), ''),
          p_package, p_term, lp, p_price, kid, u)
  returning id into did;
  return jsonb_build_object('id', did, 'key', k, 'list_price', lp, 'price', p_price);
end $$;
