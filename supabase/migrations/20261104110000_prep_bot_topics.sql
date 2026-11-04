-- บอท LINE / แชทในแอป (prep-line-bot) ต้องรู้จำนวนข้อสอบรายวิชาเอก
-- เดิมเรียก prep_topics() ซึ่งต้องมีผู้ใช้ล็อกอิน (prep.uid() → not_authenticated) บอทเรียกด้วย service role จึงได้ error
-- แล้วตอบว่า "ดูจำนวนในแอป" ทุกครั้ง → ฟังก์ชันใหม่สำหรับ service role เท่านั้น คืนทุกสาย (สพฐ./สอศ.) พร้อม track
create or replace function public.prep_bot_topics()
returns table(code text, section text, grp text, name text, track text, available integer)
language sql stable security definer set search_path to '' as $$
  select t.code, t.section, t.grp, t.name, t.track,
         (select count(*)::int from prep.questions q where q.topic = t.code and q.status = 'approved')
    from prep.topics t
   order by t.sort
$$;
revoke all on function public.prep_bot_topics() from public, anon, authenticated;
grant execute on function public.prep_bot_topics() to service_role;
