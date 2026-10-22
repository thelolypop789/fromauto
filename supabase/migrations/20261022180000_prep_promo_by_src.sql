-- Promo list gains the channels (profiles.src) the buyers came from; prep_admin_src_sales compares channels:
-- people, buyers, revenue and how many bought with a code, so a campaign link (?src=...&promo=...) can be judged.

create or replace function public.prep_admin_promo_list() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'code', c.code, 'kind', c.kind, 'value', c.value, 'packages', c.packages, 'max_uses', c.max_uses,
             'expires_at', c.expires_at, 'active', c.active, 'note', c.note, 'created_at', c.created_at,
             'pending', (select count(*) from prep.orders o where o.promo_code = c.code and o.status = 'pending'),
             'approved', (select count(*) from prep.orders o where o.promo_code = c.code and o.status = 'approved'),
             'revenue', coalesce((select sum(o.amount) from prep.orders o where o.promo_code = c.code and o.status = 'approved'), 0),
             'discount', coalesce((select sum(o.discount) from prep.orders o where o.promo_code = c.code and o.status = 'approved'), 0),
             'srcs', coalesce((select jsonb_agg(jsonb_build_object('src', x.src, 'n', x.n) order by x.n desc)
                                 from (select coalesce(p.src, '(ไม่ทราบ)') as src, count(*) as n
                                         from prep.orders o left join prep.profiles p on p.user_id = o.user_id
                                        where o.promo_code = c.code and o.status in ('pending', 'approved') group by 1) x), '[]'::jsonb))
           order by c.active desc, c.created_at desc)
      from prep.promo_codes c), '[]'::jsonb);
end $$;

create function public.prep_admin_src_sales(p_days int default 90) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 90), 365)));
begin
  perform prep.require_admin();
  return coalesce((
    with u as (select p.user_id, coalesce(p.src, '(ไม่ทราบ)') as src from prep.profiles p where p.created_at >= since),
         o as (select u.src, o.user_id, o.amount, o.promo_code from prep.orders o join u on u.user_id = o.user_id
                where o.status = 'approved')
    select jsonb_agg(jsonb_build_object(
             'src', g.src, 'users', g.users, 'buyers', coalesce(b.buyers, 0), 'revenue', coalesce(b.revenue, 0),
             'with_code', coalesce(b.with_code, 0)) order by coalesce(b.revenue, 0) desc, g.users desc)
      from (select src, count(*) as users from u group by src) g
      left join (select src, count(distinct user_id) as buyers, sum(amount) as revenue,
                        count(*) filter (where promo_code is not null) as with_code from o group by src) b on b.src = g.src), '[]'::jsonb);
end $$;
revoke execute on function public.prep_admin_src_sales(integer) from public, anon;
grant execute on function public.prep_admin_src_sales(integer) to authenticated;
