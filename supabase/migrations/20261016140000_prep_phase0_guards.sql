-- Phase 0 guards. Replaces prep_start_round and prep_answer (same signatures) so that:
--  1. a set built from a paid package can no longer be played once that package has expired
--     (free sets, flagged is_free, are unaffected; history and scores stay readable);
--  2. questions that are no longer approved (hidden or back in review) are dropped when a new
--     round starts, so a hidden question cannot reach players through an old set.
-- Additive in effect: no table or column changes.

create or replace function public.prep_start_round(p_set uuid, p_mode text default 'full') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u    uuid := prep.uid();
  st   prep.sets;
  a_id uuid;
  qids int[];
begin
  select * into st from prep.sets where id = p_set and user_id = u for update;
  if not found then raise exception 'not_found'; end if;

  if not st.is_free and not prep.covers(prep.active_packages(u), st.topics) then
    raise exception 'pack_expired';
  end if;

  select id into a_id from prep.attempts where set_id = p_set and submitted_at is null;
  if found then return prep.round_payload(a_id); end if;

  if p_mode = 'wrong' then
    if st.last_wrong is null or cardinality(st.last_wrong) = 0 then
      raise exception 'nothing_wrong';
    end if;
    qids := st.last_wrong;
  else
    p_mode := 'full';
    qids := st.question_ids;
  end if;

  select array_agg(q.id order by random()) into qids
    from prep.questions q where q.id = any (qids) and q.status = 'approved';
  if qids is null or cardinality(qids) = 0 then
    raise exception '%', case when p_mode = 'wrong' then 'nothing_wrong' else 'not_enough_questions' end;
  end if;

  insert into prep.attempts (set_id, user_id, round_no, mode, question_ids, answers, correct)
  values (p_set, u, st.rounds + 1, p_mode, qids,
          array_fill(null::smallint, array[cardinality(qids)]),
          array_fill(null::boolean,  array[cardinality(qids)]))
  returning id into a_id;

  return prep.round_payload(a_id);
end $$;

-- Records one answer (first answer is final) and returns the key + explanation for it.
create or replace function public.prep_answer(p_attempt uuid, p_idx int, p_choice int) returns jsonb
language plpgsql security definer set search_path = '' as $$
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

  first := not exists (select 1 from prep.user_question_state
                        where user_id = u and question_id = q.id);

  insert into prep.user_question_state as s (user_id, question_id, seen, wrong, last_correct)
  values (u, q.id, 1, (not ok)::int, ok)
  on conflict (user_id, question_id) do update
    set seen = s.seen + 1, wrong = s.wrong + (not ok)::int, last_correct = ok, last_at = now();

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
end $$;

-- create or replace keeps existing grants; restate them so the migration is self-contained.
revoke execute on function public.prep_start_round(uuid, text) from public, anon;
revoke execute on function public.prep_answer(uuid, int, int) from public, anon;
grant execute on function public.prep_start_round(uuid, text) to authenticated;
grant execute on function public.prep_answer(uuid, int, int) to authenticated;
