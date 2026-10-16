-- Content health for the admin area: duplicates, thin topics, suspicious questions, where the questions came from.
--  * prep.qkey(stem, choices): a question's identity ignoring whitespace and the order of the choices. The unique
--    content_hash only catches identical wording in identical order, so shuffled copies slipped through.
--  * prep_admin_content_health(): read-only report.
--  * prep_admin_hide_duplicates(ids): hides extra copies, but never the last approved copy of a question; logged.
-- All new; nothing existing is replaced.

create function prep.qkey(p_stem text, p_choices jsonb) returns text
language sql immutable set search_path = '' as $$
  select md5(regexp_replace(p_stem, '[\s​]+', '', 'g') || '|' ||
             coalesce((select string_agg(regexp_replace(c, '[\s​]+', '', 'g'), '|' order by regexp_replace(c, '[\s​]+', '', 'g'))
                         from jsonb_array_elements_text(p_choices) c), ''))
$$;

create function public.prep_admin_content_health() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare res jsonb;
begin
  perform prep.require_admin();
  with a as (
    select q.id, q.topic, q.stem, q.origin, q.source, q.created_at, coalesce(s.n, 0) as n,
           prep.qkey(q.stem, q.choices) as k,
           regexp_replace(q.stem, '[\s​]+', '', 'g') as ns
      from prep.questions q left join prep.question_stats s on s.question_id = q.id
     where q.status = 'approved'),
  dup as (
    select k, topic, count(*) cnt,
           (array_agg(id order by n desc, id))[1] as keep_id,
           jsonb_agg(jsonb_build_object('id', id, 'origin', origin, 'source', source, 'n', n) order by n desc, id) as items,
           min(stem) as stem
      from a group by k, topic having count(*) > 1),
  sim as (
    select ns, topic, count(*) cnt, count(distinct k) variants, min(stem) as stem, array_agg(id order by id) ids
      from a group by ns, topic having count(*) > 1 and count(distinct k) > 1)
  select jsonb_build_object(
    'duplicates', jsonb_build_object(
      'groups', (select count(*) from dup),
      'extra_rows', coalesce((select sum(cnt - 1) from dup), 0),
      'list', coalesce((select jsonb_agg(jsonb_build_object(
                  'topic', t.name, 'stem', d.stem, 'keep_id', d.keep_id, 'items', d.items) order by t.name, d.stem)
                  from dup d join prep.topics t on t.code = d.topic), '[]'::jsonb)),
    'similar_stems', jsonb_build_object(
      'groups', (select count(*) from sim),
      'list', coalesce((select jsonb_agg(jsonb_build_object('topic', t.name, 'stem', s.stem, 'ids', s.ids) order by t.name)
                  from (select * from sim order by topic limit 20) s join prep.topics t on t.code = s.topic), '[]'::jsonb)),
    'thin_topics', coalesce((
      select jsonb_agg(jsonb_build_object('code', t.code, 'name', t.name, 'section', t.section, 'grp', t.grp,
                                          'approved', c.approved, 'review', c.review) order by c.approved, t.sort)
        from prep.topics t
        join lateral (select count(*) filter (where q.status = 'approved') approved,
                             count(*) filter (where q.status = 'review') review
                        from prep.questions q where q.topic = t.code) c on true
       where c.approved < 30), '[]'::jsonb),
    'mock_ready', coalesce((
      select jsonb_agg(jsonb_build_object('code', m.code, 'name', m.name, 'needed', m.questions,
               'available', (select count(*) from prep.questions q where q.status = 'approved'
                              and q.topic = any (case when m.code = 'B-MAJOR'
                                    then (select coalesce(array_agg(t.code), '{}') from prep.topics t where t.grp = 'B3')
                                    else prep.mock_topics(m.code, null) end))) order by m.sort)
        from prep.mock_subjects m), '[]'::jsonb),
    'majors_ready', jsonb_build_object(
      'total', (select count(*) from prep.topics where grp = 'B3'),
      'ready_100', (select count(*) from prep.topics t where t.grp = 'B3'
                     and (select count(*) from prep.questions q where q.topic = t.code and q.status = 'approved') >= 100),
      'empty', coalesce((select jsonb_agg(t.name order by t.name) from prep.topics t where t.grp = 'B3'
                          and not exists (select 1 from prep.questions q where q.topic = t.code and q.status = 'approved')), '[]'::jsonb)),
    'suspicious', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'topic', x.tname, 'stem', x.stem, 'n', x.n, 'correct', x.correct,
                                          'pct', round(100.0 * x.correct / x.n)) order by x.pct_raw)
        from (select q.id, t.name tname, q.stem, s.n, s.correct, s.correct::numeric / s.n as pct_raw
                from prep.question_stats s join prep.questions q on q.id = s.question_id join prep.topics t on t.code = q.topic
               where q.status = 'approved' and s.n >= 10 and (s.correct::numeric / s.n < 0.2 or s.correct::numeric / s.n > 0.95)
               order by abs(0.575 - s.correct::numeric / s.n) desc limit 20) x), '[]'::jsonb),
    'origins', coalesce((select jsonb_agg(jsonb_build_object('origin', origin, 'n', n) order by n desc)
                          from (select origin, count(*) n from prep.questions where status = 'approved' group by origin) o), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('source', source, 'origin', origin, 'n', n) order by n desc)
                          from (select coalesce(source, '(ไม่ระบุ)') source, origin, count(*) n from prep.questions
                                 where status = 'approved' group by 1, 2 order by n desc limit 40) s), '[]'::jsonb)
  ) into res;
  return res;
end $$;

-- Hide extra copies. Every copy in p_ids must still have another approved copy outside p_ids.
create function public.prep_admin_hide_duplicates(p_ids int[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a uuid := prep.require_admin();
  n int;
begin
  if p_ids is null or cardinality(p_ids) = 0 then raise exception 'nothing_selected'; end if;
  if cardinality(p_ids) > 500 then raise exception 'too_many'; end if;
  if exists (
       select 1 from prep.questions q
        where q.id = any (p_ids) and q.status = 'approved'
          and not exists (select 1 from prep.questions o
                           where o.id <> q.id and o.id <> all (p_ids) and o.status = 'approved'
                             and o.topic = q.topic and prep.qkey(o.stem, o.choices) = prep.qkey(q.stem, q.choices))) then
    raise exception 'would_hide_all';
  end if;
  update prep.questions set status = 'hidden' where id = any (p_ids) and status = 'approved';
  get diagnostics n = row_count;
  if n > 0 then
    insert into prep.admin_actions (admin_id, user_id, action, detail)
    values (a, null, 'hide_duplicates', jsonb_build_object('count', n, 'ids', to_jsonb(p_ids)));
  end if;
  return jsonb_build_object('ok', true, 'hidden', n);
end $$;

revoke execute on function prep.qkey(text, jsonb) from public;
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('prep_admin_content_health', 'prep_admin_hide_duplicates') loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
