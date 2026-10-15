-- Question reports: categories, one open report per user and question, the user's own report history,
-- and admin resolve/reject with a note back to the reporter. Additive only (new columns + functions).

alter table prep.reports
  add column if not exists category    text,
  add column if not exists admin_note  text,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null;

create index if not exists reports_open on prep.reports (question_id) where status = 'open';
create index if not exists reports_user on prep.reports (user_id, created_at desc);

create function prep.report_label(c text) returns text
language sql immutable set search_path = '' as $$
  select case c
    when 'wrong_answer' then 'เฉลยผิด'
    when 'choices'      then 'ตัวเลือกมีปัญหา'
    when 'unclear'      then 'โจทย์ไม่ชัดเจน'
    when 'typo'         then 'พิมพ์ผิด'
    when 'explanation'  then 'คำอธิบายไม่ถูกต้อง'
    when 'outdated'     then 'ข้อมูลล้าสมัย'
    else 'อื่นๆ' end
$$;

-- Report a question the caller has been shown (in any of their rounds).
-- A second report on the same question while the first is still open updates it instead of duplicating.
create function public.prep_submit_report(p_question int, p_category text, p_detail text default '')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u      uuid := prep.uid();
  cat    text := case when p_category in ('wrong_answer', 'choices', 'unclear', 'typo', 'explanation', 'outdated') then p_category else 'other' end;
  detail text := left(trim(coalesce(p_detail, '')), 500);
  v_reason text;
  rid    int;
begin
  if cat = 'other' and length(detail) = 0 then raise exception 'empty_reason'; end if;
  if not exists (select 1 from prep.attempts a where a.user_id = u and p_question = any (a.question_ids)) then
    raise exception 'not_found';
  end if;
  if (select count(*) from prep.reports where user_id = u and created_at > now() - interval '1 day') >= 30 then
    raise exception 'too_many_reports';
  end if;
  v_reason := '[' || prep.report_label(cat) || ']' || case when detail <> '' then ' ' || detail else '' end;

  update prep.reports set category = cat, reason = v_reason, created_at = now()
   where user_id = u and question_id = p_question and status = 'open'
  returning id into rid;
  if rid is not null then return jsonb_build_object('ok', true, 'updated', true); end if;

  insert into prep.reports (question_id, user_id, reason, category) values (p_question, u, v_reason, cat);
  return jsonb_build_object('ok', true, 'updated', false);
end $$;

create function public.prep_my_reports() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := prep.uid();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', r.id, 'question_id', r.question_id, 'stem', left(q.stem, 160), 'topic', t.name,
             'category', r.category, 'reason', r.reason, 'status', r.status,
             'admin_note', r.admin_note, 'created_at', r.created_at, 'resolved_at', r.resolved_at)
           order by r.created_at desc)
      from (select * from prep.reports where user_id = u order by created_at desc limit 50) r
      join prep.questions q on q.id = r.question_id
      join prep.topics t on t.code = q.topic), '[]'::jsonb);
end $$;

-- Close all open reports on a question: 'fixed' (question corrected) or 'rejected' (question is fine).
create function public.prep_admin_resolve_reports(p_question int, p_status text, p_note text default null)
returns int
language plpgsql security definer set search_path = '' as $$
declare a uuid := prep.require_admin(); n int;
begin
  if p_status not in ('fixed', 'rejected') then raise exception 'invalid_status'; end if;
  update prep.reports
     set status = p_status, admin_note = nullif(trim(coalesce(p_note, '')), ''), resolved_at = now(), resolved_by = a
   where question_id = p_question and status = 'open';
  get diagnostics n = row_count;
  return n;
end $$;

do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('prep_submit_report', 'prep_my_reports', 'prep_admin_resolve_reports') loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
revoke execute on function prep.report_label(text) from public;
