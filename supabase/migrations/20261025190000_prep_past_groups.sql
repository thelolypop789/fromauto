-- Past-exam sets from the summaries: a map offers the past-exam questions of its own subject group (A3 ข้าราชการที่ดี,
-- A1 คิดวิเคราะห์ ...), not the whole section. Single topics are too small for a set (a set needs at least 5 questions).
-- prep_past_tags() also returns counts per group ("A3": 10), and prep_create_past_set takes an optional topic prefix.

create or replace function public.prep_past_tags() returns jsonb
language sql stable security definer set search_path = '' as $$
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
      group by 1, 2, 3
    ) x
    group by x.tag, x.section
  ) g
$$;

drop function public.prep_create_past_set(text, text);
create function public.prep_create_past_set(p_tag text, p_section text, p_prefix text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  topics text[];
  n int;
begin
  select array_agg(distinct q.topic), count(*) into topics, n
    from prep.questions q join prep.topics t on t.code = q.topic
   where q.status = 'approved' and t.section = p_section and prep.past_tag(q.exam_tag) = p_tag
     and (p_prefix is null or q.topic like p_prefix || '%');
  if n is null or n < 5 then
    raise exception 'not_enough_questions';
  end if;
  return public.prep_create_set(topics,
    least(n, case when prep.covers(prep.active_packages(prep.uid()), topics) then 200 else 40 end),
    'new', p_tag, null, p_tag);
end $$;

revoke execute on function public.prep_create_past_set(text, text, text) from public, anon;
grant execute on function public.prep_create_past_set(text, text, text) to authenticated;
