-- ลดภาระฐานข้อมูล (ล่ม 12 พ.ย. 22:45: Disk IO balance ของเครื่อง Nano หมด → ทุกคำสั่ง timeout)
-- 1) prep_dashboard (เรียกทุกครั้งที่เปิดหน้าแรก): 'available' / 'seen' ต่อหมวดเดิมเป็น subquery ทีละหมวด
--    ทำให้อ่าน prep.questions ทั้งตาราง ~64 รอบต่อครั้ง → นับครั้งเดียวทุกหมวดด้วย CTE (ผลลัพธ์เท่าเดิม)
--    ทดสอบบนข้อมูลสำรอง 13 พ.ย.: ผลเหมือนเดิมทุกคน (50 คน), เฉลี่ย 64.6 → 4.0 ms, อ่านทั้งตาราง 64 → 1 รอบ
-- 2) prep.attempts ไม่มี index ของ user_id → ทุกคำสั่งที่หาชุดของผู้ใช้ (readiness ฯลฯ) อ่านทั้งตาราง
--    (production: 143k ครั้ง ~1.95 พันล้านแถว) → index (user_id, started_at desc); readiness 20.3 → 16.0 ms
-- CREATE OR REPLACE คงสิทธิ์ (grant) เดิมของ prep_dashboard ไว้
-- ลำดับ topics: เพิ่ม t.grp, t.code ต่อท้าย sort ให้ลำดับคงที่ (sort 70 มี B1-VEC-SEP กับ B2-NEA ซ้ำกัน — เดิมสลับได้)

create index if not exists attempts_user_started on prep.attempts (user_id, started_at desc);

CREATE OR REPLACE FUNCTION public.prep_dashboard()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u     uuid := prep.uid();
  today date := prep.today();
  res   jsonb;
begin
  with days as (
         select day from prep.daily_activity where user_id = u and answered > 0),
       runs as (
         select day, day - (row_number() over (order by day))::int as grp from days),
       streak as (
         select count(*)::int as n from runs
          where grp = (select grp from runs order by day desc limit 1)
            and (select max(day) from days) >= today - 1),
       -- นับครั้งเดียวทุกหมวด (เดิมนับทีละหมวด = อ่านคลังข้อสอบทั้งคลัง ~64 รอบต่อการเปิดหน้าแรก)
       avail as (
         select q.topic, count(*)::int as n from prep.questions q where q.status = 'approved' group by q.topic),
       seen_by_topic as (
         select q.topic, count(*)::int as n from prep.user_question_state s
           join prep.questions q on q.id = s.question_id
          where s.user_id = u group by q.topic)
  select jsonb_build_object(
    'answered_total', coalesce((select sum(answered) from prep.daily_activity where user_id = u), 0),
    'correct_total',  coalesce((select sum(correct)  from prep.daily_activity where user_id = u), 0),
    'seen',           (select count(*) from prep.user_question_state where user_id = u),
    'bank',           (select count(*) from prep.questions where status = 'approved'),
    'stubborn',       (select count(*) from prep.user_question_state where user_id = u and wrong >= 2),
    'still_wrong',    (select count(*) from prep.user_question_state where user_id = u and last_correct = false),
    'streak',         coalesce((select n from streak), 0),
    'sets',           (select count(*) from prep.sets where user_id = u),
    'sets_cleared',   (select count(*) from prep.sets where user_id = u and cleared_at is not null),
    'days', coalesce((
       select jsonb_agg(jsonb_build_object('day', g::date,
                'answered', coalesce(d.answered, 0), 'correct', coalesce(d.correct, 0)) order by g)
       from generate_series(today - 13, today, interval '1 day') g
       left join prep.daily_activity d on d.user_id = u and d.day = g::date), '[]'::jsonb),
    'topics', coalesce((
       select jsonb_agg(jsonb_build_object(
                'code', t.code, 'name', t.name, 'grp', t.grp, 'section', t.section,
                'n', coalesce(ts.n, 0), 'correct', coalesce(ts.correct, 0),
                'available', coalesce(av.n, 0),
                'seen', coalesce(sb.n, 0)
              ) order by t.sort, t.grp, t.code)   -- เดิม order by t.sort: หมวดที่ sort เท่ากันสลับลำดับได้
       from prep.topics t
       left join prep.user_topic_stats ts on ts.user_id = u and ts.topic = t.code
       left join avail av on av.topic = t.code
       left join seen_by_topic sb on sb.topic = t.code
      where t.track is null or t.track = prep.user_track(u)), '[]'::jsonb)
  ) into res;
  return res;
end $function$;
