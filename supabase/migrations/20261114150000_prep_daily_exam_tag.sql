-- ข้อสอบประจำวันส่งแท็กสนามสอบ (exam_tag) มาด้วย เหมือนชุดฝึกและสอบจำลอง
-- ให้แอปแสดงแถบ "แนวข้อสอบ ครูผู้ช่วย สพฐ. รอบทั่วไป 2569 · จากผู้เข้าสอบ" บนข้อที่มีแท็ก
-- เหมือนนิยามเดิม (20261103090000_prep_daily_topic.sql) ทุกอย่าง ต่างแค่เพิ่ม 'tag' ในรายการข้อ

create or replace function prep.daily_payload(u uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare
  d      date := prep.today();
  ids    int[] := prep.daily_ids();
  a      smallint[];
  items  jsonb := '[]'::jsonb;
  q      prep.questions;
  i      int;
  pct    int;
  score  int := 0;
  done   boolean;
  streak int := 0;
  dd     date;
  tp     jsonb;
  nx     jsonb;
begin
  select da.answers into a from prep.daily_answers da where da.user_id = u and da.day = d;
  if a is null then a := array_fill(null::smallint, array[cardinality(ids)]); end if;
  for i in 1..cardinality(ids) loop
    select * into q from prep.questions where id = ids[i];
    if a[i] is null then
      items := items || jsonb_build_object('idx', i - 1, 'tag', q.exam_tag, 'stem', q.stem, 'choices', q.choices, 'picked', null);
    else
      select round(100.0 * count(*) filter (where x.answers[i] = q.answer) / nullif(count(*) filter (where x.answers[i] is not null), 0))::int
        into pct from prep.daily_answers x where x.day = d;
      if a[i] = q.answer then score := score + 1; end if;
      items := items || jsonb_build_object('idx', i - 1, 'tag', q.exam_tag, 'stem', q.stem, 'choices', q.choices, 'picked', a[i],
                 'correct', a[i] = q.answer, 'answer', q.answer, 'explanation', q.explanation, 'pct_correct', pct);
    end if;
  end loop;
  done := not exists (select 1 from unnest(a) v where v is null);

  dd := case when done then d else d - 1 end;
  loop
    exit when not exists (select 1 from prep.daily_answers x
                           where x.user_id = u and x.day = dd
                             and not exists (select 1 from unnest(x.answers) v where v is null));
    streak := streak + 1;
    dd := dd - 1;
  end loop;

  select jsonb_build_object('code', t.code, 'name', t.name, 'section', left(t.grp, 1))
    into tp from prep.daily_quiz dq join prep.topics t on t.code = dq.topic where dq.day = d;
  select jsonb_build_object('code', t.code, 'name', t.name, 'section', left(t.grp, 1))
    into nx from prep.topics t where t.code = prep.daily_topic(d + 1);

  return jsonb_build_object('day', d, 'items', items, 'done', done, 'score', score, 'total', cardinality(ids),
                            'streak', streak, 'players', (select count(*) from prep.daily_answers x where x.day = d),
                            'topic', tp, 'next_topic', nx);
end $$;

revoke execute on function prep.daily_payload(uuid) from public;
