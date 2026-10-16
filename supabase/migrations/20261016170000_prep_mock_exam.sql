-- Phase 3: full-length mock exams by subject, timed on the server, no answers until the end.
-- Everything here is new (tables, one column on profiles, functions); no existing function is replaced.
--
--  * prep.mock_subjects / prep.mock_quota: the exam blueprint (questions, minutes, how many per topic).
--    Editable in the database; the user's own major fills the '*MAJOR*' slot of the major subject.
--  * prep.mock_attempts: one open attempt per user and subject; the deadline is fixed when it starts.
--  * Answers can be changed until the end; the key and explanations are revealed only after submission.
--  * On submission the answers feed the normal stats, the wrong-answer list and the spaced review schedule.
--  * Access: the package that covers the subject's section, or one free trial of the English subject.

alter table prep.profiles add column if not exists free_mock_used boolean not null default false;

create table prep.mock_subjects (
  code      text primary key,
  section   text not null check (section in ('A', 'B')),
  name      text not null,
  questions int  not null check (questions between 5 and 300),
  minutes   int  not null check (minutes between 5 and 600),
  sort      int  not null
);
create table prep.mock_quota (
  subject text not null references prep.mock_subjects(code) on delete cascade,
  topic   text not null,                       -- a topic code, or '*MAJOR*' = the user's own major
  n       int  not null check (n > 0),
  primary key (subject, topic)
);
alter table prep.mock_subjects enable row level security;
alter table prep.mock_quota enable row level security;

insert into prep.mock_subjects (code, section, name, questions, minutes, sort) values
  ('A-THINK', 'A', 'ภาค ก: การคิดวิเคราะห์', 100, 150, 1),
  ('A-ENG',   'A', 'ภาค ก: ภาษาอังกฤษ', 50, 90, 2),
  ('A-CIVIL', 'A', 'ภาค ก: ข้าราชการที่ดี', 50, 60, 3),
  ('B-MAJOR', 'B', 'ภาค ข: วิชาเอก', 100, 150, 4),
  ('B-LEARN', 'B', 'ภาค ข: การจัดการเรียนรู้', 75, 90, 5),
  ('B-LAW',   'B', 'ภาค ข: กฎหมายการปฏิบัติงาน', 25, 30, 6);

insert into prep.mock_quota (subject, topic, n) values
  ('A-THINK', 'A1-LANG-READ', 22), ('A-THINK', 'A1-LANG-USAGE', 16), ('A-THINK', 'A1-LOGIC-ANALOGY', 12),
  ('A-THINK', 'A1-QUANT-SERIES', 9), ('A-THINK', 'A1-QUANT-PERCENT', 6), ('A-THINK', 'A1-QUANT-RATIO', 5),
  ('A-THINK', 'A1-QUANT-WORD', 8), ('A-THINK', 'A1-QUANT-DATA', 7),
  ('A-THINK', 'A1-LOGIC-COND', 8), ('A-THINK', 'A1-LOGIC-SYLLOGISM', 7),
  ('A-ENG', 'A2-CONV', 12), ('A-ENG', 'A2-GRAMMAR', 14), ('A-ENG', 'A2-VOCAB', 12), ('A-ENG', 'A2-READING', 12),
  ('A-CIVIL', 'A3-ADMIN', 12), ('A-CIVIL', 'A3-ADMINPROC', 10), ('A-CIVIL', 'A3-GOODGOV', 10),
  ('A-CIVIL', 'A3-ETHICS', 8), ('A-CIVIL', 'A3-CRIMINAL', 5), ('A-CIVIL', 'A3-OTHER', 5),
  ('B-MAJOR', '*MAJOR*', 100),
  ('B-LEARN', 'B1-CURR', 12), ('B-LEARN', 'B1-INSTR', 11), ('B-LEARN', 'B1-PSY', 10), ('B-LEARN', 'B1-EVAL', 10),
  ('B-LEARN', 'B1-CLASSMGT', 8), ('B-LEARN', 'B1-INNOV', 8), ('B-LEARN', 'B1-RESEARCH', 8), ('B-LEARN', 'B1-PROF', 8),
  ('B-LAW', 'B2-NEA', 6), ('B-LAW', 'B2-TEACHERCIVIL', 5), ('B-LAW', 'B2-COUNCIL', 3), ('B-LAW', 'B2-MOEADMIN', 2),
  ('B-LAW', 'B2-COMPULSORY', 2), ('B-LAW', 'B2-CHILD', 3), ('B-LAW', 'B2-POLICY', 4);

create table prep.mock_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  subject      text not null references prep.mock_subjects(code),
  question_ids int[] not null,
  answers      smallint[] not null,            -- null = not answered
  started_at   timestamptz not null default now(),
  deadline     timestamptz not null,
  submitted_at timestamptz,
  score        int,
  free_trial   boolean not null default false
);
create unique index mock_one_open on prep.mock_attempts (user_id, subject) where submitted_at is null;
create index mock_by_user on prep.mock_attempts (user_id, subject, submitted_at);
create index mock_by_subject on prep.mock_attempts (subject, score) where submitted_at is not null;
alter table prep.mock_attempts enable row level security;

-- Topics a subject draws from (the '*MAJOR*' slot replaced by the given major).
create function prep.mock_topics(p_subject text, p_major text) returns text[]
language sql stable set search_path = '' as $$
  select coalesce(array_agg(case when topic = '*MAJOR*' then p_major else topic end), '{}')
    from prep.mock_quota where subject = p_subject
$$;

create function prep.mock_available(p_subject text, p_major text) returns int
language sql stable set search_path = '' as $$
  select count(*)::int from prep.questions q
   where q.status = 'approved' and q.topic = any (prep.mock_topics(p_subject, p_major))
$$;

-- Draw the questions: each topic's quota first, then fill any shortage from the subject's other topics.
create function prep.mock_draw(p_subject text, p_major text) returns int[]
language plpgsql set search_path = '' as $$
declare
  need int;
  ids  int[] := '{}';
  r    record;
  t    text;
begin
  select questions into need from prep.mock_subjects where code = p_subject;
  for r in select topic, n from prep.mock_quota where subject = p_subject loop
    t := case when r.topic = '*MAJOR*' then p_major else r.topic end;
    ids := ids || coalesce((select array_agg(x.id) from (
             select q.id from prep.questions q
              where q.topic = t and q.status = 'approved' and q.id <> all (ids)
              order by random() limit r.n) x), '{}');
  end loop;
  if cardinality(ids) < need then
    ids := ids || coalesce((select array_agg(x.id) from (
             select q.id from prep.questions q
              where q.topic = any (prep.mock_topics(p_subject, p_major)) and q.status = 'approved' and q.id <> all (ids)
              order by random() limit need - cardinality(ids)) x), '{}');
  end if;
  if cardinality(ids) < need then raise exception 'not_enough_questions'; end if;
  return (select array_agg(x order by random()) from unnest(ids) x);
end $$;

-- Close an attempt: score it and feed the answers into stats, wrong-answer list and review schedule.
create function prep.mock_finalize(p_id uuid) returns void
language plpgsql set search_path = '' as $$
declare
  a      prep.mock_attempts;
  d      date := prep.today();
  firsts int[];
  n_ans  int;
  n_ok   int;
begin
  select * into a from prep.mock_attempts where id = p_id for update;
  if not found or a.submitted_at is not null then return; end if;

  select count(*) filter (where z.ans = q.answer), count(*) filter (where z.ans is not null)
    into n_ok, n_ans
    from unnest(a.question_ids, a.answers) as z(qid, ans) join prep.questions q on q.id = z.qid;

  update prep.mock_attempts set submitted_at = least(now(), a.deadline), score = n_ok where id = p_id;
  if n_ans = 0 then return; end if;

  select coalesce(array_agg(z.qid), '{}') into firsts
    from unnest(a.question_ids, a.answers) as z(qid, ans)
   where z.ans is not null
     and not exists (select 1 from prep.user_question_state s where s.user_id = a.user_id and s.question_id = z.qid);

  insert into prep.user_question_state as s (user_id, question_id, seen, wrong, last_correct)
  select a.user_id, z.qid, 1, (z.ans <> q.answer)::int, z.ans = q.answer
    from unnest(a.question_ids, a.answers) as z(qid, ans) join prep.questions q on q.id = z.qid
   where z.ans is not null
  on conflict (user_id, question_id) do update
    set seen = s.seen + 1, wrong = s.wrong + excluded.wrong, last_correct = excluded.last_correct, last_at = now();

  insert into prep.user_topic_stats as ts (user_id, topic, n, correct)
  select a.user_id, q.topic, count(*), count(*) filter (where z.ans = q.answer)
    from unnest(a.question_ids, a.answers) as z(qid, ans) join prep.questions q on q.id = z.qid
   where z.qid = any (firsts)
   group by q.topic
  on conflict (user_id, topic) do update set n = ts.n + excluded.n, correct = ts.correct + excluded.correct;

  insert into prep.question_stats as qs (question_id, n, correct, choice_counts)
  select z.qid, 1, (z.ans = q.answer)::int, (select array_agg((g = z.ans)::int order by g) from generate_series(0, 3) g)
    from unnest(a.question_ids, a.answers) as z(qid, ans) join prep.questions q on q.id = z.qid
   where z.qid = any (firsts)
  on conflict (question_id) do update
    set n = qs.n + 1, correct = qs.correct + excluded.correct,
        choice_counts = (select array_agg(qs.choice_counts[g + 1] + excluded.choice_counts[g + 1] order by g) from generate_series(0, 3) g);

  insert into prep.review_schedule as rs (user_id, question_id, box, due_on)
  select a.user_id, z.qid, 0, d + 1
    from unnest(a.question_ids, a.answers) as z(qid, ans) join prep.questions q on q.id = z.qid
   where z.ans is not null and z.ans <> q.answer
  on conflict (user_id, question_id) do update set box = 0, due_on = d + 1;

  update prep.review_schedule rs
     set box = rs.box + 1, due_on = d + (array[1, 3, 7, 14])[rs.box + 2]
   where rs.user_id = a.user_id and rs.due_on <= d and rs.box < 3
     and rs.question_id in (select z.qid from unnest(a.question_ids, a.answers) as z(qid, ans)
                              join prep.questions q on q.id = z.qid where z.ans = q.answer);
  delete from prep.review_schedule rs
   where rs.user_id = a.user_id and rs.box = 3 and rs.due_on <= d
     and rs.question_id in (select z.qid from unnest(a.question_ids, a.answers) as z(qid, ans)
                              join prep.questions q on q.id = z.qid where z.ans = q.answer);

  insert into prep.daily_activity as da (user_id, day, answered, correct)
  values (a.user_id, d, n_ans, n_ok)
  on conflict (user_id, day) do update set answered = da.answered + excluded.answered, correct = da.correct + excluded.correct;
end $$;

-- The attempt as the client sees it. Keys and explanations only after submission.
create function prep.mock_payload(p_id uuid) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  a      prep.mock_attempts;
  s      prep.mock_subjects;
  done   boolean;
  items  jsonb;
  res    jsonb := null;
  mine   int;
  others int;
  below  int;
begin
  select * into a from prep.mock_attempts where id = p_id;
  select * into s from prep.mock_subjects where code = a.subject;
  done := a.submitted_at is not null;

  select jsonb_agg(
           jsonb_build_object('idx', o.i - 1, 'question_id', q.id, 'topic', t.name, 'stem', q.stem,
                              'choices', q.choices, 'picked', a.answers[o.i])
           || case when done then jsonb_build_object(
                'answer', q.answer, 'correct', a.answers[o.i] = q.answer,
                'explanation', q.explanation, 'law_ref', q.law_ref) else '{}'::jsonb end
           order by o.i)
    into items
    from unnest(a.question_ids) with ordinality as o(qid, i)
    join prep.questions q on q.id = o.qid
    join prep.topics t on t.code = q.topic;

  if done then
    mine := a.score;
    select count(*), count(*) filter (where x.score < mine) into others, below
      from prep.mock_attempts x
     where x.subject = a.subject and x.submitted_at is not null and x.id <> a.id and x.score is not null;
    res := jsonb_build_object(
      'score', a.score, 'total', cardinality(a.question_ids),
      'pct', round(100.0 * a.score / greatest(cardinality(a.question_ids), 1), 1),
      'used_seconds', extract(epoch from (a.submitted_at - a.started_at))::int,
      'answered', (select count(*) from unnest(a.answers) v where v is not null),
      'players', others + 1,
      'percentile', case when others >= 5 then round(100.0 * below / others)::int else null end,
      'per_topic', (select jsonb_agg(jsonb_build_object('topic', y.name, 'n', y.n, 'correct', y.ok) order by y.n desc, y.name)
                      from (select t.name, count(*) n, count(*) filter (where z.ans = q.answer) ok
                              from unnest(a.question_ids, a.answers) as z(qid, ans)
                              join prep.questions q on q.id = z.qid join prep.topics t on t.code = q.topic
                             group by t.name) y));
  end if;

  return jsonb_build_object(
    'attempt_id', a.id, 'subject', a.subject, 'name', s.name, 'minutes', s.minutes,
    'started_at', a.started_at, 'deadline', a.deadline, 'server_now', now(),
    'submitted', done, 'free_trial', a.free_trial, 'items', coalesce(items, '[]'::jsonb), 'result', res);
end $$;

-- What the buy/practice screen needs: every subject with access, availability, best score, open attempt.
create function public.prep_mock_overview() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u    uuid := prep.uid();
  p    prep.profiles;
  pkgs text[];
  r    record;
  out  jsonb := '[]'::jsonb;
  av   int;
  reason text;
  acc  text;
  op   prep.mock_attempts;
begin
  p := prep.lock_profile(u);
  pkgs := prep.active_packages(u);
  for r in select id from prep.mock_attempts where user_id = u and submitted_at is null and deadline < now() loop
    perform prep.mock_finalize(r.id);
  end loop;

  for r in select * from prep.mock_subjects order by sort loop
    av := prep.mock_available(r.code, p.major);
    reason := case when r.code = 'B-MAJOR' and p.major is null then 'no_major'
                   when av < r.questions then 'not_enough_questions' end;
    acc := case when 'ALL' = any (pkgs) or r.section = any (pkgs) then 'pack'
                when r.code = 'A-ENG' and not p.free_mock_used then 'free_trial'
                else 'locked' end;
    select * into op from prep.mock_attempts where user_id = u and subject = r.code and submitted_at is null;
    out := out || jsonb_build_object(
      'code', r.code, 'section', r.section, 'name', r.name, 'questions', r.questions, 'minutes', r.minutes,
      'available', av, 'reason', reason, 'access', acc,
      'best', (select max(score) from prep.mock_attempts where user_id = u and subject = r.code and submitted_at is not null),
      'tries', (select count(*) from prep.mock_attempts where user_id = u and subject = r.code and submitted_at is not null),
      'open', case when op.id is null then null else jsonb_build_object('id', op.id, 'deadline', op.deadline) end);
  end loop;
  return jsonb_build_object('subjects', out, 'server_now', now(),
                            'major_name', (select name from prep.topics where code = p.major));
end $$;

create function public.prep_mock_start(p_subject text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u     uuid := prep.uid();
  p     prep.profiles;
  s     prep.mock_subjects;
  pkgs  text[];
  oid   uuid;
  trial boolean := false;
  ids   int[];
  aid   uuid;
begin
  p := prep.lock_profile(u);
  select * into s from prep.mock_subjects where code = p_subject;
  if s.code is null then raise exception 'invalid_subject'; end if;

  select id into oid from prep.mock_attempts where user_id = u and subject = p_subject and submitted_at is null;
  if oid is not null then
    if (select deadline from prep.mock_attempts where id = oid) >= now() then
      return prep.mock_payload(oid);                -- resume
    end if;
    perform prep.mock_finalize(oid);
  end if;

  pkgs := prep.active_packages(u);
  if not ('ALL' = any (pkgs) or s.section = any (pkgs)) then
    if p_subject = 'A-ENG' and not p.free_mock_used then trial := true;
    else raise exception 'mock_locked'; end if;
  end if;
  if p_subject = 'B-MAJOR' and p.major is null then raise exception 'no_major'; end if;

  ids := prep.mock_draw(p_subject, p.major);
  insert into prep.mock_attempts (user_id, subject, question_ids, answers, deadline, free_trial)
  values (u, p_subject, ids, array_fill(null::smallint, array[cardinality(ids)]),
          now() + make_interval(mins => s.minutes), trial)
  returning id into aid;
  if trial then update prep.profiles set free_mock_used = true where user_id = u; end if;
  return prep.mock_payload(aid);
end $$;

create function public.prep_mock_get(p_attempt uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.uid(); a prep.mock_attempts;
begin
  select * into a from prep.mock_attempts where id = p_attempt and user_id = u;
  if not found then raise exception 'not_found'; end if;
  if a.submitted_at is null and a.deadline < now() then perform prep.mock_finalize(a.id); end if;
  return prep.mock_payload(a.id);
end $$;

-- p_choice null clears the answer. Answers can change until the deadline (5 seconds of grace for the network).
create function public.prep_mock_answer(p_attempt uuid, p_idx int, p_choice int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.uid(); a prep.mock_attempts;
begin
  select * into a from prep.mock_attempts where id = p_attempt and user_id = u for update;
  if not found then raise exception 'not_found'; end if;
  if a.submitted_at is not null then raise exception 'round_closed'; end if;
  if a.deadline + interval '5 seconds' < now() then
    perform prep.mock_finalize(a.id);
    raise exception 'time_up';
  end if;
  if p_idx is null or p_idx < 0 or p_idx >= cardinality(a.question_ids) then raise exception 'bad_index'; end if;
  if p_choice is not null and (p_choice < 0 or p_choice > 3) then raise exception 'bad_choice'; end if;
  update prep.mock_attempts set answers[p_idx + 1] = p_choice where id = a.id;
  return jsonb_build_object('ok', true, 'seconds_left', greatest(0, extract(epoch from (a.deadline - now()))::int));
end $$;

create function public.prep_mock_submit(p_attempt uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.uid();
begin
  if not exists (select 1 from prep.mock_attempts where id = p_attempt and user_id = u) then raise exception 'not_found'; end if;
  perform prep.mock_finalize(p_attempt);
  return prep.mock_payload(p_attempt);
end $$;

revoke execute on function prep.mock_topics(text, text), prep.mock_available(text, text), prep.mock_draw(text, text),
  prep.mock_finalize(uuid), prep.mock_payload(uuid) from public;
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('prep_mock_overview', 'prep_mock_start', 'prep_mock_get', 'prep_mock_answer', 'prep_mock_submit') loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
