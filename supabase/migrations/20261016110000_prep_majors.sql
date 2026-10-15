-- วิชาเอก (major subjects) for ภาค ข: a new topic group B3, each major is one topic.
-- Users pick their own major; admins can add majors. Additive only (new rows, one nullable column, new functions).

insert into prep.topics (code, section, grp, name, sort) values
  ('B3-THAI',    'B', 'B3', 'ภาษาไทย',                 80),
  ('B3-MATH',    'B', 'B3', 'คณิตศาสตร์',               81),
  ('B3-SCI',     'B', 'B3', 'วิทยาศาสตร์ทั่วไป',          82),
  ('B3-PHYS',    'B', 'B3', 'ฟิสิกส์',                  83),
  ('B3-CHEM',    'B', 'B3', 'เคมี',                    84),
  ('B3-BIO',     'B', 'B3', 'ชีววิทยา',                 85),
  ('B3-ENG',     'B', 'B3', 'ภาษาอังกฤษ',               86),
  ('B3-CHN',     'B', 'B3', 'ภาษาจีน',                  87),
  ('B3-SOC',     'B', 'B3', 'สังคมศึกษา',               88),
  ('B3-HEALTH',  'B', 'B3', 'สุขศึกษา',                 89),
  ('B3-PE',      'B', 'B3', 'พลศึกษา',                  90),
  ('B3-ART',     'B', 'B3', 'ศิลปศึกษา',                91),
  ('B3-MUSIC',   'B', 'B3', 'ดนตรี',                    92),
  ('B3-DANCE',   'B', 'B3', 'นาฏศิลป์',                 93),
  ('B3-COMP',    'B', 'B3', 'คอมพิวเตอร์',              94),
  ('B3-PRIMARY', 'B', 'B3', 'การประถมศึกษา',            95),
  ('B3-EARLY',   'B', 'B3', 'การศึกษาปฐมวัย',           96),
  ('B3-SPED',    'B', 'B3', 'การศึกษาพิเศษ',            97),
  ('B3-GUIDE',   'B', 'B3', 'แนะแนว',                   98),
  ('B3-AGRI',    'B', 'B3', 'เกษตรกรรม',                99),
  ('B3-HOMEEC',  'B', 'B3', 'คหกรรม',                  100),
  ('B3-INDART',  'B', 'B3', 'อุตสาหกรรมศิลป์',          101),
  ('B3-BUS',     'B', 'B3', 'ธุรกิจและพาณิชยกรรม',      102),
  ('B3-LIB',     'B', 'B3', 'บรรณารักษ์',               103)
on conflict (code) do nothing;

alter table prep.profiles add column if not exists major text references prep.topics(code) on delete set null;

-- The caller's own settings (currently their major).
create function public.prep_profile() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p prep.profiles := prep.lock_profile(prep.uid());
begin
  return jsonb_build_object('major', p.major,
    'major_name', (select name from prep.topics where code = p.major));
end $$;

create function public.prep_set_major(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.uid();
begin
  if p_code is not null and not exists (select 1 from prep.topics where code = p_code and grp = 'B3') then
    raise exception 'invalid_topic';
  end if;
  perform prep.lock_profile(u);
  update prep.profiles set major = p_code where user_id = u;
end $$;

-- Admin: add a major that is not in the list yet. Returns the new topic code.
create function public.prep_admin_add_major(p_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  n    text := trim(coalesce(p_name, ''));
  v_code text;
begin
  perform prep.require_admin();
  if length(n) < 2 then raise exception 'invalid_topic'; end if;
  select t.code into v_code from prep.topics t where t.grp = 'B3' and t.name = n;
  if v_code is not null then return v_code; end if;
  v_code := 'B3-X' || upper(substr(md5(n), 1, 6));
  insert into prep.topics (code, section, grp, name, sort)
  values (v_code, 'B', 'B3', n, coalesce((select max(sort) from prep.topics where grp = 'B3'), 79) + 1);
  return v_code;
end $$;

do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('prep_profile', 'prep_set_major', 'prep_admin_add_major') loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
