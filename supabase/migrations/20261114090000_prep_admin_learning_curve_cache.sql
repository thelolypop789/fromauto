-- หน้าแอดมิน "การเรียนรู้" เปิดไม่ขึ้น: prep_admin_learning ใช้ 3–8 วินาทีบน Nano (statement_timeout ของ authenticated = 8s)
-- เวลาราวครึ่งหนึ่งอยู่ที่ 'curve' (หาคำตอบแรกของทุกคนทุกข้อจาก answer_log ทั้งตาราง) ซึ่งไม่ขึ้นกับจำนวนวัน
-- → คำนวณล่วงหน้าทุก 3 ชม. ด้วย pg_cron (ไม่ติด timeout ของผู้ใช้) เก็บต่อสายใน prep.admin_curve_cache
-- ส่วนอื่นของ admin_learning เหมือนเดิมทุกตัว (ยึดนิยามที่รันอยู่บน production 13 พ.ย.) + เพิ่ม 'curve_at' บอกเวลาที่คำนวณ
-- ทดสอบบนข้อมูลสำรอง 13 พ.ย.: ผลลัพธ์ทุกตัวเลือก (7/30/90 วัน × ทุกสาย/obec/vec) ตรงกับของเดิม, เวลา 1.75 → ~0.85 วินาที

create table if not exists prep.admin_curve_cache (
  track       text primary key,            -- '' = ทุกสาย, 'obec', 'vec'
  data        jsonb not null,
  computed_at timestamptz not null default now()
);
alter table prep.admin_curve_cache enable row level security;
revoke all on prep.admin_curve_cache from public, anon, authenticated;

-- curve เดิมยกมาทั้งก้อน (ความแม่นยำของคำตอบแรก ทีละ 100 ข้อแรกที่เคยเห็น, อย่างน้อย 5 คนต่อช่วง)
create or replace function prep.admin_curve(p_track text) returns jsonb
language sql stable set search_path = '' as $$
with first_ans as (select user_id, correct, row_number() over (partition by user_id order by at, id) as rn
                from (select distinct on (l.user_id, l.question_id) l.user_id, l.correct, l.at, l.id from prep.answer_log l
                       where prep.in_track(l.user_id, p_track) order by l.user_id, l.question_id, l.at, l.id) f),
curve as (select (rn - 1) / 100 as b, count(distinct user_id) as users, round(100 * avg(correct::int)) as acc
            from first_ans where rn <= 1000 group by 1 having count(distinct user_id) >= 5)
select coalesce((select jsonb_agg(jsonb_build_object('b', b, 'users', users, 'acc', acc) order by b) from curve), '[]'::jsonb)
$$;

create or replace function prep.refresh_admin_curve() returns void
language plpgsql security definer set search_path = '' as $$
declare t text;
begin
  foreach t in array array['', 'obec', 'vec'] loop
    insert into prep.admin_curve_cache (track, data, computed_at)
    values (t, prep.admin_curve(nullif(t, '')), now())
    on conflict (track) do update set data = excluded.data, computed_at = excluded.computed_at;
  end loop;
end $$;
revoke execute on function prep.admin_curve(text) from public, anon, authenticated;
revoke execute on function prep.refresh_admin_curve() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION prep.admin_learning(p_days integer, p_track text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with rng as (select prep.today() - (least(greatest(coalesce(p_days, 30), 7), 180) - 1) as c0, prep.today() as c1),
lr as (select distinct on (r.user_id) r.user_id, r.overall, r.a as ra, r.b as rb from prep.readiness_daily r, rng
        where r.day between rng.c0 and rng.c1 and prep.in_track(r.user_id, p_track) order by r.user_id, r.day desc),
wk as (select date_trunc('week', r.day)::date as w, r.user_id, (array_agg(r.a order by r.day desc))[1] as ra, (array_agg(r.b order by r.day desc))[1] as rb
         from prep.readiness_daily r where r.day > prep.today() - 84 and prep.in_track(r.user_id, p_track) group by 1, 2),
mk as (select round(100.0 * m.score / nullif(cardinality(m.question_ids), 0)) as pct from prep.mock_attempts m, rng
        where m.submitted_at is not null and m.score is not null
          and (m.submitted_at at time zone 'Asia/Bangkok')::date between rng.c0 and rng.c1 and prep.in_track(m.user_id, p_track)),
tp as (select q.topic, t.name, sum(s.n) as n, sum(s.correct) as c,
              count(*) filter (where prep.item_suspect(q.id, q.status, q.answer, s.n, s.correct, s.choice_counts) is not null) as sus
         from prep.questions q join prep.question_stats s on s.question_id = q.id join prep.topics t on t.code = q.topic
        where q.status = 'approved' group by 1, 2 having sum(s.n) >= 100),
quota as (select mq.topic, sum(mq.n) as slots from prep.mock_quota mq
           where mq.track = coalesce(p_track, 'obec') and mq.topic <> '*MAJOR*' group by 1),
thin as (select qu.topic, t.name, qu.slots, (select count(*) from prep.questions q where q.topic = qu.topic and q.status = 'approved') as have
           from quota qu join prep.topics t on t.code = qu.topic)
select jsonb_build_object(
  'ready', (select jsonb_build_object('n', count(*), 'pass', count(*) filter (where ra >= 60 and rb >= 60),
             'pass_a', count(*) filter (where ra >= 60), 'pass_b', count(*) filter (where rb >= 60),
             'buckets', (select jsonb_agg((select count(*) from lr l2 where least(floor(l2.overall / 10), 9) = b) order by b) from generate_series(0, 9) b)) from lr),
  'ready_weeks', coalesce((select jsonb_agg(jsonb_build_object('w', w, 'n', n, 'pass', pass) order by w) from (
                   select w, count(*) as n, count(*) filter (where ra >= 60 and rb >= 60) as pass from wk group by w) x), '[]'::jsonb),
  'mock', (select jsonb_build_object('n', count(*), 'pass', count(*) filter (where pct >= 60),
            'buckets', (select jsonb_agg((select count(*) from mk m2 where least(floor(m2.pct / 10), 9) = b) order by b) from generate_series(0, 9) b)) from mk),
  'curve', coalesce((select c.data from prep.admin_curve_cache c where c.track = coalesce(p_track, '')), '[]'::jsonb),
  'curve_at', (select c.computed_at from prep.admin_curve_cache c where c.track = coalesce(p_track, '')),
  'review', jsonb_build_object(
     'due', (select count(*) from prep.review_schedule rs where rs.due_on <= prep.today() and prep.in_track(rs.user_id, p_track)),
     'overdue7', (select count(*) from prep.review_schedule rs where rs.due_on < prep.today() - 7 and prep.in_track(rs.user_id, p_track)),
     'users_due', (select count(distinct rs.user_id) from prep.review_schedule rs where rs.due_on <= prep.today() and prep.in_track(rs.user_id, p_track)),
     'users_reviewed', (select count(distinct a.user_id) from prep.attempts a join prep.sets s on s.id = a.set_id, rng
                         where s.kind = 'review_due' and (a.started_at at time zone 'Asia/Bangkok')::date between rng.c0 and rng.c1
                           and prep.in_track(a.user_id, p_track))),
  'hard', coalesce((select jsonb_agg(jsonb_build_object('topic', topic, 'name', name, 'n', n, 'pct', round(100.0 * c / n), 'suspect', sus) order by 1.0 * c / n)
                      from (select * from tp order by 1.0 * c / n limit 10) h), '[]'::jsonb),
  'bank', jsonb_build_object(
     'unseen', (select count(*) from prep.questions q left join prep.question_stats s on s.question_id = q.id
                 where q.status = 'approved' and coalesce(s.n, 0) = 0),
     'suspect', (select count(*) from prep.questions q join prep.question_stats s on s.question_id = q.id
                  where prep.item_suspect(q.id, q.status, q.answer, s.n, s.correct, s.choice_counts) is not null),
     'thin', coalesce((select jsonb_agg(jsonb_build_object('topic', topic, 'name', name, 'slots', slots, 'have', have) order by 1.0 * have / slots)
                         from (select * from thin where have < 10 * slots order by 1.0 * have / slots limit 12) t), '[]'::jsonb)))
$function$;

select prep.refresh_admin_curve();
select cron.schedule('prep-admin-curve', '17 */3 * * *', 'select prep.refresh_admin_curve()');
