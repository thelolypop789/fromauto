-- AI triage of reported questions + plain-language notifications back to the reporter.
-- Additive only: two new tables, one trigger, new functions. Nothing existing is changed.
--
-- Flow: admin runs the AI check on a reported question (Edge Function prep-report-ai, same GEMINI_KEY as prep-import) ->
--   a row in prep.report_reviews (verdict + proposed fix + a message for the reporters in easy Thai) ->
--   admin applies it (fix / hide / "question is fine") -> reports close -> every reporter gets a notification.
-- The trigger on prep.reports makes ANY way of closing a report notify the reporter (also manual edits in the bank).

create table prep.report_reviews (
  id           int generated always as identity primary key,
  question_id  int not null references prep.questions(id) on delete cascade,
  verdict      text not null check (verdict in ('fix', 'hide', 'ok', 'human')),
  confidence   smallint not null check (confidence between 0 and 100),
  analysis     text not null,                      -- short Thai explanation for the admin
  fix          jsonb,                              -- {stem?, choices?, answer?, explanation?} when verdict = 'fix'
  user_message text not null,                      -- what the reporters will read
  blind_answer smallint check (blind_answer between 0 and 3),
  model        text,
  report_ids   int[] not null default '{}',
  status       text not null default 'pending' check (status in ('pending', 'applied', 'dismissed')),
  created_at   timestamptz not null default now(),
  applied_at   timestamptz,
  applied_by   uuid references auth.users(id) on delete set null
);
create index report_reviews_q on prep.report_reviews (question_id, created_at desc);
alter table prep.report_reviews enable row level security;

create table prep.notifications (
  id          int generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text not null,
  question_id int references prep.questions(id) on delete set null,
  report_id   int references prep.reports(id) on delete set null,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index notifications_user on prep.notifications (user_id, created_at desc);
alter table prep.notifications enable row level security;

-- ---------- notify the reporter whenever a report leaves 'open' ----------
create function prep.notify_report_closed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'open' and new.status in ('fixed', 'rejected') and new.user_id is not null then
    insert into prep.notifications (user_id, kind, title, body, question_id, report_id)
    values (
      new.user_id,
      'report_' || new.status,
      case new.status when 'fixed' then 'เราแก้ข้อที่คุณรายงานแล้ว' else 'เราตรวจข้อที่คุณรายงานแล้ว' end,
      coalesce(nullif(trim(new.admin_note), ''),
               case new.status
                 when 'fixed' then 'ทีมงานตรวจข้อที่คุณแจ้งแล้ว และแก้ไขให้ถูกต้องแล้ว ขอบคุณที่ช่วยแจ้งนะ'
                 else 'ทีมงานตรวจข้อที่คุณแจ้งแล้ว ข้อนี้ถูกต้องอยู่แล้ว ขอบคุณที่ช่วยตรวจนะ' end),
      new.question_id, new.id);
  end if;
  return new;
end $$;
revoke execute on function prep.notify_report_closed() from public;

create trigger reports_notify after update of status on prep.reports
  for each row execute function prep.notify_report_closed();

-- ---------- admin: material for the AI ----------
create function public.prep_admin_report_context(p_question int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare res jsonb;
begin
  perform prep.require_admin();
  select jsonb_build_object(
           'question', jsonb_build_object(
             'id', q.id, 'topic', q.topic, 'topic_name', t.name, 'level', q.level, 'stem', q.stem,
             'choices', q.choices, 'answer', q.answer, 'explanation', q.explanation, 'law_ref', q.law_ref, 'status', q.status),
           'reports', coalesce((
             select jsonb_agg(jsonb_build_object('id', r.id, 'category', r.category, 'label', prep.report_label(r.category),
                                                  'reason', r.reason) order by r.id)
               from prep.reports r where r.question_id = q.id and r.status = 'open'), '[]'::jsonb))
    into res
    from prep.questions q join prep.topics t on t.code = q.topic
   where q.id = p_question;
  if res is null then raise exception 'not_found'; end if;
  return res;
end $$;

-- Reported questions that still need an AI look (no pending review newer than their newest open report).
create function public.prep_admin_reports_to_review(p_limit int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return coalesce((
    select jsonb_agg(x.q order by x.n desc, x.last_at)
      from (select r.question_id as q, count(*) as n, max(r.created_at) as last_at
              from prep.reports r
             where r.status = 'open'
             group by r.question_id
            having not exists (select 1 from prep.report_reviews v
                                where v.question_id = r.question_id and v.status = 'pending'
                                  and v.created_at > max(r.created_at))
             order by count(*) desc, max(r.created_at)
             limit greatest(1, least(p_limit, 100))) x), '[]'::jsonb);
end $$;

-- ---------- admin: store / list / apply / dismiss reviews ----------
create function prep.valid_fix(f jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare ch jsonb;
begin
  if f is null or jsonb_typeof(f) <> 'object' then return false; end if;
  if not (f ? 'stem' or f ? 'choices' or f ? 'answer' or f ? 'explanation') then return false; end if;
  if f ? 'stem' and (jsonb_typeof(f->'stem') <> 'string' or length(trim(f->>'stem')) = 0 or length(f->>'stem') > 2000) then return false; end if;
  if f ? 'explanation' and (jsonb_typeof(f->'explanation') <> 'string' or length(f->>'explanation') > 2000) then return false; end if;
  if f ? 'answer' then
    if jsonb_typeof(f->'answer') <> 'number' then return false; end if;
    if (f->>'answer')::numeric not in (0, 1, 2, 3) then return false; end if;
  end if;
  if f ? 'choices' then
    ch := f->'choices';
    if jsonb_typeof(ch) <> 'array' or jsonb_array_length(ch) <> 4 then return false; end if;
    if exists (select 1 from jsonb_array_elements(ch) e where jsonb_typeof(e) <> 'string' or length(trim(e #>> '{}')) = 0 or length(e #>> '{}') > 500) then return false; end if;
    if (select count(distinct lower(trim(e #>> '{}'))) from jsonb_array_elements(ch) e) <> 4 then return false; end if;
  end if;
  return true;
end $$;
revoke execute on function prep.valid_fix(jsonb) from public;

create function public.prep_admin_save_report_review(p_question int, p_review jsonb) returns int
language plpgsql security definer set search_path = '' as $$
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
  if v_verdict <> 'fix' then v_fix := null; end if;
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

create function public.prep_admin_report_reviews(p_status text default 'pending', p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', v.id, 'question_id', v.question_id, 'verdict', v.verdict, 'confidence', v.confidence,
             'analysis', v.analysis, 'fix', v.fix, 'user_message', v.user_message, 'blind_answer', v.blind_answer,
             'model', v.model, 'status', v.status, 'created_at', v.created_at, 'report_count', cardinality(v.report_ids),
             'question', jsonb_build_object('stem', q.stem, 'choices', q.choices, 'answer', q.answer,
                                            'explanation', q.explanation, 'topic', t.name, 'status', q.status),
             'reports', coalesce((select jsonb_agg(r.reason order by r.id) from prep.reports r
                                   where r.question_id = v.question_id and r.status = 'open'), '[]'::jsonb))
           order by v.created_at desc)
      from (select * from prep.report_reviews
             where status = coalesce(p_status, 'pending') order by created_at desc limit greatest(1, least(p_limit, 200))) v
      join prep.questions q on q.id = v.question_id
      join prep.topics t on t.code = q.topic), '[]'::jsonb);
end $$;

create function public.prep_admin_dismiss_report_review(p_review int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  update prep.report_reviews set status = 'dismissed' where id = p_review and status = 'pending';
end $$;

-- Apply a pending review: edit / hide the question as the review says, close its open reports with the message
-- (the trigger then notifies every reporter). p_message / p_fix let the admin tweak before sending.
create function public.prep_admin_apply_report_review(p_review int, p_message text default null, p_fix jsonb default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a     uuid := prep.require_admin();
  v     prep.report_reviews;
  q     prep.questions;
  msg   text;
  fx    jsonb;
  outcome text;
  n     int;
  notified int;
begin
  select * into v from prep.report_reviews where id = p_review for update;
  if not found then raise exception 'not_found'; end if;
  if v.status <> 'pending' then raise exception 'already_done'; end if;
  if v.verdict = 'human' then raise exception 'needs_human_review'; end if;

  msg := left(coalesce(nullif(trim(p_message), ''), v.user_message), 600);
  if msg = '' then raise exception 'empty_message'; end if;

  select * into q from prep.questions where id = v.question_id for update;
  if not found then raise exception 'not_found'; end if;

  if v.verdict = 'fix' then
    fx := coalesce(p_fix, v.fix);
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
  elsif v.verdict = 'hide' then
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

  update prep.report_reviews set status = 'applied', applied_at = now(), applied_by = a, user_message = msg, fix = coalesce(fx, fix)
   where id = v.id;
  return jsonb_build_object('closed', n, 'notified', notified, 'outcome', outcome);
end $$;

-- ---------- the reporter's own notifications ----------
create function public.prep_my_notifications() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := prep.uid();
begin
  return jsonb_build_object(
    'unread', (select count(*) from prep.notifications where user_id = u and read_at is null),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', n.id, 'kind', n.kind, 'title', n.title, 'body', n.body, 'created_at', n.created_at,
               'read', n.read_at is not null, 'stem', left(q.stem, 120))
             order by n.created_at desc)
        from (select * from prep.notifications where user_id = u order by created_at desc limit 30) n
        left join prep.questions q on q.id = n.question_id), '[]'::jsonb));
end $$;

create function public.prep_mark_notifications_read() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update prep.notifications set read_at = now() where user_id = prep.uid() and read_at is null;
end $$;

do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('prep_admin_report_context', 'prep_admin_reports_to_review', 'prep_admin_save_report_review',
                               'prep_admin_report_reviews', 'prep_admin_dismiss_report_review', 'prep_admin_apply_report_review',
                               'prep_my_notifications', 'prep_mark_notifications_read') loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
