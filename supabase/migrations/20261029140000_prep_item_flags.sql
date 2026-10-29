-- Answer keys that learners' answers say are probably wrong. In the first two weeks, 120 of the 682 approved questions
-- with 20+ answers had a wrong choice picked more often than the key, and only 4 of them had been reported. They now show
-- in the admin bank under the status filter "เฉลยน่าสงสัย" (sorted by how far the top wrong choice leads); an admin
-- either fixes the key or marks it checked, and a checked question only comes back after 50% more people have answered it.

create table if not exists prep.item_checks (
  question_id int primary key references prep.questions(id) on delete cascade,
  n_at        int not null,
  checked_by  uuid references auth.users(id) on delete set null,
  checked_at  timestamptz not null default now()
);
alter table prep.item_checks enable row level security;
revoke all on prep.item_checks from public, anon, authenticated;

-- How suspicious a key is, or null when it is not: approved, 15+ first answers, and either a wrong choice beats the key
-- or under 25% pick the key (the guessing rate). The value is the top wrong choice's lead over the key, as a share of
-- answers, so the worst come first. question_stats counts first answers only; choice_counts is 1-based, answer 0-based.
create or replace function prep.item_suspect(p_id int, p_status text, p_answer int, p_n int, p_correct int, p_counts int[])
returns numeric language sql stable set search_path = '' as $$
  select case
    when p_status <> 'approved' or coalesce(p_n, 0) < 15 or p_counts is null then null
    when exists (select 1 from prep.item_checks c where c.question_id = p_id and p_n < c.n_at * 1.5) then null
    else (select case when top > key or coalesce(p_correct, 0) < p_n * 0.25 then round((top - key)::numeric / p_n, 3) end
            from (select coalesce(p_counts[p_answer + 1], 0) as key,
                         (select max(v) from unnest(p_counts) with ordinality u(v, i) where i <> p_answer + 1) as top) x)
  end
$$;
revoke execute on function prep.item_suspect(int, text, int, int, int, int[]) from public, anon, authenticated;

create or replace function public.prep_admin_item_ok(p_id int) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.require_admin();
begin
  insert into prep.item_checks (question_id, n_at, checked_by)
  values (p_id, coalesce((select n from prep.question_stats where question_id = p_id), 0), u)
  on conflict (question_id) do update set n_at = excluded.n_at, checked_by = excluded.checked_by, checked_at = now();
end $$;

-- prep_admin_questions as in production, plus the "suspect" status filter and sort and a suspect value per item.
create or replace function public.prep_admin_questions(p_section text DEFAULT NULL::text, p_grp text DEFAULT NULL::text, p_topic text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_sort text DEFAULT 'new'::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
           (select count(*) from prep.reports r where r.question_id = q.id and r.status = 'open') as open_reports,
           prep.item_suspect(q.id, q.status, q.answer, s.n, s.correct, s.choice_counts) as suspect
      from prep.questions q
      join prep.topics t on t.code = q.topic
      left join prep.question_stats s on s.question_id = q.id
     where (p_section is null or t.section = p_section)
       and (p_grp is null or t.grp = p_grp)
       and (p_topic is null or q.topic = p_topic)
       and (p_status is null or q.status = p_status or (p_status = 'reported' and exists
             (select 1 from prep.reports r where r.question_id = q.id and r.status = 'open'))
            or (p_status = 'suspect' and prep.item_suspect(q.id, q.status, q.answer, s.n, s.correct, s.choice_counts) is not null))
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
       case when p_sort = 'suspect' then suspect end desc nulls last,
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
        'status', status, 'created_at', created_at, 'suspect', suspect,
        'n', st_n, 'correct', st_correct, 'choice_counts', to_jsonb(st_choices),
        'reports', (select coalesce(jsonb_agg(r.reason order by r.id), '[]'::jsonb) from prep.reports r
                     where r.question_id = page.id and r.status = 'open'))
      ) from page), '[]'::jsonb)
  ) into res;
  return res;
end $function$;

do $$
declare f text;
begin
  for f in select unnest(array['public.prep_admin_item_ok(integer)',
                               'public.prep_admin_questions(text,text,text,text,text,text,integer,integer)']) loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
