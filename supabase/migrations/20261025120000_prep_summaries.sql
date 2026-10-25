-- Mind-map summaries (src/prep/summaries/*): the content lives in the app; this table only records which maps an
-- admin has checked. Users see checked maps; admins see every map with a "draft" badge and approve or withdraw it.
create table prep.summary_approvals (
  id          text primary key check (id ~ '^[a-z0-9-]{1,60}$'),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz not null default now()
);
alter table prep.summary_approvals enable row level security;   -- no policies: read and written through the functions below

create function public.prep_summary_approved() returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(id order by id), '{}') from prep.summary_approvals
$$;
revoke execute on function public.prep_summary_approved() from public, anon;
grant execute on function public.prep_summary_approved() to authenticated;

create function public.prep_admin_summary_set(p_id text, p_ok boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare a uuid := prep.require_admin();
begin
  if p_ok then
    insert into prep.summary_approvals (id, approved_by) values (p_id, a)
    on conflict (id) do update set approved_by = excluded.approved_by, approved_at = now();
  else
    delete from prep.summary_approvals where id = p_id;
  end if;
end $$;
revoke execute on function public.prep_admin_summary_set(text, boolean) from public, anon;
grant execute on function public.prep_admin_summary_set(text, boolean) to authenticated;

-- New analytics event "summary_view" (a map opened), accepted by prep_track and listed in the admin comparison.
CREATE OR REPLACE FUNCTION public.prep_track(p_name text, p_props jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u   uuid := prep.uid();
  v_src text;
begin
  if p_name not in ('visit', 'buy_view', 'free_limit', 'level_view', 'readiness_view', 'subtopic_pick', 'promo_apply', 'scoredist_view', 'board_view', 'install_view', 'install_click', 'install_done', 'summary_view') then
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
end $function$;

CREATE OR REPLACE FUNCTION public.prep_admin_compare(p_days integer DEFAULT 14, p_mark date DEFAULT NULL::date, p_track text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  today date := prep.today();
  n int; c0 date; c1 date; p0 date; p1 date;
  ev text[] := array['level_view', 'readiness_view', 'subtopic_pick', 'promo_apply', 'scoredist_view', 'buy_view', 'board_view', 'install_view', 'install_click', 'install_done', 'summary_view'];
begin
  perform prep.require_admin();
  if p_mark is not null and p_mark <= today then
    c0 := p_mark; c1 := today; n := least(c1 - c0 + 1, 90); c0 := c1 - (n - 1);
  else
    n := least(greatest(coalesce(p_days, 14), 3), 90); c1 := today; c0 := c1 - (n - 1);
  end if;
  p1 := c0 - 1; p0 := p1 - (n - 1);

  return jsonb_build_object(
    'range', jsonb_build_object('mode', case when p_mark is null then 'previous' else 'mark' end, 'n', n,
                                'cur_from', c0, 'cur_to', c1, 'prev_from', p0, 'prev_to', p1),
    'cur', prep.range_totals(c0, c1, p_track),
    'prev', prep.range_totals(p0, p1, p_track),
    'series', (select jsonb_agg(jsonb_build_object('i', g.i, 'cur_day', c0 + g.i, 'prev_day', p0 + g.i,
                                                    'cur', prep.day_metrics(c0 + g.i, p_track), 'prev', prep.day_metrics(p0 + g.i, p_track)) order by g.i)
                 from generate_series(0, n - 1) g(i)),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('src', x.src, 'users', x.users, 'buyers', x.buyers, 'revenue', x.revenue,
                                          'prev_users', x.prev_users, 'prev_buyers', x.prev_buyers) order by x.users desc, x.revenue desc)
        from (select coalesce(p.src, '(ไม่ทราบ)') as src,
                     count(*) filter (where (p.created_at at time zone 'Asia/Bangkok')::date between c0 and c1) as users,
                     count(*) filter (where (p.created_at at time zone 'Asia/Bangkok')::date between c0 and c1
                                        and exists (select 1 from (select * from prep.orders where prep.in_track(user_id, p_track)) o where o.user_id = p.user_id and o.status = 'approved')) as buyers,
                     coalesce(sum((select sum(o.amount) from (select * from prep.orders where prep.in_track(user_id, p_track)) o where o.user_id = p.user_id and o.status = 'approved')::int)
                              filter (where (p.created_at at time zone 'Asia/Bangkok')::date between c0 and c1), 0) as revenue,
                     count(*) filter (where (p.created_at at time zone 'Asia/Bangkok')::date between p0 and p1) as prev_users,
                     count(*) filter (where (p.created_at at time zone 'Asia/Bangkok')::date between p0 and p1
                                        and exists (select 1 from (select * from prep.orders where prep.in_track(user_id, p_track)) o where o.user_id = p.user_id and o.status = 'approved')) as prev_buyers
                from (select * from prep.profiles where p_track is null or track = p_track) p
               where (p.created_at at time zone 'Asia/Bangkok')::date between p0 and c1
               group by 1) x
       where x.users + x.prev_users > 0), '[]'::jsonb),
    'features', (select jsonb_object_agg(e.name, jsonb_build_object(
                   'cur',  (select count(distinct v.user_id) from (select * from prep.events where prep.in_track(user_id, p_track)) v where v.name = e.name and v.day between c0 and c1),
                   'prev', (select count(distinct v.user_id) from (select * from prep.events where prep.in_track(user_id, p_track)) v where v.name = e.name and v.day between p0 and p1),
                   'first_day', (select min(v.day) from (select * from prep.events where prep.in_track(user_id, p_track)) v where v.name = e.name)))
                   from unnest(ev) as e(name)),
    'promo', jsonb_build_object(
      'orders_cur',  (select count(*) from (select * from prep.orders where prep.in_track(user_id, p_track)) o where o.promo_code is not null and o.status in ('pending', 'approved')
                       and (o.created_at at time zone 'Asia/Bangkok')::date between c0 and c1),
      'orders_prev', (select count(*) from (select * from prep.orders where prep.in_track(user_id, p_track)) o where o.promo_code is not null and o.status in ('pending', 'approved')
                       and (o.created_at at time zone 'Asia/Bangkok')::date between p0 and p1),
      'discount_cur', coalesce((select sum(o.discount) from (select * from prep.orders where prep.in_track(user_id, p_track)) o where o.promo_code is not null and o.status = 'approved'
                       and (o.reviewed_at at time zone 'Asia/Bangkok')::date between c0 and c1), 0)),
    'marks', coalesce((select jsonb_agg(jsonb_build_object('day', m.day, 'label', m.label) order by m.day)
                         from prep.release_marks m where m.day between p0 and c1), '[]'::jsonb),
    'all_marks', coalesce((select jsonb_agg(jsonb_build_object('day', m.day, 'label', m.label) order by m.day desc) from prep.release_marks m), '[]'::jsonb),
    'snapshots', coalesce((select jsonb_agg(jsonb_build_object('day', s.day, 'users', s.users_total, 'paid', s.paid_total,
                                                               'majors', s.major_total, 'approved', s.approved_total, 'tagged', s.tagged_total)
                                            order by s.day)
                             from prep.daily_snapshot s where s.day between p0 and c1), '[]'::jsonb));
end $function$;
