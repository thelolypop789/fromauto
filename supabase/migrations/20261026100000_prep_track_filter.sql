-- สพฐ. users were getting สอศ. questions. Topics carry a track ('obec' / 'vec' / null = both) and prep_topics, the mock
-- exam and readiness already respected it, but prep_dashboard (the home tab's เลือกฝึกตามภาค) listed every topic, so
-- tapping วิชาชีพครู built a set that included the สอศ. topics; prep_create_set accepted any topic, and the past-exam
-- list showed สอศ. papers to everyone. All four now keep to the user's track.
create function prep.user_track(u uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.track from prep.profiles p where p.user_id = u), 'obec')
$$;
revoke execute on function prep.user_track(uuid) from public;

CREATE OR REPLACE FUNCTION public.prep_dashboard()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u     uuid := prep.uid();
  today date := prep.today();
  res   jsonb;
begin
  with days as (
         select day from prep.daily_activity where user_id = u and answered > 0),
       runs as (
         select day, day - (row_number() over (order by day))::int as grp from days),
       streak as (
         select count(*)::int as n from runs
          where grp = (select grp from runs order by day desc limit 1)
            and (select max(day) from days) >= today - 1)
  select jsonb_build_object(
    'answered_total', coalesce((select sum(answered) from prep.daily_activity where user_id = u), 0),
    'correct_total',  coalesce((select sum(correct)  from prep.daily_activity where user_id = u), 0),
    'seen',           (select count(*) from prep.user_question_state where user_id = u),
    'bank',           (select count(*) from prep.questions where status = 'approved'),
    'stubborn',       (select count(*) from prep.user_question_state where user_id = u and wrong >= 2),
    'still_wrong',    (select count(*) from prep.user_question_state where user_id = u and last_correct = false),
    'streak',         coalesce((select n from streak), 0),
    'sets',           (select count(*) from prep.sets where user_id = u),
    'sets_cleared',   (select count(*) from prep.sets where user_id = u and cleared_at is not null),
    'days', coalesce((
       select jsonb_agg(jsonb_build_object('day', g::date,
                'answered', coalesce(d.answered, 0), 'correct', coalesce(d.correct, 0)) order by g)
       from generate_series(today - 13, today, interval '1 day') g
       left join prep.daily_activity d on d.user_id = u and d.day = g::date), '[]'::jsonb),
    'topics', coalesce((
       select jsonb_agg(jsonb_build_object(
                'code', t.code, 'name', t.name, 'grp', t.grp, 'section', t.section,
                'n', coalesce(ts.n, 0), 'correct', coalesce(ts.correct, 0),
                'available', (select count(*) from prep.questions q
                               where q.topic = t.code and q.status = 'approved'),
                'seen', (select count(*) from prep.user_question_state s
                           join prep.questions q on q.id = s.question_id
                          where s.user_id = u and q.topic = t.code)
              ) order by t.sort)
       from prep.topics t
       left join prep.user_topic_stats ts on ts.user_id = u and ts.topic = t.code
      where t.track is null or t.track = prep.user_track(u)), '[]'::jsonb)
  ) into res;
  return res;
end $function$;

CREATE OR REPLACE FUNCTION public.prep_create_set(p_topics text[], p_size integer, p_mode text DEFAULT 'new'::text, p_title text DEFAULT NULL::text, p_subtopics text[] DEFAULT NULL::text[], p_tag text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u       uuid := prep.uid();
  p       prep.profiles;
  covered boolean;
  maxsize int;
  ids     int[];
  sid     uuid;
  n_sets  int;
  narrowed text[];   -- majors whose questions are limited to the chosen sub-topics
begin
  p := prep.lock_profile(u);                     -- row lock serialises the free quota
  -- Only topics of the user's track (สพฐ. / สอศ.) or shared by both; a set never mixes in the other track's topics.
  p_topics := array(select t.code from prep.topics t where t.code = any (coalesce(p_topics, '{}'))
                       and (t.track is null or t.track = coalesce(p.track, 'obec')));
  if p_topics is null or cardinality(p_topics) = 0 then
    raise exception 'no_topics';
  end if;
  covered := prep.covers(prep.active_packages(u), p_topics);
  maxsize := case when covered then 200 else 40 end;
  if p_size is null or p_size < 5 or p_size > maxsize then
    raise exception 'invalid_size';
  end if;
  if not covered and p.free_sets_used >= 3 then
    raise exception 'free_quota_exceeded';
  end if;
  if p_mode not in ('new', 'weak', 'mixed') then
    raise exception 'invalid_mode';
  end if;
  select coalesce(array_agg(distinct s.topic), '{}') into narrowed
    from prep.subtopics s where s.code = any (coalesce(p_subtopics, '{}')) and s.topic = any (p_topics);

  select array_agg(x.id) into ids
  from (
    select q.id
    from prep.questions q
    left join prep.user_question_state s on s.user_id = u and s.question_id = q.id
    where q.status = 'approved' and q.topic = any (p_topics)
      and (q.topic <> all (narrowed) or q.subtopic = any (p_subtopics))
      and (p_tag is null or q.exam_tag like p_tag || '%')
    order by
      case p_mode
        when 'new'  then case when s.question_id is null then 0 else 1 end
        when 'weak' then case when s.last_correct = false then 0
                              when s.question_id is null then 1 else 2 end
        else 0
      end,
      case when p_mode = 'weak' then -coalesce(s.wrong, 0) else 0 end,
      random()
    limit p_size
  ) x;

  if ids is null or cardinality(ids) < 5 then
    raise exception 'not_enough_questions';
  end if;

  select count(*) into n_sets from prep.sets where user_id = u;

  insert into prep.sets (user_id, title, topics, question_ids, is_free)
  values (u,
          coalesce(nullif(left(trim(p_title), 80), ''), 'ชุดที่ ' || (n_sets + 1)),
          p_topics, ids, not covered)
  returning id into sid;

  if not covered then
    update prep.profiles set free_sets_used = free_sets_used + 1 where user_id = u;
  end if;

  return sid;
end $function$;

CREATE OR REPLACE FUNCTION public.prep_past_tags()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object('tag', g.tag, 'section', g.section, 'n', g.n, 'covered', g.covered,
                                               'groups', g.groups)
                            order by g.yr desc, g.tag, g.section), '[]')
  from (
    select x.tag, x.section, sum(x.n)::int n,
           coalesce(substring(x.tag from '(\d{4})$'), '0') yr,
           jsonb_object_agg(x.grp, x.n) groups,
           -- every topic of one tag and section shares that section, so one topic per group is enough for covers()
           prep.covers(prep.active_packages(prep.uid()), array_agg(x.topic)) covered
    from (
      select prep.past_tag(q.exam_tag) tag, t.section, split_part(q.topic, '-', 1) grp, count(*) n,
             min(q.topic) topic
      from prep.questions q join prep.topics t on t.code = q.topic
      where q.status = 'approved' and q.exam_tag is not null
        and (t.track is null or t.track = prep.user_track(prep.uid()))
      group by 1, 2, 3
    ) x
    group by x.tag, x.section
  ) g
$function$;

CREATE OR REPLACE FUNCTION public.prep_create_past_set(p_tag text, p_section text, p_prefix text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  topics text[];
  n int;
begin
  select array_agg(distinct q.topic), count(*) into topics, n
    from prep.questions q join prep.topics t on t.code = q.topic
   where q.status = 'approved' and t.section = p_section and prep.past_tag(q.exam_tag) = p_tag
     and (p_prefix is null or q.topic like p_prefix || '%')
     and (t.track is null or t.track = prep.user_track(prep.uid()));
  if n is null or n < 5 then
    raise exception 'not_enough_questions';
  end if;
  return public.prep_create_set(topics,
    least(n, case when prep.covers(prep.active_packages(prep.uid()), topics) then 200 else 40 end),
    'new', p_tag, null, p_tag);
end $function$;
