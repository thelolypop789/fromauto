-- Pay funnel: new usage events for each step between the free limit and a submitted slip, and an admin view that counts
-- people per step. Until now the data only showed "opened the buy screen" and "sent a slip", so nobody could see where
-- the 7 in 10 who open the buy screen and leave drop out.

create or replace function public.prep_track(p_name text, p_props jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  u   uuid := prep.uid();
  v_src text;
begin
  if p_name not in ('visit', 'buy_view', 'free_limit', 'level_view', 'readiness_view', 'subtopic_pick', 'promo_apply', 'scoredist_view', 'board_view',
                    'install_view', 'install_click', 'install_done', 'summary_view',
                    'paywall_click', 'pkg_select', 'qr_save', 'slip_pick', 'slip_fail') then
    raise exception 'invalid_event';
  end if;
  perform prep.lock_profile(u);
  if p_name = 'visit' then
    v_src := nullif(left(regexp_replace(lower(coalesce(p_props->>'src', '')), '[^a-z0-9_-]', '', 'g'), 40), '');
    if v_src is not null then update prep.profiles set src = v_src where user_id = u and profiles.src is null; end if;
  end if;
  insert into prep.events (user_id, name, props)
  values (u, p_name, case when p_name = 'visit' and v_src is not null then jsonb_build_object('src', v_src) else '{}'::jsonb end)
  on conflict (user_id, name, day) do nothing;
end $$;

-- People per step over the last p_days days (Thai dates). Event steps count distinct people with that event in the window;
-- "ส่งสลิป" and "อนุมัติ" come from orders created in the window. Steps are not forced to be nested: someone can buy without
-- ever reaching the free limit, so each step is its own count, plus the share of free-limit people who went on to buy.
create or replace function public.prep_admin_pay_funnel(p_days int default 14, p_track text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  d0 date := prep.today() - (least(greatest(coalesce(p_days, 14), 1), 90) - 1);
  t0 timestamptz := d0::timestamp at time zone 'Asia/Bangkok';
  ev jsonb;
begin
  perform prep.require_admin();
  select coalesce(jsonb_object_agg(name, n), '{}'::jsonb) into ev
    from (select name, count(distinct user_id) n from prep.events
           where day >= d0 and prep.in_track(user_id, p_track)
             and name in ('free_limit', 'paywall_click', 'buy_view', 'pkg_select', 'qr_save', 'slip_pick', 'slip_fail')
           group by name) x;
  return jsonb_build_object(
    'since', d0,
    'events', ev,
    'submitted', (select count(distinct user_id) from prep.orders where created_at >= t0 and prep.in_track(user_id, p_track)),
    'approved',  (select count(distinct user_id) from prep.orders where created_at >= t0 and status = 'approved' and prep.in_track(user_id, p_track)),
    -- of the people who hit the free limit in the window: how many opened the buy screen, and how many bought
    'wall', (select jsonb_build_object(
               'n', count(*),
               'viewed', count(*) filter (where exists (select 1 from prep.events b where b.user_id = w.user_id and b.name = 'buy_view' and b.day >= w.day)),
               'bought', count(*) filter (where exists (select 1 from prep.orders o where o.user_id = w.user_id and o.status = 'approved')))
             from (select user_id, min(day) as day from prep.events where name = 'free_limit' and day >= d0 and prep.in_track(user_id, p_track) group by user_id) w)
  );
end $$;

do $$
declare f text;
begin
  for f in select unnest(array['public.prep_track(text,jsonb)', 'public.prep_admin_pay_funnel(integer,text)']) loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
