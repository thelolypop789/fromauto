-- เปลี่ยนเฉลยจากรายงานต้องแก้คำอธิบายด้วย ไม่งั้นเฉลยกับคำอธิบายขัดกัน (Q#5682, Q#3675 เคยหลุด)
-- ทั้งปุ่ม "ใช้เฉลยของ AI" และคำตัดสิน fix ของ AI ที่ไม่มีคำอธิบายใหม่ จะถูกปฏิเสธด้วย explanation_required
CREATE OR REPLACE FUNCTION public.prep_admin_apply_report_review(p_review integer, p_message text DEFAULT NULL::text, p_fix jsonb DEFAULT NULL::jsonb, p_verdict text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    -- a new key needs a new explanation, otherwise the two contradict each other (Q#5682, Q#3675)
    if fx ? 'answer' and (fx->>'answer')::smallint <> q.answer and coalesce(trim(q.explanation), '') <> ''
       and coalesce(trim(fx->>'explanation'), '') in ('', trim(q.explanation)) then
      raise exception 'explanation_required';
    end if;
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
end $function$;
