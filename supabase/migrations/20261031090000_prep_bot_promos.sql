-- Chat bot: the live state of the promo codes it may talk about (prep-line-bot asks for the codes in ANNOUNCED_PROMOS),
-- so it stops offering a code once it is used up, expired or switched off. Uses are counted like prep.promo_quote:
-- pending and approved orders. Service role only.
create function public.prep_bot_promos(p_codes text[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', c.code, 'kind', c.kind, 'value', c.value, 'packages', c.packages, 'expires_at', c.expires_at,
           'active', c.active and (c.expires_at is null or c.expires_at > now())
                     and (c.max_uses is null or c.max_uses > (select count(*) from prep.orders o where o.promo_code = c.code and o.status <> 'rejected')),
           'left', case when c.max_uses is null then null
                        else greatest(0, c.max_uses - (select count(*) from prep.orders o where o.promo_code = c.code and o.status <> 'rejected')) end)), '[]'::jsonb)
    from prep.promo_codes c
   where c.code = any (select upper(trim(x)) from unnest(p_codes) x)
$$;
revoke execute on function public.prep_bot_promos(text[]) from public, anon, authenticated;
grant execute on function public.prep_bot_promos(text[]) to service_role;
