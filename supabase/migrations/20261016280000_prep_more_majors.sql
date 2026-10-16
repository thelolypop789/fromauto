-- Majors that were missing from the picker: ภาษาญี่ปุ่น, ภาษาเกาหลี, ดนตรีไทย (B3-MUSIC stays as the general/ดนตรีสากล major).
insert into prep.topics (code, section, grp, name, sort) values
  ('B3-JPN',     'B', 'B3', 'ภาษาญี่ปุ่น', 104),
  ('B3-KOR',     'B', 'B3', 'ภาษาเกาหลี',  105),
  ('B3-MUSICTH', 'B', 'B3', 'ดนตรีไทย',    106)
on conflict (code) do nothing;
