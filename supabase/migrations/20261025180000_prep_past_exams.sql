-- Past-exam practice ("แนวข้อสอบเก่า"): a set built only from questions that carry an exam_tag, e.g. "แนวข้อสอบ สอศ. 2565".
-- 1) prep_create_set takes an optional p_tag and keeps only questions whose exam_tag starts with it. Everything else
--    (packages, free quota, sizes, modes) is unchanged.
-- 2) prep_past_tags() lists the tags a learner can practise: one row per tag (variants in brackets folded in) and section.
-- 3) prep_create_past_set(tag, section) builds the largest set the learner's packages allow and returns its id.
-- 4) The ten 2566 guide questions shown in the ภาค ก summaries join the bank, reworded, under "แนวข้อสอบ สพฐ. 2566".
--    The tag names the exam and year only; where a point came from stays in source/ref, which learners never see.

drop function public.prep_create_set(text[], integer, text, text, text[]);
create function public.prep_create_set(p_topics text[], p_size integer, p_mode text default 'new', p_title text default null,
                                       p_subtopics text[] default null, p_tag text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
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
end $$;

-- "แนวข้อสอบ สอศ. 2565 (มาตรฐานทวิภาคี 2557)" counts under "แนวข้อสอบ สอศ. 2565".
create function prep.past_tag(t text) returns text language sql immutable set search_path = '' as $$
  select nullif(trim(regexp_replace(t, '\s*\(.*\)\s*$', '')), '')
$$;

create function public.prep_past_tags() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('tag', g.tag, 'section', g.section, 'n', g.n, 'covered', g.covered)
                            order by g.yr desc, g.tag, g.section), '[]')
  from (
    select prep.past_tag(q.exam_tag) tag, t.section, count(*) n,
           coalesce(substring(prep.past_tag(q.exam_tag) from '(\d{4})$'), '0') yr,
           prep.covers(prep.active_packages(prep.uid()), array_agg(distinct q.topic)) covered
    from prep.questions q join prep.topics t on t.code = q.topic
    where q.status = 'approved' and q.exam_tag is not null
    group by 1, 2
  ) g
$$;

create function public.prep_create_past_set(p_tag text, p_section text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  topics text[];
  n int;
begin
  select array_agg(distinct q.topic), count(*) into topics, n
    from prep.questions q join prep.topics t on t.code = q.topic
   where q.status = 'approved' and t.section = p_section and prep.past_tag(q.exam_tag) = p_tag;
  if n is null or n < 5 then
    raise exception 'not_enough_questions';
  end if;
  return public.prep_create_set(topics,
    least(n, case when prep.covers(prep.active_packages(prep.uid()), topics) then 200 else 40 end),
    'new', p_tag, null, p_tag);
end $$;

revoke execute on function prep.past_tag(text) from public;
do $$
declare f text;
begin
  for f in select unnest(array['public.prep_create_set(text[],integer,text,text,text[],text)',
                               'public.prep_past_tags()', 'public.prep_create_past_set(text,text)']) loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

insert into prep.questions (topic, level, stem, choices, answer, explanation, law_ref, origin, source, status, content_hash, exam_tag, ref)
select v.topic, v.level, v.stem, v.choices, v.answer, v.explanation, v.law_ref, 'manual',
       'เรียบเรียงใหม่ · แนวข้อสอบครูผู้ช่วย 2566 · kruchiangrai.net', 'approved',
       prep.content_hash(v.stem, v.choices), 'แนวข้อสอบ สพฐ. 2566',
       'https://www.kruchiangrai.net/2023/05/20/ข้าราชการที่ดี-10-ข้อ/'
from (values
  ('A3-ADMIN', 'remember',
   'ตาม พ.ร.บ.ระเบียบบริหารราชการแผ่นดิน พ.ศ. 2534 ข้อใดไม่ใช่การจัดระเบียบบริหารราชการแผ่นดิน',
   '["ระเบียบบริหารราชการส่วนรวม","ระเบียบบริหารราชการส่วนกลาง","ระเบียบบริหารราชการส่วนภูมิภาค","ระเบียบบริหารราชการส่วนท้องถิ่น"]'::jsonb, 0,
   'มาตรา 4 แบ่งการจัดระเบียบบริหารราชการแผ่นดินไว้ 3 ส่วนเท่านั้น คือ ส่วนกลาง ส่วนภูมิภาค และส่วนท้องถิ่น ไม่มี "ส่วนรวม"',
   'พ.ร.บ.ระเบียบบริหารราชการแผ่นดิน พ.ศ. 2534 ม.4'),
  ('A3-ADMIN', 'understand',
   'ข้อใดไม่ใช่ราชการบริหารส่วนท้องถิ่น',
   '["กรุงเทพมหานคร","เมืองพัทยา","องค์การบริหารส่วนจังหวัดลำปาง","จังหวัดภูเก็ต"]'::jsonb, 3,
   'จังหวัดเป็นนิติบุคคลก็จริง แต่เป็นราชการบริหารส่วนภูมิภาค (ม.52) ส่วน กทม. เมืองพัทยา และ อบจ. เป็นราชการส่วนท้องถิ่น (ม.70)',
   'พ.ร.บ.ระเบียบบริหารราชการแผ่นดิน พ.ศ. 2534 ม.52, ม.70'),
  ('A3-GOODGOV', 'remember',
   'ตาม พ.ร.ฎ.ว่าด้วยหลักเกณฑ์และวิธีการบริหารกิจการบ้านเมืองที่ดี ส่วนราชการต้องจัดทำแผนปฏิบัติราชการเป็นแผนระยะกี่ปี',
   '["1 ปี","3 ปี","5 ปี","10 ปี"]'::jsonb, 2,
   'มาตรา 16 ที่แก้ไขโดย พ.ร.ฎ. (ฉบับที่ 2) พ.ศ. 2562 ให้จัดทำเป็นแผนห้าปี (ฉบับเดิมเป็นแผนสี่ปี และช่วงแรกปีงบประมาณ 2563–2565 ทำเป็นแผนสามปี)',
   'พ.ร.ฎ.บริหารกิจการบ้านเมืองที่ดี พ.ศ. 2546 ม.16 (แก้ไข 2562)'),
  ('A3-GOODGOV', 'understand',
   'ในการทบทวนภารกิจของส่วนราชการตามมาตรา 33 ของ พ.ร.ฎ.บริหารกิจการบ้านเมืองที่ดี ข้อใดไม่ได้ระบุให้นำมาคำนึงถึง',
   '["แผนพัฒนาเศรษฐกิจและสังคมแห่งชาติ","แนวโน้มอัตราการเจริญเติบโตทางเศรษฐกิจ","นโยบายของคณะรัฐมนตรีที่แถลงต่อรัฐสภา","แผนแม่บทตามยุทธศาสตร์ชาติ"]'::jsonb, 1,
   'มาตรา 33 (แก้ไข 2562) ให้คำนึงถึงยุทธศาสตร์ชาติ แผนแม่บท แผนการปฏิรูปประเทศ แผนพัฒนาเศรษฐกิจและสังคมแห่งชาติ นโยบายของคณะรัฐมนตรีที่แถลงต่อรัฐสภา แผนอื่นที่เกี่ยวข้อง กำลังเงินงบประมาณ ความคุ้มค่า และสถานการณ์ ไม่มีแนวโน้มอัตราการเจริญเติบโตทางเศรษฐกิจ',
   'พ.ร.ฎ.บริหารกิจการบ้านเมืองที่ดี พ.ศ. 2546 ม.33 (แก้ไข 2562)'),
  ('A3-ADMINPROC', 'remember',
   '"การพิจารณาทางปกครอง" ตาม พ.ร.บ.วิธีปฏิบัติราชการทางปกครอง พ.ศ. 2539 หมายถึงข้อใด',
   '["การเตรียมการและการดำเนินการของเจ้าหน้าที่เพื่อจัดให้มีคำสั่งทางปกครอง","การสอบสวนความผิดทางวินัยของเจ้าหน้าที่","การพิจารณาโทษผู้ฝ่าฝืนคำสั่งทางปกครอง","การปฏิบัติตามคำพิพากษาของศาลปกครอง"]'::jsonb, 0,
   'นิยามในมาตรา 5 ระวังสับกับ "วิธีปฏิบัติราชการทางปกครอง" ซึ่งรวมการเตรียมการเพื่อออก "กฎ" ด้วย',
   'พ.ร.บ.วิธีปฏิบัติราชการทางปกครอง พ.ศ. 2539 ม.5'),
  ('A3-ADMINPROC', 'remember',
   'คำสั่งทางปกครองทำในรูปแบบใดได้บ้าง',
   '["ทำเป็นหนังสือ","ทำด้วยวาจา","สื่อความหมายในรูปแบบอื่นที่ชัดเจนพอจะเข้าใจ","ทำได้ทุกรูปแบบข้างต้น"]'::jsonb, 3,
   'มาตรา 34 คำสั่งทางปกครองอาจทำเป็นหนังสือ วาจา หรือสื่อความหมายในรูปแบบอื่นก็ได้ แต่ต้องมีข้อความหรือความหมายชัดเจนพอที่จะเข้าใจได้',
   'พ.ร.บ.วิธีปฏิบัติราชการทางปกครอง พ.ศ. 2539 ม.34'),
  ('A3-CRIMINAL', 'remember',
   'เจ้าพนักงานผู้มีหน้าที่ซื้อ ทำ จัดการ หรือรักษาทรัพย์ ใช้อำนาจในตำแหน่งโดยทุจริตจนรัฐหรือเจ้าของทรัพย์เสียหาย ต้องระวางโทษตามข้อใด',
   '["จำคุก 5–20 ปี หรือจำคุกตลอดชีวิต และปรับ 100,000–400,000 บาท","จำคุก 1–10 ปี หรือปรับ 20,000–200,000 บาท หรือทั้งจำทั้งปรับ","จำคุก 10–20 ปี หรือจำคุกตลอดชีวิต และปรับ 500,000–1,000,000 บาท","จำคุกไม่เกิน 5 ปี หรือปรับไม่เกิน 100,000 บาท หรือทั้งจำทั้งปรับ"]'::jsonb, 0,
   'ประมวลกฎหมายอาญา มาตรา 151 อัตราโทษตามที่แก้ไขปี 2560 เท่ากับความผิดเรื่องทรัพย์ของราชการ (ม.147) คือ จำคุก 5–20 ปี หรือตลอดชีวิต และปรับ 1 แสน–4 แสนบาท',
   'ประมวลกฎหมายอาญา ม.151'),
  ('A3-OTHER', 'understand',
   'ตาม พ.ร.บ.ความรับผิดทางละเมิดของเจ้าหน้าที่ พ.ศ. 2539 เจ้าหน้าที่ต้องรับผิดต่อผู้เสียหายเป็นการเฉพาะตัวในกรณีใด',
   '["ละเมิดขณะปฏิบัติหน้าที่นอกเวลาราชการ","ละเมิดขณะปฏิบัติหน้าที่เกินกว่าที่ผู้บังคับบัญชาสั่ง","ละเมิดที่ไม่ใช่การกระทำในการปฏิบัติหน้าที่","ละเมิดในการปฏิบัติหน้าที่โดยจงใจ"]'::jsonb, 2,
   'มาตรา 6 ถ้าการละเมิดไม่ใช่การกระทำในการปฏิบัติหน้าที่ เจ้าหน้าที่รับผิดเฉพาะตัว ผู้เสียหายฟ้องเจ้าหน้าที่ได้โดยตรง ส่วนละเมิดในหน้าที่แม้จงใจ หน่วยงานของรัฐรับผิดต่อผู้เสียหายก่อน (ม.5) แล้วจึงไล่เบี้ย (ม.8)',
   'พ.ร.บ.ความรับผิดทางละเมิดของเจ้าหน้าที่ พ.ศ. 2539 ม.5, ม.6, ม.8'),
  ('A3-ETHICS', 'remember',
   'ข้อใดไม่ใช่มาตรฐานทางจริยธรรมตาม พ.ร.บ.มาตรฐานทางจริยธรรม พ.ศ. 2562',
   '["กล้าตัดสินใจและกระทำในสิ่งที่ถูกต้องชอบธรรม","มุ่งผลสัมฤทธิ์ของงาน","ดำรงตนเป็นแบบอย่างที่ดี","ประหยัด มัธยัสถ์ และอดออม"]'::jsonb, 3,
   'มาตรา 5 กำหนดมาตรฐานทางจริยธรรม 7 ประการ ไม่มีเรื่องประหยัด มัธยัสถ์ อดออม',
   'พ.ร.บ.มาตรฐานทางจริยธรรม พ.ศ. 2562 ม.5'),
  ('A3-ETHICS', 'understand',
   'ข้อใดไม่อยู่ในมาตรฐานทางจริยธรรมที่ใช้เป็นหลักในการจัดทำประมวลจริยธรรมของหน่วยงานของรัฐ',
   '["รักษาภาพลักษณ์ของทางราชการ","มีจิตสำนึกที่ดี","ไม่เลือกปฏิบัติ","สำนึกรักบ้านเกิดและสิ่งแวดล้อม"]'::jsonb, 3,
   'สามข้อแรกอยู่ในมาตรฐานประการที่ 7, 2 และ 6 ของมาตรา 5 ตามลำดับ "สำนึกรักบ้านเกิดและสิ่งแวดล้อม" ไม่อยู่ในมาตรฐาน',
   'พ.ร.บ.มาตรฐานทางจริยธรรม พ.ศ. 2562 ม.5')
) as v(topic, level, stem, choices, answer, explanation, law_ref)
on conflict (content_hash) do nothing;
