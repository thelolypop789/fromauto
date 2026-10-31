-- Daily answer cap: 3,000 a day with a package, 1,000 without (was 1,000 for everyone). A paying user hit 1,000 on
-- 31 Oct with genuine practice (13 s a question, 77% right), two weeks before the exam; the cap stays only as a guard
-- against scraping the bank. Both functions are the live definitions with the constant replaced by prep.daily_cap(u).

create function prep.daily_cap(u uuid) returns int
language sql stable set search_path = '' as $$
  select case when cardinality(prep.active_packages(u)) > 0 then 3000 else 1000 end
$$;
revoke execute on function prep.daily_cap(uuid) from public;

CREATE OR REPLACE FUNCTION public.prep_me()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u    uuid := prep.uid();
  p    prep.profiles;
  pkgs text[];
begin
  p := prep.lock_profile(u);
  pkgs := prep.active_packages(u);
  return jsonb_build_object(
    'plan',            case when cardinality(pkgs) > 0 then 'paid' else 'free' end,
    'packages',        coalesce((
       select jsonb_agg(jsonb_build_object('package', package, 'expires_at', expires_at) order by package)
         from (select package, case when bool_or(expires_at is null) then null else max(expires_at) end as expires_at
                 from prep.entitlements
                where user_id = u and revoked_at is null and (expires_at is null or expires_at > now())
                group by package) x), '[]'::jsonb),
    'free_sets_used',  p.free_sets_used,
    'free_sets_limit', 3,
    'max_set_size',    case when cardinality(pkgs) > 0 then 200 else 40 end,
    'is_admin',        prep.is_admin(u),
    'answered_today',  coalesce((select d.answered from prep.daily_activity d
                                  where d.user_id = u and d.day = prep.today()), 0),
    'daily_cap',       prep.daily_cap(u)
  );
end $function$;

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

  if coalesce((select answered from prep.daily_activity where user_id = u and day = d), 0) >= prep.daily_cap(u) then
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
