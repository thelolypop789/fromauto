-- ข้อสอบประจำวันเป็น "เรื่องเดียวต่อวัน" สลับภาค ก / ภาค ข (ไม่รวมวิชาเอก)
-- เดิม: สุ่มภาค ก ปนกัน 5+2+3 ข้อ ทุกวัน
-- ใหม่: วันคู่ = เรื่องถัดไปของภาค ก, วันคี่ = เรื่องถัดไปของภาค ข (สลับกลุ่มย่อยในภาค)
--       เลือกเฉพาะเรื่องที่ใช้ร่วมทั้ง สพฐ./สอศ. (track is null) และมีข้อพร้อมใช้ >= 10 ข้อ
--       เลี่ยงข้อที่เคยออกใน 60 วันที่ผ่านมา (ถ้าไม่พอค่อยใช้ซ้ำ)
-- ชุดของวันที่สร้างไปแล้วไม่เปลี่ยน (topic เป็น null = ชุดแบบเดิม)

alter table prep.daily_quiz add column if not exists topic text references prep.topics(code);

-- เรื่องของวันที่ d (คำนวณได้ล่วงหน้า ใช้บอก "พรุ่งนี้เรื่องอะไร")
create or replace function prep.daily_topic(d date) returns text
language sql stable set search_path to '' as $$
  with pool as (
    select t.code, t.grp, left(t.grp, 1) as sec,
           row_number() over (partition by t.grp order by t.sort, t.code) as gi
      from prep.topics t
     where t.grp in ('A1', 'A2', 'A3', 'B1', 'B2') and t.track is null
       and (select count(*) from prep.questions q where q.topic = t.code and q.status = 'approved') >= 10
  ), k as (
    select (d - date '2026-01-01') as n
  ), pick as (
    select case when (select n from k) % 2 = 0 then 'A' else 'B' end as sec,
           ((select n from k) / 2) as i
  )
  select p.code from (
    -- สลับกลุ่มในภาคเดียวกัน: ก = คิดวิเคราะห์ → อังกฤษ → ข้าราชการ → …, ข = วิชาชีพครู ↔ กฎหมาย
    select code, row_number() over (order by gi, grp) - 1 as rn,
           count(*) over () as cnt
      from pool where sec = (select sec from pick)
  ) p
  where p.rn = (select i from pick) % p.cnt
$$;

create or replace function prep.daily_ids() returns int[]
language plpgsql set search_path to '' as $$
declare d date := prep.today(); ids int[]; tp text;
begin
  select question_ids into ids from prep.daily_quiz where day = d;
  if ids is not null then return ids; end if;
  perform pg_advisory_xact_lock(hashtext('prep_daily_quiz'));
  select question_ids into ids from prep.daily_quiz where day = d;
  if ids is not null then return ids; end if;

  tp := prep.daily_topic(d);
  if tp is null then raise exception 'not_enough_questions'; end if;

  -- ข้อที่ไม่เคยออกใน 60 วันมาก่อน แล้วค่อยเติมด้วยข้อที่เคยออก
  select array_agg(x.id order by x.seen, random()) into ids from (
    select q.id,
           exists (select 1 from prep.daily_quiz dq
                    where dq.day > d - 60 and q.id = any (dq.question_ids)) as seen
      from prep.questions q
     where q.topic = tp and q.status = 'approved'
     order by 2, random()
     limit 10) x;
  if ids is null or cardinality(ids) < 5 then raise exception 'not_enough_questions'; end if;
  insert into prep.daily_quiz (day, question_ids, topic) values (d, ids, tp);
  return ids;
end $$;

-- payload เดิม + topic ของวันนี้ และเรื่องของพรุ่งนี้
create or replace function prep.daily_payload(u uuid) returns jsonb
language plpgsql set search_path to '' as $$
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
      items := items || jsonb_build_object('idx', i - 1, 'stem', q.stem, 'choices', q.choices, 'picked', null);
    else
      select round(100.0 * count(*) filter (where x.answers[i] = q.answer) / nullif(count(*) filter (where x.answers[i] is not null), 0))::int
        into pct from prep.daily_answers x where x.day = d;
      if a[i] = q.answer then score := score + 1; end if;
      items := items || jsonb_build_object('idx', i - 1, 'stem', q.stem, 'choices', q.choices, 'picked', a[i],
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

revoke all on function prep.daily_topic(date) from public, anon, authenticated;
