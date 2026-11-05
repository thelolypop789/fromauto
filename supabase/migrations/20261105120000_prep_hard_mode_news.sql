-- โหมดท้าทายนับโจทย์ข่าวในกระแส (ref ขึ้นต้น 'claude-news-2026-11') ด้วย นอกจากโจทย์สถานการณ์
-- หมวดข่าวและเหตุการณ์ปัจจุบันจึงเลือกในโหมดท้าทายได้ · ฟังก์ชันคัดจากเวอร์ชันที่รันอยู่จริง เปลี่ยนเฉพาะเงื่อนไขนี้

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
  if not covered and p.free_sets_used >= 3 + p.free_sets_bonus then
    raise exception 'free_quota_exceeded';
  end if;
  if p_mode not in ('new', 'weak', 'mixed', 'hard') then
    raise exception 'invalid_mode';
  end if;
  select coalesce(array_agg(distinct s.topic), '{}') into narrowed
    from prep.subtopics s where s.code = any (coalesce(p_subtopics, '{}')) and s.topic = any (p_topics);

  select array_agg(x.id) into ids
  from (
    select q.id
    from prep.questions q
    left join prep.user_question_state s on s.user_id = u and s.question_id = q.id
    left join prep.question_stats st on st.question_id = q.id
    where q.status = 'approved' and q.topic = any (p_topics)
      and (q.topic <> all (narrowed) or q.subtopic = any (p_subtopics))
      and (p_tag is null or q.exam_tag like p_tag || '%')
      -- โหมดท้าทาย: โจทย์สถานการณ์ / ระดับวิเคราะห์ / ข้อที่คนตอบถูกไม่ถึงครึ่ง และไม่ใช่ข้อที่ระบบสงสัยว่าเฉลยผิด
      and (p_mode <> 'hard' or (
            (q.level = 'analyze' or q.ref = 'claude-scenario-2026-11' or q.ref like 'claude-news-2026-11%' or (st.n >= 20 and st.correct::numeric / st.n < 0.5))
            and prep.item_suspect(q.id, q.status, q.answer, coalesce(st.n, 0), coalesce(st.correct, 0), st.choice_counts) is null))
    order by
      case p_mode
        when 'new'  then case when s.question_id is null then 0 else 1 end
        when 'hard' then case when s.question_id is null then 0 else 1 end
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
