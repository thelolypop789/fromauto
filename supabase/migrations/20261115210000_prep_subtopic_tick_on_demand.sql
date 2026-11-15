-- ตัวติดแท็กหัวข้อย่อยทำงานเฉพาะเมื่อมีข้อสอบเข้า (เจ้าของอนุมัติ 14 พ.ย. 2569)
-- เดิม prep.subtopic_tick() (cron ทุก 2 นาที) เรียก prep_ai_subtopic_pending() ซึ่งไล่ทั้งคลังทุกครั้ง (~1 วินาที/รอบ)
-- แม้ไม่มีงาน — เป็นงานเบื้องหลังที่กินฐานข้อมูลมากที่สุด
-- ตอนนี้: insert/เปลี่ยน topic ของข้อสอบ หรือเพิ่มหัวข้อย่อย → ยกธง dirty
--         tick: ไม่มีธง = จบทันที · มีธง = ทำงานเดิม · pending ว่างแล้วค่อยลดธง (ถ้ามีข้อเข้ามาระหว่างนั้น ธงยังยกอยู่)

create table if not exists prep.subtopic_queue (
  id         boolean primary key default true check (id),
  dirty      boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table prep.subtopic_queue enable row level security;
revoke all on prep.subtopic_queue from public, anon, authenticated;
-- เริ่มที่ dirty = true ให้รอบแรกเก็บข้อที่ค้างอยู่ (ข้อที่นำเข้าช่วงพัก cron)
insert into prep.subtopic_queue (id, dirty) values (true, true) on conflict (id) do update set dirty = true, updated_at = now();

create or replace function prep.subtopic_mark_dirty()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update prep.subtopic_queue set dirty = true, updated_at = now() where id and not dirty;
  return null;
end $$;
revoke execute on function prep.subtopic_mark_dirty() from public, anon, authenticated;

drop trigger if exists subtopic_mark_dirty_ins on prep.questions;
create trigger subtopic_mark_dirty_ins after insert on prep.questions
  for each statement execute function prep.subtopic_mark_dirty();
drop trigger if exists subtopic_mark_dirty_upd on prep.questions;
create trigger subtopic_mark_dirty_upd after update of topic, status on prep.questions
  for each statement execute function prep.subtopic_mark_dirty();
drop trigger if exists subtopic_mark_dirty_sub on prep.subtopics;
create trigger subtopic_mark_dirty_sub after insert on prep.subtopics
  for each statement execute function prep.subtopic_mark_dirty();

create or replace function prep.subtopic_tick()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  pending jsonb;
  r jsonb;
begin
  if not coalesce((select dirty from prep.subtopic_queue where id), true) then
    return;   -- ไม่มีข้อเข้ามาใหม่: ไม่ไล่คลัง
  end if;
  pending := public.prep_ai_subtopic_pending();
  if jsonb_array_length(pending) = 0 then
    update prep.subtopic_queue set dirty = false, updated_at = now() where id;
    return;
  end if;
  for r in select * from jsonb_array_elements(pending) limit 6 loop
    perform net.http_post(
      url := 'https://diprxrkddsqmzzihjjwi.supabase.co/functions/v1/prep-subtopic-tag',
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'subtopic_cron_secret')),
      body := jsonb_build_object('topic', r->>'topic', 'batches', 4),
      timeout_milliseconds := 120000);
  end loop;
end $$;
revoke execute on function prep.subtopic_tick() from public, anon, authenticated;
