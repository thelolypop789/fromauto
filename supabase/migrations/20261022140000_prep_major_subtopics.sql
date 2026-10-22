-- Sub-topics inside each major (วิชาเอก), from the owner's blueprint checked against the core curriculum
-- (content/prep/major-subtopics.json, seeded by the next migration). The major stays the topic of its questions, so
-- packages, sets, stats and reports keep working; questions.subtopic is an extra label.
--
--  * prep.subtopics: code, major, name, kind (content/pedagogy), weight (relative share of the major mock), keywords.
--  * questions.subtopic + prep.subtopic_tags (who/what labelled it). Existing questions are labelled by the
--    prep-subtopic-tag Edge Function (Gemini) through two service_role RPCs; admins can relabel by hand.
--  * Learners: prep_subtopics(major) for the set builder and stats; prep_create_set takes optional p_subtopics.
--  * Mock exam: the major subject draws by sub-topic weight once questions are labelled.
--  * Readiness: the major is scored per sub-topic instead of as one block.

create table prep.subtopics (
  code     text primary key,
  topic    text not null references prep.topics(code) on update cascade,
  name     text not null,
  kind     text not null check (kind in ('content', 'pedagogy')),
  weight   int  not null check (weight > 0),
  sort     int  not null default 0,
  keywords text not null default ''
);
create index subtopics_topic on prep.subtopics (topic, sort);
alter table prep.subtopics enable row level security;

alter table prep.questions add column subtopic text references prep.subtopics(code) on update cascade on delete set null;
create index questions_subtopic on prep.questions (topic, subtopic) where status = 'approved';

create table prep.subtopic_tags (
  question_id int primary key references prep.questions(id) on delete cascade,
  subtopic    text references prep.subtopics(code) on update cascade on delete set null,   -- null = fits none
  confidence  real,
  source      text not null check (source in ('ai', 'admin')),
  model       text,
  tagged_at   timestamptz not null default now()
);
alter table prep.subtopic_tags enable row level security;

-- A question moved to another topic loses its label and is labelled again.
create function prep.subtopic_reset() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.topic is distinct from old.topic then
    new.subtopic := null;
    delete from prep.subtopic_tags where question_id = new.id;
  end if;
  return new;
end $$;
create trigger questions_subtopic_reset before update of topic on prep.questions
  for each row execute function prep.subtopic_reset();

-- ---------- AI tagger (service_role only) ----------
-- Majors that still have unlabelled questions (not rejected), with counts.
create function public.prep_ai_subtopic_pending() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('topic', x.topic, 'left', x.n) order by x.n desc), '[]'::jsonb)
    from (select q.topic, count(*) as n
            from prep.questions q
           where q.status <> 'rejected'
             and exists (select 1 from prep.subtopics s where s.topic = q.topic)
             and not exists (select 1 from prep.subtopic_tags g where g.question_id = q.id)
           group by q.topic) x
$$;

create function public.prep_ai_subtopic_work(p_topic text, p_limit int default 40) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'topic', p_topic,
    'major', (select name from prep.topics where code = p_topic),
    'subtopics', coalesce((select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'kind', s.kind, 'keywords', s.keywords) order by s.sort)
                             from prep.subtopics s where s.topic = p_topic), '[]'::jsonb),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'stem', left(q.stem, 900), 'choices', q.choices, 'answer', q.answer,
                                          'explanation', left(coalesce(q.explanation, ''), 300)) order by q.id)
        from (select * from prep.questions q
               where q.topic = p_topic and q.status <> 'rejected'
                 and not exists (select 1 from prep.subtopic_tags g where g.question_id = q.id)
               order by q.id limit greatest(1, least(coalesce(p_limit, 40), 80))) q), '[]'::jsonb))
$$;

-- p_items: [{id, sub (code or null), conf}]. A code from another major counts as "fits none". Admin labels win.
create function public.prep_ai_subtopic_save(p_items jsonb, p_model text) returns int
language plpgsql security definer set search_path = '' as $$
declare r jsonb; qid int; sub text; n int := 0;
begin
  for r in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    qid := (r->>'id')::int;
    select s.code into sub from prep.subtopics s join prep.questions q on q.topic = s.topic
     where q.id = qid and s.code = r->>'sub';
    insert into prep.subtopic_tags (question_id, subtopic, confidence, source, model)
    select qid, sub, (r->>'conf')::real, 'ai', p_model where exists (select 1 from prep.questions where id = qid)
    on conflict (question_id) do update set subtopic = excluded.subtopic, confidence = excluded.confidence,
      model = excluded.model, tagged_at = now()
      where prep.subtopic_tags.source = 'ai';
    if found then
      update prep.questions set subtopic = sub where id = qid;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- ---------- admin ----------
create function public.prep_admin_set_subtopic(p_question int, p_subtopic text) returns void
language plpgsql security definer set search_path = '' as $$
declare a uuid := prep.require_admin();
begin
  if p_subtopic is not null and not exists (select 1 from prep.subtopics s join prep.questions q on q.topic = s.topic
                                             where q.id = p_question and s.code = p_subtopic) then
    raise exception 'bad_subtopic';
  end if;
  update prep.questions set subtopic = p_subtopic where id = p_question;
  if not found then raise exception 'not_found'; end if;
  insert into prep.subtopic_tags (question_id, subtopic, source, model) values (p_question, p_subtopic, 'admin', a::text)
  on conflict (question_id) do update set subtopic = excluded.subtopic, source = 'admin', model = excluded.model,
    confidence = null, tagged_at = now();
end $$;

-- Per major: approved questions per sub-topic against the blueprint share, so the team knows what to write next.
create function public.prep_admin_subtopic_coverage() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'topic', t.code, 'name', t.name,
             'approved', (select count(*) from prep.questions q where q.topic = t.code and q.status = 'approved'),
             'untagged', (select count(*) from prep.questions q where q.topic = t.code and q.status <> 'rejected'
                            and not exists (select 1 from prep.subtopic_tags g where g.question_id = q.id)),
             'none', (select count(*) from prep.questions q where q.topic = t.code and q.status = 'approved' and q.subtopic is null
                        and exists (select 1 from prep.subtopic_tags g where g.question_id = q.id)),
             'subtopics', (select jsonb_agg(jsonb_build_object(
                                 'code', s.code, 'name', s.name, 'kind', s.kind,
                                 'share', round(100.0 * s.weight / (select sum(x.weight) from prep.subtopics x where x.topic = s.topic)),
                                 'n', (select count(*) from prep.questions q where q.subtopic = s.code and q.status = 'approved'))
                               order by s.sort)
                             from prep.subtopics s where s.topic = t.code))
           order by t.sort)
      from prep.topics t where exists (select 1 from prep.subtopics s where s.topic = t.code)), '[]'::jsonb);
end $$;

-- ---------- learners ----------
-- Sub-topics of one major with questions available and the caller's first-try-like accuracy
-- (questions answered without ever being wrong / questions answered).
create function public.prep_subtopics(p_topic text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', s.code, 'name', s.name, 'kind', s.kind, 'keywords', s.keywords,
           'share', round(100.0 * s.weight / (select sum(x.weight) from prep.subtopics x where x.topic = s.topic)),
           'available', (select count(*) from prep.questions q where q.subtopic = s.code and q.status = 'approved'),
           'seen', coalesce(st.seen, 0), 'right', coalesce(st.right_n, 0))
         order by s.sort), '[]'::jsonb)
    from prep.subtopics s
    left join lateral (
      select count(*) as seen, count(*) filter (where u.wrong = 0) as right_n
        from prep.user_question_state u join prep.questions q on q.id = u.question_id
       where u.user_id = prep.uid() and q.subtopic = s.code) st on true
   where s.topic = p_topic
$$;

drop function public.prep_create_set(text[], integer, text, text);
create function public.prep_create_set(p_topics text[], p_size integer, p_mode text default 'new', p_title text default null,
                                       p_subtopics text[] default null) returns uuid
language plpgsql security definer set search_path = '' as $$
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
end $$;

-- Major slot: each sub-topic gets round(n * weight / total) of its labelled questions first, then the slot is topped
-- up from the whole major as before. Majors without sub-topics (or not labelled yet) draw exactly as before.
create or replace function prep.mock_draw(p_subject text, p_major text) returns integer[]
language plpgsql set search_path = '' as $$
declare
  need int;
  ids  int[] := '{}';
  got  int[];
  r    record;
  s    record;
  t    text;
  tot  int;
begin
  select questions into need from prep.mock_subjects where code = p_subject;
  for r in select topic, n from prep.mock_quota where subject = p_subject loop
    t := case when r.topic = '*MAJOR*' then p_major else r.topic end;
    got := '{}';
    select sum(weight) into tot from prep.subtopics where topic = t;
    if tot is not null then
      for s in select code, weight from prep.subtopics where topic = t order by sort loop
        got := got || coalesce((select array_agg(x.id) from (
                 select q.id from prep.questions q
                  where q.subtopic = s.code and q.status = 'approved' and q.id <> all (ids || got)
                  order by random() limit round(r.n * s.weight::numeric / tot)::int) x), '{}');
      end loop;
      got := got[1:r.n];                        -- rounding can overshoot by a question or two
    end if;
    got := got || coalesce((select array_agg(x.id) from (
             select q.id from prep.questions q
              where q.topic = t and q.status = 'approved' and q.id <> all (ids || got)
              order by random() limit greatest(0, r.n - cardinality(got))) x), '{}');
    ids := ids || got;
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

-- Readiness (replaces the version from 20261022130000): a topic that has sub-topics is scored per sub-topic, each
-- weighted by its share of the topic's blueprint slot; accuracy per sub-topic = questions never answered wrong /
-- questions answered, shrunk toward guessing like the topics. focus rows carry 'sub' for sub-topics.
create or replace function public.prep_readiness() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  u     uuid := prep.uid();
  major text := (select p.major from prep.profiles p where p.user_id = u);
begin
  return (
    with q as (
      select s.code as subject, s.name as subject_name, s.section, s.questions, s.sort,
             case when m.topic = '*MAJOR*' then major else m.topic end as topic, m.n as w
        from prep.mock_subjects s join prep.mock_quota m on m.subject = s.code),
    e as (
      select q.subject, q.subject_name, q.section, q.questions, q.sort, q.topic, null::text as sub, tp.name as topic_name,
             q.w::numeric as w, coalesce(st.n, 0) as n, coalesce(st.correct, 0) as correct
        from q join prep.topics tp on tp.code = q.topic
        left join prep.user_topic_stats st on st.user_id = u and st.topic = q.topic
       where not exists (select 1 from prep.subtopics x where x.topic = q.topic)
      union all
      select q.subject, q.subject_name, q.section, q.questions, q.sort, q.topic, sb.code, sb.name,
             q.w * sb.weight::numeric / sum(sb.weight) over (partition by q.subject, q.topic),
             coalesce(us.n, 0), coalesce(us.c, 0)
        from q join prep.subtopics sb on sb.topic = q.topic
        left join lateral (select count(*) as n, count(*) filter (where x.wrong = 0) as c
                             from prep.user_question_state x join prep.questions qq on qq.id = x.question_id
                            where x.user_id = u and qq.subtopic = sb.code) us on true),
    t as (select e.*, (correct + 1.25) / (n + 5.0) as acc from e),
    subj as (
      select subject, subject_name, section, questions, sort,
             round(100 * sum(w * acc) / sum(w), 1) as pct, sum(n)::int as n
        from t group by subject, subject_name, section, questions, sort),
    sec as (
      select section, round(sum(questions * pct) / sum(questions), 1) as pct, sum(n)::int as n, count(*) as subjects
        from subj group by section)
    select jsonb_build_object(
      'has_major', major is not null,
      'answered', coalesce((select sum(n) from sec), 0),
      'overall', (select round(sum(s2.questions * s2.pct) / nullif(sum(s2.questions), 0), 1) from subj s2),
      'sections', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'section', sec.section, 'pct', sec.pct, 'n', sec.n,
                 'subjects', (select jsonb_agg(jsonb_build_object('code', subject, 'name', subject_name, 'questions', questions,
                                                                 'pct', pct, 'n', n) order by sort)
                                from subj where subj.section = sec.section))
               order by sec.section) from sec), '[]'::jsonb),
      -- Where practice pays most: items still under 60% first, then questions the item carries x share still missed.
      'focus', coalesce((
        select jsonb_agg(f.item order by f.rk)
          from (select jsonb_build_object('code', topic, 'sub', sub, 'name', topic_name, 'subject', subject_name,
                                          'w', round(w), 'pct', round(100 * acc), 'n', n) as item,
                       row_number() over (order by acc < 0.6 desc, w * (1 - acc) desc) as rk
                  from t) f where f.rk <= 3), '[]'::jsonb)));
end $$;

do $$
declare f text;
begin
  for f in select unnest(array['public.prep_ai_subtopic_pending()', 'public.prep_ai_subtopic_work(text,integer)',
                               'public.prep_ai_subtopic_save(jsonb,text)']) loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
  for f in select unnest(array['public.prep_admin_set_subtopic(integer,text)', 'public.prep_admin_subtopic_coverage()',
                               'public.prep_subtopics(text)', 'public.prep_create_set(text[],integer,text,text,text[])',
                               'public.prep_readiness()']) loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
revoke execute on function prep.subtopic_reset() from public;
