-- Phase 2: practice modes beyond building a set by hand.
--  1. Review of wrong answers: one tap builds a set from every question the user still gets wrong.
--  2. Spaced review: a wrong answer comes back after 1, 3, 7 and 14 days; a correct answer on the due
--     day moves it up a box, a correct answer at the last box retires it, a wrong answer restarts it.
--  3. Daily quiz: ten questions per day, the same for everybody, free for every signed-in user.
-- Review sets only contain questions the user may still play: covered by an active package, or (for
-- accounts without any active package) questions that came from the user's own free sets. They follow the
-- phase 0 rule, so a review set built from a package stops working when that package expires.
-- New tables/columns/functions, plus prep_answer (same signature) which now maintains the schedule.

alter table prep.sets add column if not exists kind text not null default 'custom'
  check (kind in ('custom', 'review_wrong', 'review_due'));
-- Each user keeps one set per review kind; asking again refreshes it.
create unique index if not exists sets_one_review on prep.sets (user_id, kind) where kind <> 'custom';

create table prep.review_schedule (
  user_id     uuid not null references auth.users(id) on delete cascade,
  question_id int  not null references prep.questions(id) on delete cascade,
  box         smallint not null default 0 check (box between 0 and 3),
  due_on      date not null,
  primary key (user_id, question_id)
);
create index review_due on prep.review_schedule (user_id, due_on);
alter table prep.review_schedule enable row level security;

create table prep.daily_quiz (
  day          date primary key,
  question_ids int[] not null
);
alter table prep.daily_quiz enable row level security;

create table prep.daily_answers (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  answers smallint[] not null,
  primary key (user_id, day)
);
create index daily_answers_day on prep.daily_answers (day);
alter table prep.daily_answers enable row level security;

-- ---------- review ----------

-- Question ids the user can review now. p_kind: 'due' (scheduled for today or earlier) | 'wrong' (last answer wrong).
create function prep.review_ids(u uuid, p_kind text, p_limit int) returns int[]
language plpgsql stable set search_path = '' as $$
declare
  pkgs text[] := prep.active_packages(u);
  ids  int[];
begin
  if p_kind = 'due' then
    select array_agg(x.id) into ids from (
      select q.id
        from prep.review_schedule rs
        join prep.questions q on q.id = rs.question_id and q.status = 'approved'
        join prep.topics t on t.code = q.topic
       where rs.user_id = u and rs.due_on <= prep.today()
         and ((cardinality(pkgs) > 0 and ('ALL' = any (pkgs) or t.section = any (pkgs)))
              or (cardinality(pkgs) = 0 and exists (select 1 from prep.sets fs where fs.user_id = u and fs.is_free and q.id = any (fs.question_ids))))
       order by rs.due_on, rs.box desc, q.id
       limit p_limit) x;
  else
    select array_agg(x.id) into ids from (
      select q.id
        from prep.user_question_state s
        join prep.questions q on q.id = s.question_id and q.status = 'approved'
        join prep.topics t on t.code = q.topic
       where s.user_id = u and s.last_correct = false
         and ((cardinality(pkgs) > 0 and ('ALL' = any (pkgs) or t.section = any (pkgs)))
              or (cardinality(pkgs) = 0 and exists (select 1 from prep.sets fs where fs.user_id = u and fs.is_free and q.id = any (fs.question_ids))))
       order by s.wrong desc, s.last_at desc, q.id
       limit p_limit) x;
  end if;
  return coalesce(ids, '{}');
end $$;

create function public.prep_review_counts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := prep.uid();
begin
  return jsonb_build_object(
    'due',   cardinality(prep.review_ids(u, 'due', 1000)),
    'wrong', cardinality(prep.review_ids(u, 'wrong', 1000)));
end $$;

-- p_kind: 'due' | 'wrong'. Returns the set id to start a round on.
create function public.prep_create_review_set(p_kind text, p_size int default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  u    uuid := prep.uid();
  p    prep.profiles;
  k    text;
  size int;
  ids  int[];
  tps  text[];
  st   prep.sets;
  sid  uuid;
  free boolean;
  ttl  text;
  had  boolean;
begin
  p := prep.lock_profile(u);
  if p_kind not in ('due', 'wrong') then raise exception 'invalid_mode'; end if;
  k := 'review_' || p_kind;
  size := least(greatest(coalesce(p_size, case p_kind when 'due' then 30 else 50 end), 1), 200);
  ttl := case p_kind when 'due' then 'ทบทวนตามรอบความจำ' else 'ทวนข้อผิดทั้งหมด' end;

  select * into st from prep.sets where user_id = u and kind = k for update;
  had := found;
  if had and exists (select 1 from prep.attempts a where a.set_id = st.id and a.submitted_at is null) then
    return st.id;                                   -- finish the open round first
  end if;

  ids := prep.review_ids(u, p_kind, size);
  if cardinality(ids) = 0 then raise exception 'nothing_to_review'; end if;
  select array_agg(distinct q.topic) into tps from prep.questions q where q.id = any (ids);
  free := cardinality(prep.active_packages(u)) = 0;

  if had then
    update prep.sets
       set question_ids = ids, topics = tps, is_free = free, title = ttl,
           best_pct = null, last_wrong = null, cleared_at = null, created_at = now()
     where id = st.id
     returning id into sid;
  else
    insert into prep.sets (user_id, title, topics, question_ids, is_free, kind)
    values (u, ttl, tps, ids, free, k)
    returning id into sid;
  end if;
  return sid;
end $$;

-- Same as phase 0 plus: keep the review schedule up to date.
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
end $$;

-- ---------- daily quiz ----------

-- Today's question ids; the first caller of the day draws them (5 thinking, 2 English, 3 civil-servant).
create function prep.daily_ids() returns int[]
language plpgsql set search_path = '' as $$
declare d date := prep.today(); ids int[];
begin
  select question_ids into ids from prep.daily_quiz where day = d;
  if ids is not null then return ids; end if;
  perform pg_advisory_xact_lock(hashtext('prep_daily_quiz'));
  select question_ids into ids from prep.daily_quiz where day = d;
  if ids is not null then return ids; end if;
  select array_agg(x.id order by random()) into ids from (
    (select q.id from prep.questions q join prep.topics t on t.code = q.topic
      where q.status = 'approved' and t.grp = 'A1' order by random() limit 5)
    union all
    (select q.id from prep.questions q join prep.topics t on t.code = q.topic
      where q.status = 'approved' and t.grp = 'A2' order by random() limit 2)
    union all
    (select q.id from prep.questions q join prep.topics t on t.code = q.topic
      where q.status = 'approved' and t.grp = 'A3' order by random() limit 3)) x;
  if ids is null or cardinality(ids) < 5 then raise exception 'not_enough_questions'; end if;
  insert into prep.daily_quiz (day, question_ids) values (d, ids);
  return ids;
end $$;

-- Today's quiz for the caller. The key and explanation of an item appear only after the caller answered it.
create function prep.daily_payload(u uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare
  d      date := prep.today();
  ids    int[] := prep.daily_ids();
  a      smallint[];
  items  jsonb := '[]'::jsonb;
  q      prep.questions;
  i      int;
  pct    int;
  score  int := 0;
  done   boolean;
  streak int := 0;
  dd     date;
begin
  select da.answers into a from prep.daily_answers da where da.user_id = u and da.day = d;
  if a is null then a := array_fill(null::smallint, array[cardinality(ids)]); end if;
  for i in 1..cardinality(ids) loop
    select * into q from prep.questions where id = ids[i];
    if a[i] is null then
      items := items || jsonb_build_object('idx', i - 1, 'stem', q.stem, 'choices', q.choices, 'picked', null);
    else
      select round(100.0 * count(*) filter (where x.answers[i] = q.answer) / nullif(count(*) filter (where x.answers[i] is not null), 0))::int
        into pct from prep.daily_answers x where x.day = d;
      if a[i] = q.answer then score := score + 1; end if;
      items := items || jsonb_build_object('idx', i - 1, 'stem', q.stem, 'choices', q.choices, 'picked', a[i],
                 'correct', a[i] = q.answer, 'answer', q.answer, 'explanation', q.explanation, 'pct_correct', pct);
    end if;
  end loop;
  done := not exists (select 1 from unnest(a) v where v is null);

  dd := case when done then d else d - 1 end;
  loop
    exit when not exists (select 1 from prep.daily_answers x
                           where x.user_id = u and x.day = dd
                             and not exists (select 1 from unnest(x.answers) v where v is null));
    streak := streak + 1;
    dd := dd - 1;
  end loop;

  return jsonb_build_object('day', d, 'items', items, 'done', done, 'score', score, 'total', cardinality(ids),
                            'streak', streak, 'players', (select count(*) from prep.daily_answers x where x.day = d));
end $$;

create function public.prep_daily_quiz() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  return prep.daily_payload(prep.uid());
end $$;

-- The first answer to an item is final. Returns the refreshed quiz.
create function public.prep_daily_answer(p_idx int, p_choice int) returns jsonb
language plpgsql security definer set search_path = '' as $$
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
  end if;
  return prep.daily_payload(u);
end $$;

revoke execute on function prep.review_ids(uuid, text, int) from public;
revoke execute on function prep.daily_ids() from public;
revoke execute on function prep.daily_payload(uuid) from public;
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('prep_review_counts', 'prep_create_review_set', 'prep_daily_quiz', 'prep_daily_answer', 'prep_answer') loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
