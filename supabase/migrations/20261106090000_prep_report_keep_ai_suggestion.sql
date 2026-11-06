-- ผลตรวจที่ AI ไม่แน่ใจ (verdict 'human') เก็บข้อเสนอแก้ของ AI ไว้ใน fix เป็น "ร่าง" ให้แอดมินดู/ใช้ต่อ (Q#13658)
-- ปลอดภัย: prep_admin_apply_report_review ใช้ v.fix เองเฉพาะ verdict = 'fix'; รีวิว 'human' จะแก้ข้อสอบได้เมื่อแอดมินส่ง p_fix มาเองเท่านั้น
CREATE OR REPLACE FUNCTION public.prep_admin_save_report_review(p_question int, p_review jsonb) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
declare
  v_verdict text := p_review->>'verdict';
  v_conf    int  := coalesce((p_review->>'confidence')::numeric, 0)::int;
  v_fix     jsonb := case when jsonb_typeof(p_review->'fix') = 'object' then p_review->'fix' else null end;
  v_msg     text := left(trim(coalesce(p_review->>'user_message', '')), 600);
  v_ids     int[];
  rid       int;
begin
  perform prep.require_admin();
  if not exists (select 1 from prep.questions where id = p_question) then raise exception 'not_found'; end if;
  if v_verdict not in ('fix', 'hide', 'ok', 'human') then raise exception 'invalid_verdict'; end if;
  if v_verdict = 'fix' and not prep.valid_fix(v_fix) then raise exception 'invalid_fix'; end if;
  if v_verdict = 'human' and not prep.valid_fix(v_fix) then v_fix := null; end if;   -- a draft that is not usable is dropped
  if v_verdict not in ('fix', 'human') then v_fix := null; end if;
  if v_verdict <> 'human' and v_msg = '' then raise exception 'empty_message'; end if;
  if v_verdict = 'human' and v_msg = '' then v_msg := 'ทีมงานกำลังตรวจข้อที่คุณแจ้งอยู่ จะแจ้งผลให้ทราบ'; end if;
  select coalesce(array_agg(id order by id), '{}') into v_ids from prep.reports where question_id = p_question and status = 'open';
  if cardinality(v_ids) = 0 then raise exception 'no_open_reports'; end if;

  update prep.report_reviews set status = 'dismissed' where question_id = p_question and status = 'pending';
  insert into prep.report_reviews (question_id, verdict, confidence, analysis, fix, user_message, blind_answer, model, report_ids)
  values (p_question, v_verdict, greatest(0, least(100, v_conf)), left(trim(coalesce(p_review->>'analysis', '')), 1500),
          v_fix, v_msg, nullif(p_review->>'blind_answer', '')::smallint, left(p_review->>'model', 60), v_ids)
  returning id into rid;
  return rid;
end $$;

revoke execute on function public.prep_admin_save_report_review(int, jsonb) from public, anon;
grant execute on function public.prep_admin_save_report_review(int, jsonb) to authenticated;

comment on column prep.report_reviews.fix is
  '{stem?, choices?, answer?, explanation?}: verdict fix = AI fix applied on confirm; verdict human = AI draft for the admin only';
