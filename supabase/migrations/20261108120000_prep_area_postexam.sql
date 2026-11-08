-- หลังสอบข้อเขียน ครูผู้ช่วย 2569 (สอบ 14–15 พ.ย. · ประกาศผู้ผ่าน ภาค ก/ข ภายใน 18 พ.ย.)
-- 1) สำรวจ "ลงสอบเขตไหน": สังกัด (สพป./สพม./ศึกษาพิเศษ/อาชีวะ) + จังหวัด + เขตที่ เก็บใน prep.profiles
--    ผู้ใช้เห็นจำนวนคนในแอปที่ลงเขตเดียวกัน (และเอกเดียวกัน) เมื่อมีอย่างน้อย 5 คน
-- 2) "ข้อสอบจริงออกเรื่องไหน" (prep.exam_recaps): เปิดตั้งแต่ 17:00 ของวันสอบวันสุดท้าย จนถึงวันประกาศผล
--    ผู้ใช้ติ๊กหมวดที่ออก/ไม่ออก + ความยาก + เล่ารายละเอียด (แอดมินอ่านคนเดียว); แอดมินเขียนสรุปเองได้ (prep.exam_recap_notes)
-- 3) ถามผลสอบหลังวันประกาศผล (แทนการถามตั้งแต่วันรุ่งขึ้นหลังสอบ) + ถามว่าจะสอบอะไรต่อ (next_exams)
-- 4) ปฏิทิน: ประกาศผู้ผ่าน ภาค ก/ข ภายใน 18 พ.ย. (เดิมใส่ 30 พ.ย.) + ประเมินภาค ค ภายใน 30 พ.ย.
-- ทุกฟังก์ชันไม่เปิดให้ anon เรียก

-- ---------- 1) เขตที่ลงสอบ ----------
alter table prep.profiles add column if not exists area_kind text check (area_kind in ('spp', 'spm', 'sped', 'vec', 'none'));
alter table prep.profiles add column if not exists area_province text;
alter table prep.profiles add column if not exists area_zone smallint check (area_zone between 1 and 9);
alter table prep.profiles add column if not exists area_set_at timestamptz;
alter table prep.profiles add column if not exists area_snooze_until timestamptz;
create index if not exists profiles_area on prep.profiles (area_kind, area_province, area_zone) where area_kind is not null;

create or replace function prep.provinces() returns text[]
language sql immutable set search_path = '' as $$
  select array['กรุงเทพมหานคร','กระบี่','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร','ขอนแก่น','จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท',
    'ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่','ตรัง','ตราด','ตาก','นครนายก','นครปฐม','นครพนม','นครราชสีมา','นครศรีธรรมราช',
    'นครสวรรค์','นนทบุรี','นราธิวาส','น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี','ประจวบคีรีขันธ์','ปราจีนบุรี','ปัตตานี',
    'พระนครศรีอยุธยา','พะเยา','พังงา','พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์','แพร่','ภูเก็ต','มหาสารคาม',
    'มุกดาหาร','แม่ฮ่องสอน','ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง','ราชบุรี','ลพบุรี','ลำปาง','ลำพูน','เลย','ศรีสะเกษ',
    'สกลนคร','สงขลา','สตูล','สมุทรปราการ','สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี','สุโขทัย','สุพรรณบุรี',
    'สุราษฎร์ธานี','สุรินทร์','หนองคาย','หนองบัวลำภู','อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์','อุทัยธานี','อุบลราชธานี']
$$;

-- ชื่อที่แสดง เช่น "สพป.หนองคาย เขต 1", "สพม.หนองคาย", "ศึกษาพิเศษ · หนองคาย", "อาชีวะ · หนองคาย"
create or replace function prep.area_label(k text, p text, z smallint) returns text
language sql immutable set search_path = '' as $$
  select case k
    when 'spp'  then 'สพป.' || p || coalesce(' เขต ' || z, '')
    when 'spm'  then 'สพม.' || p || coalesce(' เขต ' || z, '')
    when 'sped' then 'ศึกษาพิเศษ · ' || p
    when 'vec'  then 'อาชีวะ · ' || p
    when 'none' then 'ไม่ได้สมัครรอบนี้'
  end
$$;

-- เขตของฉัน + จำนวนคนในแอปที่ลงเขตเดียวกัน (ซ่อนตัวเลขถ้าน้อยกว่า 5 คน) + ควรถามไหม
create or replace function public.prep_my_area() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  u uuid := prep.uid();
  p prep.profiles;
  same int; same_major int;
begin
  if u is null then raise exception 'not_authenticated'; end if;
  select * into p from prep.profiles where user_id = u;
  if p.user_id is null then return null; end if;
  if p.area_kind is null or p.area_kind = 'none' then
    return jsonb_build_object('kind', p.area_kind, 'label', prep.area_label(p.area_kind, p.area_province, p.area_zone),
      'ask', p.area_kind is null and (p.area_snooze_until is null or p.area_snooze_until < now()));
  end if;
  select count(*), count(*) filter (where x.major is not distinct from p.major and p.major is not null)
    into same, same_major
    from prep.profiles x
   where x.area_kind = p.area_kind and x.area_province = p.area_province and x.area_zone is not distinct from p.area_zone;
  return jsonb_build_object('kind', p.area_kind, 'province', p.area_province, 'zone', p.area_zone,
    'label', prep.area_label(p.area_kind, p.area_province, p.area_zone), 'ask', false,
    'same', case when same >= 5 then same end,
    'same_major', case when same_major >= 5 then same_major end);
end $$;

create or replace function public.prep_set_area(p_kind text, p_province text default null, p_zone int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.uid();
begin
  if u is null then raise exception 'not_authenticated'; end if;
  if p_kind = 'none' then
    update prep.profiles set area_kind = 'none', area_province = null, area_zone = null, area_set_at = now() where user_id = u;
    return public.prep_my_area();
  end if;
  if p_kind not in ('spp', 'spm', 'sped', 'vec') or p_province is null or not (p_province = any (prep.provinces())) then
    raise exception 'bad_area';
  end if;
  -- สพป. ต้องมีเขต (กทม. ไม่มี สพป.) · สพม. มีเขตเฉพาะ กทม. (1–2) · ศึกษาพิเศษ/อาชีวะ ใช้จังหวัดอย่างเดียว
  if p_kind = 'spp' and (p_province = 'กรุงเทพมหานคร' or p_zone is null or p_zone not between 1 and 9) then raise exception 'bad_area'; end if;
  if p_kind = 'spm' and p_province = 'กรุงเทพมหานคร' and (p_zone is null or p_zone not between 1 and 2) then raise exception 'bad_area'; end if;
  if p_kind = 'spm' and p_province <> 'กรุงเทพมหานคร' then p_zone := null; end if;
  if p_kind in ('sped', 'vec') then p_zone := null; end if;
  update prep.profiles set area_kind = p_kind, area_province = p_province, area_zone = p_zone, area_set_at = now() where user_id = u;
  return public.prep_my_area();
end $$;

-- "ไว้ทีหลัง": ไม่ถามอีก 3 วัน
create or replace function public.prep_snooze_area() returns void
language sql security definer set search_path = '' as $$
  update prep.profiles set area_snooze_until = now() + interval '3 days' where user_id = prep.uid()
$$;

-- แอดมิน: จำนวนคนต่อเขต (มีแพ็ก/ไม่มี) + เอกที่มากที่สุด 3 อันดับ
create or replace function public.prep_admin_area_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return jsonb_build_object(
    'answered', (select count(*) from prep.profiles where area_kind is not null),
    'none',     (select count(*) from prep.profiles where area_kind = 'none'),
    'snoozed',  (select count(*) from prep.profiles where area_kind is null and area_snooze_until is not null),
    'rows', coalesce((select jsonb_agg(r order by r.n desc, r.label) from (
      select prep.area_label(p.area_kind, p.area_province, p.area_zone) as label, p.area_kind as kind, p.area_province as province,
             count(*) n,
             count(*) filter (where cardinality(prep.active_packages(p.user_id)) > 0) paid,
             (select jsonb_agg(m) from (
                select coalesce(t.name, 'ยังไม่เลือกเอก') name, count(*) n from prep.profiles q left join prep.topics t on t.code = q.major
                 where q.area_kind = p.area_kind and q.area_province = p.area_province and q.area_zone is not distinct from p.area_zone
                 group by 1 order by 2 desc limit 3) m) majors
        from prep.profiles p
       where p.area_kind is not null and p.area_kind <> 'none'
       group by p.area_kind, p.area_province, p.area_zone) r), '[]'::jsonb));
end $$;

-- ---------- 2) ข้อสอบจริงออกเรื่องไหน ----------
create table if not exists prep.exam_recaps (
  user_id    uuid not null references auth.users(id) on delete cascade,
  event_id   int  not null references prep.exam_events(id) on delete cascade,
  topics     jsonb not null default '{}'::jsonb,    -- {"A1-QUANT-SERIES": "y" | "n", ...}
  difficulty jsonb not null default '{}'::jsonb,    -- {"A": 1..5, "B": 1..5, "M": 1..5}
  note       text check (note is null or length(note) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
alter table prep.exam_recaps enable row level security;
revoke all on prep.exam_recaps from public, anon, authenticated;

-- สรุปที่แอดมินเขียนเอง (ทั้งภาพรวม topic = null หรือรายหมวด) แสดงคู่กับผลโหวต
create table if not exists prep.exam_recap_notes (
  id         int generated always as identity primary key,
  event_id   int  not null references prep.exam_events(id) on delete cascade,
  topic      text references prep.topics(code) on delete cascade,
  body       text not null check (length(body) between 1 and 2000),
  published  boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table prep.exam_recap_notes enable row level security;
revoke all on prep.exam_recap_notes from public, anon, authenticated;

-- วันสอบที่เพิ่งผ่าน (ไม่เกิน 45 วัน) และวันประกาศผลของมัน
-- "ผ่าน" = เลย 17:00 ของวันสอบแล้ว; ถ้ายังมีวันสอบที่ยังไม่ถึง 17:00 ภายใน 3 วัน (สอบ 2 วันติด) ให้รอครบก่อน
create or replace function prep.recent_exam() returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  ev  prep.exam_events;
  res prep.exam_events;
  t   date := prep.today();
  done_at timestamptz;
begin
  select * into ev from prep.exam_events
   where published and kind = 'exam'
     and (coalesce(ends_on, starts_on) + time '17:00') at time zone 'Asia/Bangkok' <= now()
     and coalesce(ends_on, starts_on) >= t - 45
   order by coalesce(ends_on, starts_on) desc, id desc limit 1;
  if ev.id is null then return null; end if;
  if exists (select 1 from prep.exam_events where published and kind = 'exam' and starts_on <= t + 3
               and (coalesce(ends_on, starts_on) + time '17:00') at time zone 'Asia/Bangkok' > now()) then return null; end if;
  done_at := (coalesce(ev.ends_on, ev.starts_on) + time '17:00') at time zone 'Asia/Bangkok';
  select * into res from prep.exam_events
   where published and kind = 'result' and starts_on >= coalesce(ev.ends_on, ev.starts_on)
   order by starts_on, id limit 1;
  return jsonb_build_object('event_id', ev.id, 'exam_on', coalesce(ev.ends_on, ev.starts_on), 'done_at', done_at,
    'result_on', res.starts_on, 'result_title', res.title,
    -- หลังวันประกาศผล (ถ้าไม่ได้ใส่วันประกาศผล: 3 วันหลังสอบ) → ถามผลสอบ
    'phase', case when (res.id is not null and res.starts_on <= t) or (res.id is null and t > coalesce(ev.ends_on, ev.starts_on) + 3)
                  then 'result' else 'recap' end);
end $$;

-- ข้อมูลหน้า "ข้อสอบจริงออกเรื่องไหน": หมวดของ track ฉัน + เอกของฉัน, คำตอบของฉัน, ผลรวมทุกคน, สรุปของแอดมิน
create or replace function public.prep_recap_get() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  u   uuid := prep.uid();
  ex  jsonb := prep.recent_exam();
  ev  int;
  p   prep.profiles;
  mine prep.exam_recaps;
begin
  if u is null then raise exception 'not_authenticated'; end if;
  if ex is null then return null; end if;
  ev := (ex->>'event_id')::int;
  select * into p from prep.profiles where user_id = u;
  select * into mine from prep.exam_recaps where user_id = u and event_id = ev;
  return jsonb_build_object(
    'event_id', ev, 'phase', ex->>'phase', 'result_on', ex->>'result_on',
    'topics', coalesce((select jsonb_agg(jsonb_build_object('code', t.code, 'name', t.name, 'section', t.section, 'grp', t.grp) order by t.sort, t.code)
                 from prep.topics t
                where t.section in ('A', 'B') and t.grp <> 'B3' and (t.track is null or t.track = coalesce(p.track, 'obec'))), '[]'::jsonb),
    'major', (select jsonb_build_object('code', t.code, 'name', t.name) from prep.topics t where t.code = p.major),
    'mine', case when mine.user_id is null then null
                 else jsonb_build_object('topics', mine.topics, 'difficulty', mine.difficulty, 'note', mine.note) end,
    'responders', (select count(*) from prep.exam_recaps where event_id = ev),
    'votes', coalesce((select jsonb_object_agg(k, jsonb_build_object('y', y, 'n', n)) from (
                select e.key k, count(*) filter (where e.value = '"y"') y, count(*) filter (where e.value = '"n"') n
                  from prep.exam_recaps r, jsonb_each(r.topics) e where r.event_id = ev group by e.key) v), '{}'::jsonb),
    'difficulty', (select jsonb_build_object('A', round(avg((difficulty->>'A')::numeric), 1), 'B', round(avg((difficulty->>'B')::numeric), 1))
              from prep.exam_recaps r where r.event_id = ev),
    -- ความยากวิชาเอก: เฉลี่ยเฉพาะคนเอกเดียวกัน
    'difficulty_major', (select round(avg((r.difficulty->>'M')::numeric), 1) from prep.exam_recaps r join prep.profiles q on q.user_id = r.user_id
                          where r.event_id = ev and q.major = p.major),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'topic', n.topic, 'body', n.body) order by n.topic nulls first, n.id)
                 from prep.exam_recap_notes n where n.event_id = ev and n.published), '[]'::jsonb));
end $$;

create or replace function public.prep_recap_save(p_event int, p_topics jsonb, p_difficulty jsonb, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  u  uuid := prep.uid();
  ex jsonb := prep.recent_exam();
begin
  if u is null then raise exception 'not_authenticated'; end if;
  if ex is null or (ex->>'event_id')::int <> p_event then raise exception 'recap_closed'; end if;
  if jsonb_typeof(p_topics) <> 'object' or jsonb_typeof(p_difficulty) <> 'object'
     or exists (select 1 from jsonb_each(p_topics) e where e.value not in ('"y"', '"n"')
                   or not exists (select 1 from prep.topics t where t.code = e.key and t.section in ('A', 'B')))
     or exists (select 1 from jsonb_each(p_difficulty) e where e.key not in ('A', 'B', 'M')
                   or jsonb_typeof(e.value) <> 'number' or (e.value)::text::int not between 1 and 5) then
    raise exception 'bad_recap';
  end if;
  insert into prep.exam_recaps (user_id, event_id, topics, difficulty, note)
  values (u, p_event, p_topics, p_difficulty, nullif(left(btrim(coalesce(p_note, '')), 2000), ''))
  on conflict (user_id, event_id) do update
    set topics = excluded.topics, difficulty = excluded.difficulty, note = excluded.note, updated_at = now();
end $$;

-- ---------- 3) ผลสอบ + จะสอบอะไรต่อ ----------
alter table prep.exam_outcomes drop constraint if exists exam_outcomes_result_check;
alter table prep.exam_outcomes add constraint exam_outcomes_result_check check (result in ('pass', 'unsure', 'fail', 'absent'));
alter table prep.exam_outcomes add column if not exists next_exams text[];

create or replace function public.prep_exam_followup() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  u  uuid := prep.uid();
  ex jsonb := prep.recent_exam();
  ev int;
  o  prep.exam_outcomes;
begin
  if ex is null then return null; end if;
  ev := (ex->>'event_id')::int;
  select * into o from prep.exam_outcomes where user_id = u and event_id = ev;
  return jsonb_build_object('event_id', ev, 'phase', ex->>'phase', 'result_on', ex->>'result_on', 'result_title', ex->>'result_title',
    'recap_done', exists (select 1 from prep.exam_recaps r where r.user_id = u and r.event_id = ev),
    'result', o.result, 'next_exams', o.next_exams,
    'ask', ex->>'phase' = 'result' and (o.result is null or (o.result = 'unsure' and o.updated_at < now() - interval '14 days')));
end $$;

create or replace function public.prep_set_exam_outcome(p_event int, p_result text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.uid();
begin
  if p_result not in ('pass', 'unsure', 'fail', 'absent') then raise exception 'bad_choice'; end if;
  if not exists (select 1 from prep.exam_events where id = p_event and published and kind = 'exam') then raise exception 'not_found'; end if;
  insert into prep.exam_outcomes (user_id, event_id, result) values (u, p_event, p_result)
  on conflict (user_id, event_id) do update set result = excluded.result, updated_at = now();
end $$;

create or replace function public.prep_set_next_exams(p_event int, p_list text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.uid();
begin
  if p_list is null or cardinality(p_list) > 6
     or exists (select 1 from unnest(p_list) x where x not in ('next', 'local', 'bkk', 'ocsc', 'other', 'done')) then
    raise exception 'bad_choice';
  end if;
  update prep.exam_outcomes set next_exams = (select array_agg(distinct x) from unnest(p_list) x)
   where user_id = u and event_id = p_event;
  if not found then raise exception 'not_found'; end if;
end $$;

-- ---------- แอดมิน: ภาพรวมหลังสอบ ----------
create or replace function public.prep_admin_postexam() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  ev int;
begin
  perform prep.require_admin();
  -- วันสอบที่ล่าสุดแล้ว (แอดมินดูได้ตลอด แม้หน้าโหวตจะยังไม่เปิดหรือปิดไปแล้ว)
  select id into ev from prep.exam_events where published and kind = 'exam' and starts_on <= prep.today() + 7
   order by coalesce(ends_on, starts_on) desc, id desc limit 1;
  if ev is null then return null; end if;
  return jsonb_build_object(
    'event_id', ev, 'exam', prep.recent_exam(),
    'responders', (select count(*) from prep.exam_recaps where event_id = ev),
    'votes', coalesce((select jsonb_agg(v order by v.y desc) from (
        select e.key code, t.name, t.section, count(*) filter (where e.value = '"y"') y, count(*) filter (where e.value = '"n"') n
          from prep.exam_recaps r cross join jsonb_each(r.topics) e left join prep.topics t on t.code = e.key
         where r.event_id = ev group by e.key, t.name, t.section) v), '[]'::jsonb),
    'difficulty', (select jsonb_build_object('A', round(avg((difficulty->>'A')::numeric), 2), 'B', round(avg((difficulty->>'B')::numeric), 2),
                     'M', round(avg((difficulty->>'M')::numeric), 2)) from prep.exam_recaps where event_id = ev),
    'stories', coalesce((select jsonb_agg(s order by s.updated_at desc) from (
        select r.note, r.updated_at, u.email, t.name major
          from prep.exam_recaps r join auth.users u on u.id = r.user_id
          left join prep.profiles p on p.user_id = r.user_id left join prep.topics t on t.code = p.major
         where r.event_id = ev and r.note is not null limit 300) s), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'topic', n.topic, 'body', n.body, 'published', n.published) order by n.topic nulls first, n.id)
                 from prep.exam_recap_notes n where n.event_id = ev), '[]'::jsonb),
    'outcomes', (select jsonb_build_object(
        'pass', count(*) filter (where result = 'pass'), 'fail', count(*) filter (where result = 'fail'),
        'absent', count(*) filter (where result = 'absent'), 'unsure', count(*) filter (where result = 'unsure'))
      from prep.exam_outcomes where event_id = ev),
    'next', coalesce((select jsonb_object_agg(x, n) from (
        select x, count(*) n from prep.exam_outcomes o, unnest(o.next_exams) x where o.event_id = ev group by x) z), '{}'::jsonb));
end $$;

create or replace function public.prep_admin_recap_note_save(p_id int, p_event int, p_topic text, p_body text, p_published boolean) returns int
language plpgsql security definer set search_path = '' as $$
declare a uuid := prep.require_admin(); r int;
begin
  if p_topic is not null and not exists (select 1 from prep.topics where code = p_topic) then raise exception 'not_found'; end if;
  if p_id is null then
    insert into prep.exam_recap_notes (event_id, topic, body, published, created_by)
    values (p_event, p_topic, btrim(p_body), coalesce(p_published, true), a) returning id into r;
  else
    update prep.exam_recap_notes set topic = p_topic, body = btrim(p_body), published = coalesce(p_published, true)
     where id = p_id returning id into r;
    if r is null then raise exception 'not_found'; end if;
  end if;
  return r;
end $$;

create or replace function public.prep_admin_recap_note_delete(p_id int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  delete from prep.exam_recap_notes where id = p_id;
end $$;

-- ---------- 4) ปฏิทินตามประกาศ สพฐ. (กำหนดการสอบครูผู้ช่วย ปี 2569) ----------
update prep.exam_events set title = 'ประกาศรายชื่อผู้ผ่าน ภาค ก และ ภาค ข (มีสิทธิ์ประเมิน ภาค ค)', starts_on = date '2026-11-18',
       note = 'ภายในวันพุธที่ 18 พฤศจิกายน 2569 อาจประกาศก่อนหน้านั้น'
 where kind = 'result' and starts_on = date '2026-11-30' and title = 'ประกาศผลสอบ ภาค ก และ ภาค ข';
insert into prep.exam_events (title, kind, starts_on, ends_on, note)
select 'ประเมิน ภาค ค (สัมภาษณ์ แฟ้มสะสมงาน การนำเสนอ)', 'other', date '2026-11-19', date '2026-11-30',
       'ตามวันและเวลาที่ อ.ก.ค.ศ. เขตพื้นที่การศึกษา หรือ อ.ก.ค.ศ. สำนักบริหารงานการศึกษาพิเศษ กำหนด ให้แล้วเสร็จภายในวันที่ 30 พฤศจิกายน 2569'
 where not exists (select 1 from prep.exam_events where title like 'ประเมิน ภาค ค%' and starts_on >= date '2026-11-01');

-- ---------- สิทธิ์ ----------
revoke execute on function prep.provinces() from public;
revoke execute on function prep.area_label(text, text, smallint) from public;
revoke execute on function prep.recent_exam() from public;
do $$
declare f text;
begin
  foreach f in array array[
    'public.prep_my_area()', 'public.prep_set_area(text,text,integer)', 'public.prep_snooze_area()', 'public.prep_admin_area_stats()',
    'public.prep_recap_get()', 'public.prep_recap_save(integer,jsonb,jsonb,text)', 'public.prep_exam_followup()',
    'public.prep_set_exam_outcome(integer,text)', 'public.prep_set_next_exams(integer,text[])', 'public.prep_admin_postexam()',
    'public.prep_admin_recap_note_save(integer,integer,text,text,boolean)', 'public.prep_admin_recap_note_delete(integer)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
