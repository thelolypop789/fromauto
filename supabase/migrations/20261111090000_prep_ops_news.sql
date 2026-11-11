-- เอเจนต์ตามข่าวการสอบ/การศึกษา (เจ้าของตกลง 11 พ.ย. 69) — วิธีทำงานอยู่ใน skill sobprep-ops §6
-- แหล่ง: เว็บสาธารณะเท่านั้น (สพฐ./ศธ./ก.ค.ศ./สอศ./เขตพื้นที่ + สำนักข่าว) ไม่ท่อง Facebook; ข่าวจากกลุ่ม FB เจ้าของส่งเองด้วย "สั่ง: ข่าว ..."
-- รอบ 06:30 (เข้าสรุปเช้า) และ 17:30 (วางแผนโพสต์ 20:00); ข่าวด่วนที่กระทบผู้สอบเด้ง LINE ทันที
-- ร่างโพสต์ = ปุ่มชนิด 'post' (กด ✅ → ลงคิว prep.fb_posts); ร่างข้อสอบข่าว = A3-NEWS สถานะ review + ปุ่ม 'content'

create table prep.news_items (
  id           bigserial primary key,
  url          text not null unique,
  title        text not null,
  source       text not null,                 -- ชื่อเว็บ/หน่วยงาน
  published_at timestamptz,                   -- วันที่ในข่าว (ต้องมี — ไม่มีวันที่ = ไม่ใช้)
  summary      text not null,                 -- 1–2 บรรทัด ภาษาไทย
  kind         text not null default 'news' check (kind in ('official', 'news', 'exam_topic', 'owner')),
  urgent       boolean not null default false,
  used_for     text[] not null default '{}', -- 'digest' | 'post' | 'question'
  found_at     timestamptz not null default now()
);
create index news_items_found on prep.news_items (found_at desc);
alter table prep.news_items enable row level security;
revoke all on prep.news_items from public, anon, authenticated;

alter table prep.ops_actions drop constraint if exists ops_actions_kind_check;
alter table prep.ops_actions add constraint ops_actions_kind_check
  check (kind in ('slip', 'answer', 'hide', 'feedback', 'bot', 'broadcast', 'deploy', 'content', 'post', 'other'));

select cron.schedule('prep-ops-news-am', '30 23 * * *', $$select prep.fire_job('news')$$);   -- 06:30 ไทย
select cron.schedule('prep-ops-news-pm', '30 10 * * *', $$select prep.fire_job('news')$$);   -- 17:30 ไทย
