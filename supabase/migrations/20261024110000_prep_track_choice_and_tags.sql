-- 1) The exam (สพฐ. / สอศ.) is chosen explicitly once: new users right after sign-in, existing users in a one-time popup.
--    Until then track stays 'obec' and track_chosen_at is null.
-- 2) Questions can carry a public tag such as "แนวข้อสอบ สอศ. 2567" (exam_tag) and an internal note on where the point
--    came from (ref). Questions are written in our own words; the tag says the point appeared in that year's exam.

alter table prep.profiles  add column if not exists track_chosen_at timestamptz;
alter table prep.questions add column if not exists exam_tag text;
alter table prep.questions add column if not exists ref text;

create or replace function public.prep_profile() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p prep.profiles := prep.lock_profile(prep.uid());
begin
  return jsonb_build_object('major', p.major, 'track', p.track,
    'major_name', (select name from prep.topics where code = p.major),
    'track_chosen', p.track_chosen_at is not null,
    -- someone who already used the app gets the "we added สอศ." popup instead of the first-visit screen
    'returning', p.major is not null or exists (select 1 from prep.sets s where s.user_id = p.user_id));
end $$;

create or replace function public.prep_set_track(p_track text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.uid(); p prep.profiles;
begin
  if p_track not in ('obec', 'vec') then raise exception 'invalid_track'; end if;
  p := prep.lock_profile(u);
  update prep.profiles
     set track = p_track, track_chosen_at = now(),
         major = case when exists (select 1 from prep.topics t where t.code = p.major and (t.track is null or t.track = p_track))
                      then p.major end
   where user_id = u;
  return public.prep_profile();
end $$;

create or replace function prep.round_payload(p_attempt uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'attempt_id', a.id,
    'set_id',     a.set_id,
    'title',      s.title,
    'round_no',   a.round_no,
    'mode',       a.mode,
    'items', (
      select jsonb_agg(jsonb_build_object(
        'idx',         o.i - 1,
        'question_id', q.id,
        'topic',       t.name,
        'tag',         q.exam_tag,
        'stem',        q.stem,
        'choices',     q.choices,
        'picked',      a.answers[o.i],
        'correct',     a.correct[o.i],
        'answer',      case when a.answers[o.i] is not null then q.answer end,
        'explanation', case when a.answers[o.i] is not null then q.explanation end,
        'law_ref',     case when a.answers[o.i] is not null then q.law_ref end
      ) order by o.i)
      from unnest(a.question_ids) with ordinality as o(qid, i)
      join prep.questions q on q.id = o.qid
      join prep.topics t on t.code = q.topic
    )
  )
  from prep.attempts a
  join prep.sets s on s.id = a.set_id
  where a.id = p_attempt
$$;

create or replace function prep.mock_payload(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
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
           jsonb_build_object('idx', o.i - 1, 'question_id', q.id, 'topic', t.name, 'tag', q.exam_tag, 'stem', q.stem,
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
end $function$;
