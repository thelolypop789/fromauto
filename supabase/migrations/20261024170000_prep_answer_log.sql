-- ERI signals, step 1: log every answer with how long the user thought before answering and how long they stayed on
-- the explanation afterwards. Feeds speed, error-type, stamina and remediation signals in prep_readiness.

create table prep.answer_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('set', 'mock', 'daily')),
  attempt_id  uuid,
  pos         int not null,
  question_id int not null,
  choice      smallint,
  correct     boolean,
  think_ms    int,
  dwell_ms    int,
  set_size    int,
  at          timestamptz not null default now()
);
create index answer_log_user_at on prep.answer_log (user_id, at desc);
create index answer_log_attempt on prep.answer_log (attempt_id, pos);
create index answer_log_question on prep.answer_log (question_id) where think_ms is not null;
alter table prep.answer_log enable row level security;

-- Times outside 0.3 s–10 min are noise (double taps, a phone left on the table).
create function prep.clamp_ms(p int) returns int language sql immutable as $$
  select case when p between 300 and 600000 then p end
$$;

drop function public.prep_answer(uuid, integer, integer);
drop function public.prep_mock_answer(uuid, integer, integer);
drop function public.prep_daily_answer(integer, integer);

CREATE OR REPLACE FUNCTION public.prep_answer(p_attempt uuid, p_idx integer, p_choice integer, p_ms integer DEFAULT NULL::integer, p_prev_idx integer DEFAULT NULL::integer, p_prev_dwell integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u     uuid := prep.uid();
  a     prep.attempts;
  q     prep.questions;
  i     int := p_idx + 1;
  ok    boolean;
  first boolean;
  d     date := prep.today();
begin
  select * into a from prep.attempts where id = p_attempt and user_id = u for update;
  if not found then raise exception 'not_found'; end if;
  if a.submitted_at is not null then raise exception 'round_closed'; end if;
  if i < 1 or i > cardinality(a.question_ids) then raise exception 'bad_index'; end if;
  if p_choice is null or p_choice < 0 or p_choice > 3 then raise exception 'bad_choice'; end if;

  if not exists (select 1 from prep.sets s
                  where s.id = a.set_id
                    and (s.is_free or prep.covers(prep.active_packages(u), s.topics))) then
    raise exception 'pack_expired';
  end if;

  -- Time spent on the explanation of the question answered before this one (sent with the next answer).
  if p_prev_idx is not null and p_prev_dwell is not null then
    update prep.answer_log set dwell_ms = prep.clamp_ms(p_prev_dwell)
     where user_id = u and attempt_id = a.id and pos = p_prev_idx and dwell_ms is null;
  end if;

  select * into q from prep.questions where id = a.question_ids[i];

  if a.answers[i] is not null then
    return jsonb_build_object('picked', a.answers[i], 'correct', a.correct[i],
                              'answer', q.answer, 'explanation', q.explanation, 'law_ref', q.law_ref);
  end if;

  if coalesce((select answered from prep.daily_activity where user_id = u and day = d), 0) >= 1000 then
    raise exception 'daily_cap';
  end if;

  ok := (p_choice = q.answer);
  update prep.attempts set answers[i] = p_choice, correct[i] = ok where id = a.id;
  insert into prep.answer_log (user_id, kind, attempt_id, pos, question_id, choice, correct, think_ms, set_size)
  values (u, 'set', a.id, p_idx, q.id, p_choice, ok, prep.clamp_ms(p_ms), cardinality(a.question_ids));

  first := not exists (select 1 from prep.user_question_state
                        where user_id = u and question_id = q.id);

  insert into prep.user_question_state as s (user_id, question_id, seen, wrong, last_correct)
  values (u, q.id, 1, (not ok)::int, ok)
  on conflict (user_id, question_id) do update
    set seen = s.seen + 1, wrong = s.wrong + (not ok)::int, last_correct = ok, last_at = now();

  -- Spaced review: wrong -> back tomorrow; right on or after the due day -> next box, last box retires it.
  if ok then
    update prep.review_schedule rs
       set box = rs.box + 1, due_on = d + (array[1, 3, 7, 14])[rs.box + 2]
     where rs.user_id = u and rs.question_id = q.id and rs.due_on <= d and rs.box < 3;
    delete from prep.review_schedule where user_id = u and question_id = q.id and box = 3 and due_on <= d;
  else
    insert into prep.review_schedule as rs (user_id, question_id, box, due_on)
    values (u, q.id, 0, d + 1)
    on conflict (user_id, question_id) do update set box = 0, due_on = d + 1;
  end if;

  insert into prep.daily_activity as da (user_id, day, answered, correct)
  values (u, d, 1, ok::int)
  on conflict (user_id, day) do update
    set answered = da.answered + 1, correct = da.correct + ok::int;

  if first then
    insert into prep.user_topic_stats as ts (user_id, topic, n, correct)
    values (u, q.topic, 1, ok::int)
    on conflict (user_id, topic) do update
      set n = ts.n + 1, correct = ts.correct + ok::int;

    insert into prep.question_stats as qs (question_id, n, correct, choice_counts)
    values (q.id, 1, ok::int,
            (select array_agg((g = p_choice)::int order by g) from generate_series(0, 3) g))
    on conflict (question_id) do update
      set n = qs.n + 1,
          correct = qs.correct + ok::int,
          choice_counts[p_choice + 1] = qs.choice_counts[p_choice + 1] + 1;
  end if;

  return jsonb_build_object('picked', p_choice, 'correct', ok,
                            'answer', q.answer, 'explanation', q.explanation, 'law_ref', q.law_ref);
end $function$;

CREATE OR REPLACE FUNCTION public.prep_mock_answer(p_attempt uuid, p_idx integer, p_choice integer, p_ms integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  insert into prep.answer_log (user_id, kind, attempt_id, pos, question_id, choice, correct, think_ms, set_size)
  select u, 'mock', a.id, p_idx, q.id, p_choice, p_choice = q.answer, prep.clamp_ms(p_ms), cardinality(a.question_ids)
    from prep.questions q where q.id = a.question_ids[p_idx + 1];
  return jsonb_build_object('ok', true, 'seconds_left', greatest(0, extract(epoch from (a.deadline - now()))::int));
end $function$;

CREATE OR REPLACE FUNCTION public.prep_daily_answer(p_idx integer, p_choice integer, p_ms integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u   uuid := prep.uid();
  d   date := prep.today();
  ids int[] := prep.daily_ids();
  a   smallint[];
begin
  if p_idx is null or p_idx < 0 or p_idx >= cardinality(ids) then raise exception 'bad_index'; end if;
  if p_choice is null or p_choice < 0 or p_choice > 3 then raise exception 'bad_choice'; end if;
  insert into prep.daily_answers (user_id, day, answers)
  values (u, d, array_fill(null::smallint, array[cardinality(ids)]))
  on conflict do nothing;
  select answers into a from prep.daily_answers where user_id = u and day = d for update;
  if a[p_idx + 1] is null then
    update prep.daily_answers set answers[p_idx + 1] = p_choice where user_id = u and day = d;
    insert into prep.answer_log (user_id, kind, pos, question_id, choice, correct, think_ms, set_size)
    select u, 'daily', p_idx, q.id, p_choice, p_choice = q.answer, prep.clamp_ms(p_ms), cardinality(ids)
      from prep.questions q where q.id = ids[p_idx + 1];
  end if;
  return prep.daily_payload(u);
end $function$;

revoke execute on function public.prep_answer(uuid, integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.prep_answer(uuid, integer, integer, integer, integer, integer) to authenticated;
revoke execute on function public.prep_mock_answer(uuid, integer, integer, integer) from public, anon;
grant execute on function public.prep_mock_answer(uuid, integer, integer, integer) to authenticated;
revoke execute on function public.prep_daily_answer(integer, integer, integer) from public, anon;
grant execute on function public.prep_daily_answer(integer, integer, integer) to authenticated;
