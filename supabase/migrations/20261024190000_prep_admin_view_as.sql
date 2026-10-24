-- Admin "view as": an admin can open a user's analysis page. The app sends the user's id in an x-view-as header, and
-- prep.uid() returns it instead of the admin's own id, but only when
--   * the caller is an admin, and
--   * the transaction is read-only. PostgREST runs STABLE functions read-only, so a viewing admin can read what the
--     user would see (readiness, dashboard, insights, …) but nothing that writes can ever run as that user.
-- prep_admin_user_detail also returns the user's major code and track, which the analysis page needs.

create or replace function prep.uid() returns uuid
language plpgsql stable set search_path = '' as $$
declare
  u uuid := auth.uid();
  h text;
begin
  if u is null then raise exception 'not_authenticated'; end if;
  if current_setting('transaction_read_only', true) = 'on' then
    h := current_setting('request.headers', true);
    if h is not null and strpos(h, 'x-view-as') > 0 then
      h := nullif(h::json->>'x-view-as', '');
      if h is not null and exists (select 1 from prep.admins a where a.user_id = u) then
        return h::uuid;
      end if;
    end if;
  end if;
  return u;
end $$;

CREATE OR REPLACE FUNCTION public.prep_admin_user_detail(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare au record;
begin
  perform prep.require_admin();
  select u.id, u.email, u.created_at, p.plan, p.free_sets_used, p.free_mock_used, p.major, p.track,
         (select t.name from prep.topics t where t.code = p.major) as major_name
    into au from auth.users u join prep.profiles p on p.user_id = u.id where u.id = p_user;
  if au.id is null then raise exception 'not_found'; end if;
  return jsonb_build_object(
    'user', jsonb_build_object('id', au.id, 'email', au.email, 'created_at', au.created_at, 'plan', au.plan,
                               'major', au.major, 'track', au.track, 'major_name', au.major_name, 'free_sets_used', au.free_sets_used, 'free_mock_used', au.free_mock_used),
    'entitlements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'package', e.package, 'starts_at', e.starts_at, 'expires_at', e.expires_at, 'revoked_at', e.revoked_at,
               'source', case when e.order_id is not null then 'คำสั่งซื้อ #' || e.order_id
                              when e.key_id is not null then (case when e.free then 'คีย์ฟรี' else 'คีย์' end) else 'แอดมินให้ (ฟรี)' end, 'free', e.free,
               'active', e.revoked_at is null and (e.expires_at is null or e.expires_at > now())) order by e.id desc)
        from prep.entitlements e where e.user_id = p_user), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'package', o.package, 'term', o.term, 'amount', o.amount, 'credit', o.credit,
                                          'status', o.status, 'created_at', o.created_at, 'reviewed_at', o.reviewed_at,
                                          'admin_note', o.admin_note) order by o.id desc)
        from (select * from prep.orders where user_id = p_user order by id desc limit 20) o), '[]'::jsonb),
    'activity', jsonb_build_object(
      'answered_total', coalesce((select sum(answered) from prep.daily_activity where user_id = p_user), 0),
      'last_active', (select max(day) from prep.daily_activity where user_id = p_user),
      'sets', (select count(*) from prep.sets where user_id = p_user),
      'mock_done', (select count(*) from prep.mock_attempts where user_id = p_user and submitted_at is not null)),
    'actions', coalesce((
      select jsonb_agg(jsonb_build_object('action', a.action, 'detail', a.detail, 'created_at', a.created_at) order by a.id desc)
        from (select * from prep.admin_actions where user_id = p_user order by id desc limit 10) a), '[]'::jsonb));
end $function$;
