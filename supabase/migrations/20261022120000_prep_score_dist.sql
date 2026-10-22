-- "How did everyone else do?" for the result screens: score distribution, rank, average and best, plus the user's own
-- recent scores. Read-only, one new function; nothing existing is changed.
--
--  * p_kind 'daily': today's daily quiz (everyone gets the same 10 questions). Only people who finished all 10 count.
--    Returned only once the caller has finished today's quiz.
--  * p_kind 'mock', p_key = an attempt id of the caller: that attempt against every other user's best submitted
--    attempt in the same subject, in percent (questions differ per attempt but follow the same blueprint).
-- Aggregates only (counts per score); never who scored what. Distribution/rank are null under 3 people.

create function public.prep_score_dist(p_kind text, p_key text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  u       uuid := prep.uid();
  d       date := prep.today();
  ids     int[];
  a       prep.mock_attempts;
  total   int;
  mine    int;
  scores  int[];          -- one value per person, the caller included
  hist    jsonb;
  n       int;
begin
  if p_kind = 'daily' then
    select question_ids into ids from prep.daily_quiz where day = d;
    if ids is null or not exists (select 1 from prep.daily_answers x where x.user_id = u and x.day = d
                                     and not exists (select 1 from unnest(x.answers) v where v is null)) then
      return null;
    end if;
    total := cardinality(ids);
    with s as (
      select x.user_id, count(*) filter (where x.answers[o.i] = q.answer)::int as sc
        from prep.daily_answers x
        cross join unnest(ids) with ordinality as o(qid, i)
        join prep.questions q on q.id = o.qid
       where x.day = d and not exists (select 1 from unnest(x.answers) v where v is null)
       group by x.user_id)
    select array_agg(sc), max(sc) filter (where user_id = u) into scores, mine from s;

    select coalesce(jsonb_agg(jsonb_build_object('label', to_char(h.day, 'DD/MM'), 'value', h.sc, 'current', h.day = d)
                              order by h.day), '[]'::jsonb)
      into hist
      from (select x.day, count(*) filter (where x.answers[o.i] = q.answer)::int as sc
              from prep.daily_answers x
              join prep.daily_quiz z on z.day = x.day
              cross join unnest(z.question_ids) with ordinality as o(qid, i)
              join prep.questions q on q.id = o.qid
             where x.user_id = u and x.day > d - 7
               and not exists (select 1 from unnest(x.answers) v where v is null)
             group by x.day) h;

  elsif p_kind = 'mock' then
    select * into a from prep.mock_attempts
     where id = case when p_key ~ '^[0-9a-f-]{36}$' then p_key::uuid end and user_id = u and submitted_at is not null;
    if not found then return null; end if;
    total := 100;
    mine := round(100.0 * a.score / greatest(cardinality(a.question_ids), 1));
    select coalesce(array_agg(b.best), '{}') || mine into scores
      from (select max(round(100.0 * x.score / greatest(cardinality(x.question_ids), 1)))::int as best
              from prep.mock_attempts x
             where x.subject = a.subject and x.submitted_at is not null and x.score is not null and x.user_id <> u
               and exists (select 1 from unnest(x.answers) v where v is not null)   -- skip empty submissions
             group by x.user_id) b;

    select coalesce(jsonb_agg(jsonb_build_object('label', 'ครั้งที่ ' || h.no, 'value', h.pct, 'current', h.id = a.id)
                              order by h.no), '[]'::jsonb)
      into hist
      from (select * from (
              select x.id, row_number() over (order by x.submitted_at) as no,
                     round(100.0 * x.score / greatest(cardinality(x.question_ids), 1))::int as pct
                from prep.mock_attempts x
               where x.user_id = u and x.subject = a.subject and x.submitted_at is not null) all_
             order by no desc limit 8) h;
  else
    raise exception 'bad_kind';
  end if;

  n := coalesce(cardinality(scores), 0);
  return jsonb_build_object(
    'kind', p_kind, 'total', total, 'mine', mine, 'players', n, 'history', hist,
    'rank',  case when n >= 3 then 1 + (select count(*) from unnest(scores) s where s > mine) end,
    'avg',   case when n >= 3 then (select round(avg(s), 1) from unnest(scores) s) end,
    'best',  case when n >= 3 then (select max(s) from unnest(scores) s) end,
    -- daily: one bar per score 0..total; mock: 11 bars = 0-9%, 10-19%, ... , 90-99%, 100%
    'buckets', case when n >= 3 then (
      select jsonb_agg(coalesce(c.n, 0) order by g.b)
        from generate_series(0, case when p_kind = 'mock' then 10 else total end) g(b)
        left join (select case when p_kind = 'mock' then least(s / 10, 10) else s end as b, count(*) as n
                     from unnest(scores) s group by 1) c on c.b = g.b) end);
end $$;

revoke execute on function public.prep_score_dist(text, text) from public, anon;
grant execute on function public.prep_score_dist(text, text) to authenticated;
