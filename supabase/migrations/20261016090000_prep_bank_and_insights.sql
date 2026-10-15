-- Admin question bank (browse / filter / edit) and a detailed per-user insights dashboard.
-- Adds functions only; no table or data changes. Safe to run once after the earlier prep migrations.

-- ---------- admin: bank summary per topic ----------
create function public.prep_admin_bank_summary() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare res jsonb;
begin
  perform prep.require_admin();
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', t.code, 'name', t.name, 'grp', t.grp, 'section', t.section,
           'approved', coalesce(c.approved, 0), 'review', coalesce(c.review, 0), 'hidden', coalesce(c.hidden, 0),
           'reports', coalesce(c.reports, 0), 'answered', coalesce(c.answered, 0), 'correct', coalesce(c.correct, 0)
         ) order by t.sort), '[]'::jsonb)
    into res
    from prep.topics t
    left join lateral (
      select count(*) filter (where q.status = 'approved') as approved,
             count(*) filter (where q.status = 'review')   as review,
             count(*) filter (where q.status = 'hidden')   as hidden,
             (select count(*) from prep.reports r join prep.questions q2 on q2.id = r.question_id
               where q2.topic = t.code and r.status = 'open') as reports,
             sum(s.n) as answered, sum(s.correct) as correct
        from prep.questions q
        left join prep.question_stats s on s.question_id = q.id
       where q.topic = t.code
    ) c on true;
  return res;
end $$;

-- ---------- admin: filtered question list ----------
-- p_sort: 'new' (default) | 'old' | 'hardest' | 'easiest' | 'most_answered' | 'reports'
create function public.prep_admin_questions(
  p_section text default null, p_grp text default null, p_topic text default null,
  p_status text default null, p_search text default null, p_sort text default 'new',
  p_offset int default 0, p_limit int default 30
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  lim   int := greatest(1, least(coalesce(p_limit, 30), 100));
  off   int := greatest(0, coalesce(p_offset, 0));
  needle text := nullif(lower(trim(coalesce(p_search, ''))), '');
  res   jsonb;
begin
  perform prep.require_admin();
  with f as (
    select q.*, t.name as topic_name, t.grp, t.section,
           coalesce(s.n, 0) as st_n, coalesce(s.correct, 0) as st_correct,
           coalesce(s.choice_counts, '{0,0,0,0}') as st_choices,
           (select count(*) from prep.reports r where r.question_id = q.id and r.status = 'open') as open_reports
      from prep.questions q
      join prep.topics t on t.code = q.topic
      left join prep.question_stats s on s.question_id = q.id
     where (p_section is null or t.section = p_section)
       and (p_grp is null or t.grp = p_grp)
       and (p_topic is null or q.topic = p_topic)
       and (p_status is null or q.status = p_status or (p_status = 'reported' and exists
             (select 1 from prep.reports r where r.question_id = q.id and r.status = 'open')))
       and (needle is null or position(needle in lower(q.stem)) > 0
            or position(needle in lower(q.choices::text)) > 0
            or position(needle in lower(coalesce(q.explanation, ''))) > 0
            or position(needle in lower(coalesce(q.law_ref, ''))) > 0
            or position(needle in lower(coalesce(q.source, ''))) > 0
            or q.id::text = needle)
  ), page as (
    select * from f
     order by
       case when p_sort = 'hardest' then case when st_n > 0 then st_correct::numeric / st_n else 2 end end asc nulls last,
       case when p_sort = 'easiest' then case when st_n > 0 then st_correct::numeric / st_n else -1 end end desc nulls last,
       case when p_sort = 'most_answered' then st_n end desc nulls last,
       case when p_sort = 'reports' then open_reports end desc nulls last,
       case when p_sort = 'old' then id end asc,
       id desc
     limit lim offset off
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                    from (select status, count(*) n from f group by status) x),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'topic', topic, 'topic_name', topic_name, 'grp', grp, 'section', section,
        'level', level, 'stem', stem, 'choices', choices, 'answer', answer,
        'explanation', explanation, 'law_ref', law_ref, 'origin', origin, 'source', source,
        'status', status, 'created_at', created_at,
        'n', st_n, 'correct', st_correct, 'choice_counts', to_jsonb(st_choices),
        'reports', (select coalesce(jsonb_agg(r.reason order by r.id), '[]'::jsonb) from prep.reports r
                     where r.question_id = page.id and r.status = 'open'))
      ) from page), '[]'::jsonb)
  ) into res;
  return res;
end $$;

-- ---------- admin: edit any field of a question ----------
-- p_patch keys (all optional): status, stem, choices, answer, explanation, law_ref, topic, level.
-- Closes the question's open reports.
create function public.prep_admin_save_question(p_id int, p_patch jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare q prep.questions;
begin
  perform prep.require_admin();
  select * into q from prep.questions where id = p_id for update;
  if not found then raise exception 'not_found'; end if;

  if p_patch ? 'status'      then q.status := p_patch->>'status'; end if;
  if p_patch ? 'stem'        then q.stem := trim(p_patch->>'stem'); end if;
  if p_patch ? 'choices'     then q.choices := p_patch->'choices'; end if;
  if p_patch ? 'answer'      then q.answer := (p_patch->>'answer')::smallint; end if;
  if p_patch ? 'explanation' then q.explanation := coalesce(p_patch->>'explanation', ''); end if;
  if p_patch ? 'law_ref'     then q.law_ref := nullif(trim(coalesce(p_patch->>'law_ref', '')), ''); end if;
  if p_patch ? 'topic'       then q.topic := p_patch->>'topic'; end if;
  if p_patch ? 'level'       then q.level := p_patch->>'level'; end if;

  if q.status not in ('review', 'approved', 'hidden') then raise exception 'invalid_status'; end if;
  if coalesce(length(q.stem), 0) = 0 then raise exception 'invalid_stem'; end if;
  if jsonb_typeof(q.choices) <> 'array' or jsonb_array_length(q.choices) <> 4 then raise exception 'invalid_choices'; end if;
  if q.answer not between 0 and 3 then raise exception 'invalid_answer'; end if;
  if not exists (select 1 from prep.topics where code = q.topic) then raise exception 'invalid_topic'; end if;

  begin
    update prep.questions
       set status = q.status, stem = q.stem, choices = q.choices, answer = q.answer,
           explanation = q.explanation, law_ref = q.law_ref, topic = q.topic, level = q.level,
           content_hash = prep.content_hash(q.stem, q.choices)
     where id = p_id;
  exception when unique_violation then
    raise exception 'duplicate_question';
  end;
  update prep.reports set status = 'fixed' where question_id = p_id and status = 'open';
end $$;

-- ---------- user: detailed insights ----------
create function public.prep_insights() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  u     uuid := prep.uid();
  today date := prep.today();
  res   jsonb;
begin
  with answered as (
         select a.started_at, a.submitted_at, x.qid, x.ok, x.ord
           from prep.attempts a,
                unnest(a.question_ids, a.correct, a.answers) with ordinality as x(qid, ok, ans, ord)
          where a.user_id = u and x.ans is not null),
       first_try as (
         select distinct on (qid) qid, coalesce(ok, false) as ok, started_at
           from answered order by qid, started_at, ord),
       ft as (
         select f.*, q.level, q.topic, t.grp, t.section,
                case when s.n >= 5 then s.correct::numeric / s.n end as global_p
           from first_try f
           join prep.questions q on q.id = f.qid
           join prep.topics t on t.code = q.topic
           left join prep.question_stats s on s.question_id = f.qid),
       uqs as (
         select s.*, t.section
           from prep.user_question_state s
           join prep.questions q on q.id = s.question_id
           join prep.topics t on t.code = q.topic
          where s.user_id = u),
       bank as (
         select t.section, t.grp, count(*) as available
           from prep.questions q join prep.topics t on t.code = q.topic
          where q.status = 'approved' group by t.section, t.grp),
       rounds as (
         select a.submitted_at, a.mode, a.round_no, st.title,
                cardinality(a.question_ids) as total,
                (select count(*) from unnest(a.correct) c where c) as right_n
           from prep.attempts a join prep.sets st on st.id = a.set_id
          where a.user_id = u and a.submitted_at is not null)
  select jsonb_build_object(
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
               'section', b.section,
               'available', b.available,
               'n', (select count(*) from ft where ft.section = b.section),
               'correct', (select count(*) from ft where ft.section = b.section and ft.ok),
               'seen', (select count(*) from uqs where uqs.section = b.section),
               'mastered', (select count(*) from uqs where uqs.section = b.section and uqs.last_correct and uqs.wrong = 0),
               'still_wrong', (select count(*) from uqs where uqs.section = b.section and uqs.last_correct = false))
             order by b.section)
        from (select section, sum(available)::int as available from bank group by section) b), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
               'grp', b.grp, 'section', b.section, 'available', b.available,
               'n', (select count(*) from ft where ft.grp = b.grp),
               'correct', (select count(*) from ft where ft.grp = b.grp and ft.ok))
             order by b.grp)
        from bank b), '[]'::jsonb),
    'levels', coalesce((
      select jsonb_agg(jsonb_build_object('level', level, 'n', n, 'correct', c) order by
               array_position(array['remember','understand','apply','analyze'], level))
        from (select level, count(*) n, count(*) filter (where ok) c from ft group by level) x), '[]'::jsonb),
    'difficulty', coalesce((
      select jsonb_agg(jsonb_build_object('band', band, 'n', n, 'correct', c) order by
               array_position(array['easy','medium','hard','new'], band))
        from (select case when global_p is null then 'new' when global_p >= .7 then 'easy'
                          when global_p >= .4 then 'medium' else 'hard' end as band,
                     count(*) n, count(*) filter (where ok) c
                from ft group by 1) x), '[]'::jsonb),
    'mastery', jsonb_build_object(
      'seen',        (select count(*) from uqs),
      'mastered',    (select count(*) from uqs where last_correct and wrong = 0),
      'recovered',   (select count(*) from uqs where last_correct and wrong > 0),
      'still_wrong', (select count(*) from uqs where last_correct = false),
      'stubborn',    (select count(*) from uqs where wrong >= 2)),
    'weeks', coalesce((
      select jsonb_agg(jsonb_build_object(
               'week', w::date,
               'answered', coalesce((select sum(answered) from prep.daily_activity d
                                      where d.user_id = u and d.day >= w::date and d.day < w::date + 7), 0),
               'n', (select count(*) from ft where (ft.started_at at time zone 'Asia/Bangkok')::date >= w::date
                                                 and (ft.started_at at time zone 'Asia/Bangkok')::date < w::date + 7),
               'correct', (select count(*) from ft where ft.ok
                                                 and (ft.started_at at time zone 'Asia/Bangkok')::date >= w::date
                                                 and (ft.started_at at time zone 'Asia/Bangkok')::date < w::date + 7))
             order by w)
        from generate_series(date_trunc('week', today::timestamp) - interval '7 weeks',
                             date_trunc('week', today::timestamp), interval '1 week') w), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('day', g::date,
               'answered', coalesce(d.answered, 0), 'correct', coalesce(d.correct, 0)) order by g)
        from generate_series(today - 29, today, interval '1 day') g
        left join prep.daily_activity d on d.user_id = u and d.day = g::date), '[]'::jsonb),
    'weekdays', coalesce((
      select jsonb_agg(jsonb_build_object('dow', dow, 'answered', a, 'correct', c) order by dow)
        from (select extract(isodow from day)::int as dow, sum(answered)::int a, sum(correct)::int c
                from prep.daily_activity where user_id = u group by 1) x), '[]'::jsonb),
    'hours', coalesce((
      select jsonb_agg(jsonb_build_object('hour', h, 'n', n, 'correct', c) order by h)
        from (select extract(hour from started_at at time zone 'Asia/Bangkok')::int as h,
                     count(*) n, count(*) filter (where ok) c
                from answered group by 1) x), '[]'::jsonb),
    'rounds', coalesce((
      select jsonb_agg(jsonb_build_object('at', submitted_at, 'mode', mode, 'round_no', round_no,
               'title', title, 'total', total, 'correct', right_n) order by submitted_at)
        from (select * from rounds order by submitted_at desc limit 30) r), '[]'::jsonb),
    'round_totals', jsonb_build_object(
      'all',  (select count(*) from rounds),
      'full', (select count(*) from rounds where mode = 'full'),
      'wrong',(select count(*) from rounds where mode = 'wrong')),
    'stubborn_list', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'topic', t.name, 'stem', left(q.stem, 160),
               'wrong', s.wrong, 'seen', s.seen, 'last_correct', s.last_correct) order by s.wrong desc, s.last_at desc)
        from (select * from prep.user_question_state where user_id = u and wrong >= 1
               order by wrong desc, last_at desc limit 10) s
        join prep.questions q on q.id = s.question_id
        join prep.topics t on t.code = q.topic), '[]'::jsonb)
  ) into res;
  return res;
end $$;

-- ---------- privileges ----------
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('prep_admin_bank_summary', 'prep_admin_questions', 'prep_admin_save_question', 'prep_insights') loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
