-- คะแนนความพร้อม (prep_readiness) ต่ำกว่าผลจริง: เทียบกับสอบจำลอง 128 ครั้ง (ไม่นับข้อที่อยู่ในชุดจำลองเอง)
-- สูตรเดิมต่ำกว่าคะแนนจำลองเฉลี่ย 14 คะแนน, ทำนายว่าผ่าน 2% ขณะที่ผ่านจริง 45%
-- ปรับ: ตอบถูกครั้งแรก 0.75 → 1.0, เคยผิดแล้วเพิ่งถูก (ยังไม่ผ่านรอบทวน) 0.25 → 0.5, prior 25% น้ำหนัก 5 → 2
--   ผล: ต่ำกว่าจริงเฉลี่ย 5.7 คะแนน, ตรงกับผลผ่าน/ไม่ผ่านของจำลอง 75% (เดิม 56%) — ยังระวังด้านต่ำไว้
-- แอดมิน → การเรียนรู้: "พร้อมสอบ" = ภาค ก ≥ 60 และ ภาค ข ≥ 60 (เกณฑ์จริงแยกภาค) แทนคะแนนรวม
-- ฟังก์ชันอื่นในไฟล์นี้คัดจากเวอร์ชันที่รันอยู่จริง เปลี่ยนเฉพาะตัวเลขข้างบน

CREATE OR REPLACE FUNCTION public.prep_readiness()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u     uuid := prep.uid();
  major text := (select p.major from prep.profiles p where p.user_id = u);
  trk   text := coalesce((select p.track from prep.profiles p where p.user_id = u), 'obec');
  base  jsonb;
  sig   jsonb;
begin
  with q as (
    select s.code as subject, s.name as subject_name, s.section, s.questions, s.sort,
           case when m.topic = '*MAJOR*' then major else m.topic end as topic, m.n as w
      from prep.mock_subjects s join prep.mock_quota m on m.subject = s.code and m.track = trk),
  -- What the user's history says about each question they have seen.
  qs as (
    select qq.topic, qq.subtopic, x.last_at,
           case when x.wrong = 0 and x.seen >= 2 then 1.0
                when x.wrong = 0 then 1.0
                when x.last_correct and rs.user_id is null then 0.8
                when x.last_correct and rs.box >= 1 then 0.7
                when x.last_correct then 0.5
                else 0 end as score
      from prep.user_question_state x
      join prep.questions qq on qq.id = x.question_id
      left join prep.review_schedule rs on rs.user_id = u and rs.question_id = x.question_id
     where x.user_id = u),
  qd as (
    select qs.*, 0.25 + (score - 0.25) * exp(-greatest(extract(epoch from now() - coalesce(last_at, now())) / 86400 - 7, 0) / 60.0) as eff
      from qs),
  e as (
    select q.subject, q.subject_name, q.section, q.questions, q.sort, q.topic, null::text as sub, tp.name as topic_name,
           q.w::numeric as w, count(qd.eff) as n, coalesce(sum(qd.eff), 0) as known, max(qd.last_at) as last_at
      from q join prep.topics tp on tp.code = q.topic
      left join qd on qd.topic = q.topic
     where not exists (select 1 from prep.subtopics x where x.topic = q.topic)
     group by q.subject, q.subject_name, q.section, q.questions, q.sort, q.topic, tp.name, q.w
    union all
    select q.subject, q.subject_name, q.section, q.questions, q.sort, q.topic, sb.code, sb.name,
           q.w * sb.weight::numeric / sum(sb.weight) over (partition by q.subject, q.topic),
           count(qd.eff), coalesce(sum(qd.eff), 0), max(qd.last_at)
      from q join prep.subtopics sb on sb.topic = q.topic
      left join qd on qd.subtopic = sb.code
     group by q.subject, q.subject_name, q.section, q.questions, q.sort, q.topic, sb.code, sb.name, q.w, sb.weight),
  t as (select e.*, (known + 0.5) / (n + 2.0) as acc from e),
  subj as (
    select subject, subject_name, section, questions, sort,
           round(100 * sum(w * acc) / sum(w), 1) as pct, sum(n)::int as n
      from t group by subject, subject_name, section, questions, sort),
  sec as (
    select section, round(sum(questions * pct) / sum(questions), 1) as pct, sum(n)::int as n
      from subj group by section),
  ranked as (
    select t.*, row_number() over (order by acc < 0.6 desc, w * (1 - acc) desc) as rk,
           row_number() over (partition by subject order by acc < 0.6 desc, w * (1 - acc) desc) as srk
      from t),
  cov as (
    select round(100 * sum(w) filter (where n >= 5 and last_at > now() - interval '14 days') / nullif(sum(w), 0)) as pct,
           count(*) filter (where n >= 5 and last_at > now() - interval '14 days') as fresh,
           count(*) filter (where n = 0) as untouched, count(*) as units
      from t)
  select jsonb_build_object(
    'has_major', major is not null,
    'answered', coalesce((select sum(n) from sec), 0),
    -- rough 95% margin of the overall score from how many questions it rests on (±50/sqrt(n)·1.96, at most 30)
    'margin', (select least(30, round(98 / sqrt(greatest(sum(n), 1)))) from sec),
    'overall', (select round(sum(s2.questions * s2.pct) / nullif(sum(s2.questions), 0), 1) from subj s2),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
               'section', sec.section, 'pct', sec.pct, 'n', sec.n,
               'subjects', (select jsonb_agg(jsonb_build_object('code', subject, 'name', subject_name, 'questions', questions,
                                                               'pct', pct, 'n', n) order by sort)
                              from subj where subj.section = sec.section))
             order by sec.section) from sec), '[]'::jsonb),
    'focus', coalesce((
      select jsonb_agg(jsonb_build_object('code', topic, 'sub', sub, 'name', topic_name, 'subject', subject_name,
                                          'w', round(w), 'pct', round(100 * acc), 'n', n) order by rk)
        from ranked where rk <= 3), '[]'::jsonb),
    'subject_focus', coalesce((
      select jsonb_object_agg(subject_name, jsonb_build_object('code', topic, 'sub', sub, 'name', topic_name))
        from ranked where srk = 1), '{}'::jsonb),
    'coverage', (select jsonb_build_object('pct', pct, 'fresh', fresh, 'untouched', untouched, 'units', units) from cov))
  into base;

  with st as (
    select x.question_id, x.wrong, x.last_correct,
           case when x.wrong = 0 and x.seen >= 2 then 1.0
                when x.wrong = 0 then 1.0
                when x.last_correct and rs.user_id is null then 0.8
                when x.last_correct and rs.box >= 1 then 0.7
                when x.last_correct then 0.5
                else 0 end as score
      from prep.user_question_state x
      left join prep.review_schedule rs on rs.user_id = u and rs.question_id = x.question_id
     where x.user_id = u),
  lg as (
    select l.*, qq.topic from prep.answer_log l join prep.questions qq on qq.id = l.question_id
     where l.user_id = u and l.at > now() - interval '30 days'),
  topic_acc as (select topic, correct::numeric / nullif(n, 0) as acc from prep.user_topic_stats where user_id = u),
  -- Correctness by position in long practice sets and submitted mocks of the last 60 days.
  pos as (
    select a.id, o.k, cardinality(a.question_ids) as size, c as ok
      from prep.attempts a, unnest(a.correct) with ordinality as o(c, k)
     where a.user_id = u and cardinality(a.question_ids) >= 20 and a.started_at > now() - interval '60 days'
       and a.answers[o.k] is not null
    union all
    select m.id, o.k, cardinality(m.question_ids), m.answers[o.k] = qq.answer
      from prep.mock_attempts m, unnest(m.question_ids) with ordinality as o(qid, k)
      join prep.questions qq on qq.id = o.qid
     where m.user_id = u and m.submitted_at is not null and m.started_at > now() - interval '60 days'
       and m.answers[o.k] is not null),
  thirds as (
    select count(distinct id) as sessions,
           avg(ok::int) filter (where k <= size / 3.0) as first_acc, count(*) filter (where k <= size / 3.0) as first_n,
           avg(ok::int) filter (where k > size * 2 / 3.0) as last_acc, count(*) filter (where k > size * 2 / 3.0) as last_n
      from pos)
  select jsonb_build_object(
    'accuracy', (select jsonb_build_object(
        'score', case when count(*) >= 20 then round(100 * avg(score)) end, 'n', count(*),
        'retained', count(*) filter (where wrong > 0 and score >= 0.7),
        'shaky', count(*) filter (where wrong > 0 and last_correct and score = 0.25)) from st),
    'speed', (select jsonb_build_object(
        'score', case when count(*) >= 15 then greatest(0, least(100, round(100 * (90000 - percentile_cont(0.5) within group (order by think_ms)) / 65000.0))) end,
        'n', count(*), 'median_s', round((percentile_cont(0.5) within group (order by think_ms) / 1000.0)::numeric, 1),
        'slow', count(*) filter (where think_ms > 90000))
        from lg where correct and think_ms is not null),
    'errors', (select jsonb_build_object(
        'score', case when count(*) filter (where wrong > 0) >= 10
                      then round(100 * (1 - count(*) filter (where wrong >= 2)::numeric / count(*) filter (where wrong > 0))) end,
        'n', count(*) filter (where wrong > 0), 'repeated', count(*) filter (where wrong >= 2),
        'guess', (select count(*) from lg where correct = false and think_ms < 8000),
        'careless', (select count(*) from lg join topic_acc ta using (topic) where lg.correct = false and coalesce(lg.think_ms, 8000) >= 8000 and ta.acc >= 0.7),
        'concept', (select count(*) from lg left join topic_acc ta using (topic) where lg.correct = false and coalesce(lg.think_ms, 8000) >= 8000 and coalesce(ta.acc, 0) < 0.7))
        from st),
    'stamina', (select jsonb_build_object(
        'score', case when sessions >= 2 and first_n >= 20 and last_n >= 20
                      then greatest(0, least(100, round(100 - greatest(0, first_acc - last_acc) * 250))) end,
        'sessions', sessions, 'first', round(100 * first_acc), 'last', round(100 * last_acc)) from thirds),
    'fix', (select jsonb_build_object(
        'score', case when count(*) filter (where wrong > 0) >= 10
                      then round(100 * count(*) filter (where wrong > 0 and last_correct)::numeric / count(*) filter (where wrong > 0)) end,
        'n', count(*) filter (where wrong > 0), 'fixed', count(*) filter (where wrong > 0 and last_correct),
        'redo', (select count(*) from prep.attempts a where a.user_id = u and a.mode = 'wrong' and a.started_at > now() - interval '30 days'),
        'dwell_s', (select round((percentile_cont(0.5) within group (order by dwell_ms) / 1000.0)::numeric, 1)
                      from lg where correct = false and dwell_ms is not null))
        from st),
    'coverage', jsonb_build_object('score', (base->'coverage'->>'pct')::numeric,
        'fresh', base->'coverage'->'fresh', 'untouched', base->'coverage'->'untouched', 'units', base->'coverage'->'units'))
  into sig;

  return base - 'coverage' || jsonb_build_object('signals', sig);
end $function$;

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
first_ans as (select user_id, correct, row_number() over (partition by user_id order by at, id) as rn
                from (select distinct on (l.user_id, l.question_id) l.user_id, l.correct, l.at, l.id from prep.answer_log l
                       where prep.in_track(l.user_id, p_track) order by l.user_id, l.question_id, l.at, l.id) f),
curve as (select (rn - 1) / 100 as b, count(distinct user_id) as users, round(100 * avg(correct::int)) as acc
            from first_ans where rn <= 1000 group by 1 having count(distinct user_id) >= 5),
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
  'curve', coalesce((select jsonb_agg(jsonb_build_object('b', b, 'users', users, 'acc', acc) order by b) from curve), '[]'::jsonb),
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
