-- แนวข้อสอบเก่าแยกหมวด: ชุดที่สร้างจากหมวดเดียว (p_prefix เช่น 'A1-') ได้ชื่อชุดต่อท้ายชื่อหมวด
-- เช่น "แนวข้อสอบ ครูผู้ช่วย สพฐ. รอบทั่วไป 2569 · คิดวิเคราะห์" จะได้แยกออกจากชุดทั้งภาคในรายการชุดของฉัน
-- เหมือนนิยามเดิม (20261026100000_prep_track_filter.sql) ทุกอย่าง ต่างแค่ชื่อชุด

create or replace function public.prep_create_past_set(p_tag text, p_section text, p_prefix text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  topics text[];
  n int;
  label text := case split_part(coalesce(p_prefix, ''), '-', 1)
    when 'A1' then 'คิดวิเคราะห์'
    when 'A2' then 'ภาษาอังกฤษ'
    when 'A3' then 'ข้าราชการที่ดี'
    when 'B1' then 'วิชาการศึกษา'
    when 'B2' then 'กฎหมายและนโยบายการศึกษา'
    when 'B3' then 'วิชาเอก'
  end;
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
    'new', p_tag || coalesce(' · ' || label, ''), null, p_tag);
end $$;

revoke execute on function public.prep_create_past_set(text, text, text) from public, anon;
grant execute on function public.prep_create_past_set(text, text, text) to authenticated;
