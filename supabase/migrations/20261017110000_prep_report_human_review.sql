-- Human review of reports the AI was unsure about: the admin picks the outcome (ok / fix / hide) and writes (or picks a preset for)
-- the message to the reporters. Replaces public.prep_admin_apply_report_review from 20261017100000 (created earlier the same day,
-- no data depends on it) with a version that takes the outcome as a 4th argument.

drop function public.prep_admin_apply_report_review(int, text, jsonb);

create function public.prep_admin_apply_report_review(
  p_review int, p_message text default null, p_fix jsonb default null, p_verdict text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a     uuid := prep.require_admin();
  v     prep.report_reviews;
  q     prep.questions;
  eff   text;
  msg   text;
  fx    jsonb;
  outcome text;
  n     int;
  notified int;
begin
  select * into v from prep.report_reviews where id = p_review for update;
  if not found then raise exception 'not_found'; end if;
  if v.status <> 'pending' then raise exception 'already_done'; end if;

  -- outcome: the admin's choice wins; an AI "human" review has no outcome of its own
  eff := coalesce(nullif(trim(p_verdict), ''), v.verdict);
  if eff not in ('fix', 'hide', 'ok') then raise exception 'needs_human_review'; end if;

  -- for "human" reviews the stored message is only a placeholder, so the admin must supply one
  msg := left(coalesce(nullif(trim(p_message), ''), case when v.verdict <> 'human' then v.user_message end, ''), 600);
  if msg = '' then raise exception 'empty_message'; end if;

  select * into q from prep.questions where id = v.question_id for update;
  if not found then raise exception 'not_found'; end if;

  if eff = 'fix' then
    fx := coalesce(p_fix, case when v.verdict = 'fix' then v.fix end);
    if not prep.valid_fix(fx) then raise exception 'invalid_fix'; end if;
    if fx ? 'stem'        then q.stem := trim(fx->>'stem'); end if;
    if fx ? 'choices'     then q.choices := fx->'choices'; end if;
    if fx ? 'answer'      then q.answer := (fx->>'answer')::smallint; end if;
    if fx ? 'explanation' then q.explanation := fx->>'explanation'; end if;
    begin
      update prep.questions
         set stem = q.stem, choices = q.choices, answer = q.answer, explanation = q.explanation,
             content_hash = prep.content_hash(q.stem, q.choices)
       where id = q.id;
    exception when unique_violation then
      raise exception 'duplicate_question';
    end;
    outcome := 'fixed';
  elsif eff = 'hide' then
    update prep.questions set status = 'hidden' where id = q.id;
    outcome := 'fixed';
  else
    outcome := 'rejected';
  end if;

  with u as (
    update prep.reports
       set status = outcome, admin_note = msg, resolved_at = now(), resolved_by = a
     where question_id = v.question_id and status = 'open'
    returning user_id)
  select count(*), count(distinct user_id) into n, notified from u;

  update prep.report_reviews
     set status = 'applied', applied_at = now(), applied_by = a, user_message = msg, fix = coalesce(fx, fix)
   where id = v.id;
  return jsonb_build_object('closed', n, 'notified', notified, 'outcome', outcome);
end $$;

revoke execute on function public.prep_admin_apply_report_review(int, text, jsonb, text) from public, anon;
grant execute on function public.prep_admin_apply_report_review(int, text, jsonb, text) to authenticated;
