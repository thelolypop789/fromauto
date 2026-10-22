-- Reading-comprehension sets whose passage text was lost on import ("จากบทอ่านเรื่อง..." with no passage in the stem).
-- Every question of such a source is unusable, so one report hides the whole source, not just the reported question.
-- Questions that carry their own passage in the stem (long stems) are kept.

create table if not exists prep.passage_sources (
  source     text primary key,
  note       text,
  created_at timestamptz not null default now()
);
alter table prep.passage_sources enable row level security;   -- no policies: only the definer functions below read it

-- Which questions were hidden by this rule, so they can be put back after the passages are restored.
create table if not exists prep.passage_hide_log (
  id          bigserial primary key,
  question_id int  not null,
  source      text not null,
  hidden_at   timestamptz not null default now()
);
alter table prep.passage_hide_log enable row level security;

insert into prep.passage_sources (source, note)
values ('แบบฝึกหัดการอ่านจับใจความสำคัญ.pdf', 'บทอ่านหายตอนนำเข้า โจทย์อ้างถึงบทอ่านที่ไม่มีในข้อ')
on conflict do nothing;

-- Hide every approved question of the same source as p_question (when that source is in prep.passage_sources) and
-- close the open reports on that source. Returns how many questions were hidden.
create function prep.hide_passage_group(p_question int) returns int
language plpgsql security definer set search_path = '' as $$
declare
  src text;
  n   int := 0;
begin
  select source into src from prep.questions where id = p_question;
  if src is null or not exists (select 1 from prep.passage_sources where source = src) then return 0; end if;

  with h as (
    update prep.questions set status = 'hidden'
     where source = src and status = 'approved' and (length(stem) < 250 or id = p_question)
    returning id
  ), l as (
    insert into prep.passage_hide_log (question_id, source) select id, src from h returning 1
  )
  select count(*) into n from l;

  update prep.reports
     set status = 'fixed', resolved_at = now(),
         admin_note = 'ข้อสอบชุดนี้ไม่มีบทอ่านประกอบ จึงซ่อนทั้งชุดไว้ก่อนระหว่างรอแก้ไข ขอบคุณที่แจ้งครับ'
   where status = 'open' and question_id in (select id from prep.questions where source = src);
  return n;
end $$;
revoke execute on function prep.hide_passage_group(int) from public;

create or replace function public.prep_submit_report(p_question int, p_category text, p_detail text default '')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u      uuid := prep.uid();
  cat    text := case when p_category in ('wrong_answer', 'choices', 'unclear', 'typo', 'explanation', 'outdated') then p_category else 'other' end;
  detail text := left(trim(coalesce(p_detail, '')), 500);
  v_reason text;
  rid    int;
  was_update boolean := false;
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
  if rid is not null then
    was_update := true;
  else
    insert into prep.reports (question_id, user_id, reason, category) values (p_question, u, v_reason, cat);
  end if;

  perform prep.hide_passage_group(p_question);
  return jsonb_build_object('ok', true, 'updated', was_update);
end $$;

-- The sources already have reports, so apply the rule once now.
do $$
declare s text;
begin
  for s in select distinct q.source from prep.reports r join prep.questions q on q.id = r.question_id
            join prep.passage_sources ps on ps.source = q.source loop
    perform prep.hide_passage_group((select min(q.id) from prep.questions q where q.source = s));
  end loop;
end $$;
