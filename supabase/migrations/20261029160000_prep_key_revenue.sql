-- Revenue from keys sold by hand. About 10 paid keys were sold over LINE in the first two weeks and the dashboard,
-- which only sums in-app orders, never saw them: keys now carry the price paid (typed when making them) and the
-- dashboard returns key revenue next to order revenue.

alter table prep.keys add column if not exists amount int check (amount is null or amount >= 0);

-- Same as production plus p_amount (price of each key). The old signature is dropped so the API has one function.
drop function if exists public.prep_admin_create_package_keys(integer, text, text, integer, date, boolean);
create or replace function public.prep_admin_create_package_keys(p_count integer, p_note text, p_package text, p_duration_days integer,
                                                                 p_expires_on date, p_free boolean default false, p_amount integer default null)
 returns text[]
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
  if p_amount is not null and (p_amount < 0 or p_amount > 100000) then raise exception 'invalid_amount'; end if;
  for n in 1..p_count loop
    b := extensions.gen_random_bytes(12);
    k := 'PREP';
    for j in 0..11 loop
      if j % 4 = 0 then k := k || '-'; end if;
      k := k || substr(alphabet, (get_byte(b, j) % 32) + 1, 1);
    end loop;
    insert into prep.keys (key_hash, note, created_by, package, duration_days, expires_on, free, amount)
    values (prep.hash_key(k), p_note, u, p_package, p_duration_days, p_expires_on, coalesce(p_free, false),
            case when coalesce(p_free, false) then null else p_amount end);
    out := out || k;
  end loop;
  return out;
end $function$;

create or replace function public.prep_admin_dashboard(p_track text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      'pending_orders',   (select count(*) from (select * from prep.orders where prep.in_track(user_id, p_track)) where status = 'pending'),
      'oldest_pending_at',(select min(created_at) from (select * from prep.orders where prep.in_track(user_id, p_track)) where status = 'pending'),
      'open_reports',     (select count(*) from prep.reports where status = 'open'),
      'review_queue',     (select count(*) from prep.questions where status = 'review'),
      'expiring_7d',      (select count(distinct user_id) from (select * from prep.expiring_soon(7) where prep.in_track(user_id, p_track)))),
    'revenue', jsonb_build_object(
      'today',  coalesce((select sum(amount) from (select * from prep.orders where prep.in_track(user_id, p_track)) where status = 'approved' and reviewed_at >= t0), 0),
      'last7',  coalesce((select sum(amount) from (select * from prep.orders where prep.in_track(user_id, p_track)) where status = 'approved' and reviewed_at >= t7), 0),
      'last30', coalesce((select sum(amount) from (select * from prep.orders where prep.in_track(user_id, p_track)) where status = 'approved' and reviewed_at >= t30), 0),
      'month',  coalesce((select sum(amount) from (select * from prep.orders where prep.in_track(user_id, p_track)) where status = 'approved' and reviewed_at >= m0), 0),
      'submitted_30d', (select count(*) from (select * from prep.orders where prep.in_track(user_id, p_track)) where created_at >= t30),
      'approved_30d',  (select count(*) from (select * from prep.orders where prep.in_track(user_id, p_track)) where status = 'approved' and reviewed_at >= t30),
      'rejected_30d',  (select count(*) from (select * from prep.orders where prep.in_track(user_id, p_track)) where status = 'rejected' and reviewed_at >= t30),
      'avg_review_minutes_30d',
        (select round(avg(extract(epoch from (reviewed_at - created_at)) / 60))::int
           from (select * from prep.orders where prep.in_track(user_id, p_track)) where status in ('approved', 'rejected') and reviewed_at >= t30),
      'upgrade_orders_30d', (select count(*) from (select * from prep.orders where prep.in_track(user_id, p_track)) where status = 'approved' and credit > 0 and reviewed_at >= t30),
      'upgrade_amount_30d', coalesce((select sum(amount) from (select * from prep.orders where prep.in_track(user_id, p_track)) where status = 'approved' and credit > 0 and reviewed_at >= t30), 0),
      'by_package', coalesce((
        select jsonb_agg(jsonb_build_object('package', package, 'term', term, 'orders', n, 'amount', amt) order by amt desc)
          from (select package, term, count(*) n, sum(amount) amt from (select * from prep.orders where prep.in_track(user_id, p_track))
                 where status = 'approved' and reviewed_at >= t30 group by package, term) x), '[]'::jsonb)),
    -- Keys sold by hand (LINE): counted on the day they were made, from the price typed when making them. Free and
    -- revoked keys are left out; paid keys made before prices were recorded are counted in "unpriced".
    'keys', (select jsonb_build_object(
        'today',  coalesce(sum(amount) filter (where created_at >= t0), 0),
        'last7',  coalesce(sum(amount) filter (where created_at >= t7), 0),
        'last30', coalesce(sum(amount) filter (where created_at >= t30), 0),
        'month',  coalesce(sum(amount) filter (where created_at >= m0), 0),
        'unpriced_30d', count(*) filter (where amount is null and created_at >= t30))
      from prep.keys k
     where not k.free and k.revoked_at is null
       and (p_track is null or (k.redeemed_by is not null and prep.in_track(k.redeemed_by, p_track)))),
    'expiring', coalesce((
      select jsonb_agg(jsonb_build_object('email', au.email, 'package', x.package, 'expires_at', x.exp) order by x.exp)
        from (select * from (select * from prep.expiring_soon(7) where prep.in_track(user_id, p_track)) order by exp limit 30) x
        join auth.users au on au.id = x.user_id), '[]'::jsonb));
end $function$;

do $$
declare f text;
begin
  for f in select unnest(array['public.prep_admin_create_package_keys(integer,text,text,integer,date,boolean,integer)',
                               'public.prep_admin_dashboard(text)']) loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
