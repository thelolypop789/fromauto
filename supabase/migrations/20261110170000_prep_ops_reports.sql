-- เอเจนต์ตรวจข้อสอบที่โดนรายงานอัตโนมัติ (เจ้าของขอ 10 พ.ย. 69)
-- รายงานใหม่รอ 10 นาที (ให้คนอื่นรายงานข้อเดียวกันรวมเป็นชุด) แล้ว ops_tick ปลุก Claude Code job 'reports' ครั้งเดียวต่อชุด
-- วิธีตัดสินอยู่ใน skill sobprep-ops §3.1; เปลี่ยนเฉลย/ข้อกำกวม ยังต้องให้เจ้าของกดอนุมัติ
alter table prep.reports add column if not exists ops_queued_at timestamptz;
-- รายงานเก่าที่ยังเปิดอยู่ปล่อยให้งานตรวจคืนละ 100 ข้อ (job quality) หยิบไป ไม่ปลุกย้อนหลัง
update prep.reports set ops_queued_at = now() where status = 'open' and ops_queued_at is null;
create index if not exists reports_ops_queue on prep.reports (created_at) where status = 'open' and ops_queued_at is null;

create or replace function prep.ops_tick() returns void
language plpgsql security definer set search_path = '' as $$
declare o record; n int;
begin
  for o in select id from prep.orders
            where status = 'pending' and slip_checked_at is null
              and created_at < now() - interval '5 minutes' and created_at > now() - interval '2 days'
            order by id limit 5 loop
    perform prep.ops_call(jsonb_build_object('action', 'slip_check', 'order_id', o.id));
  end loop;
  if exists (select 1 from prep.ops_actions where status = 'pending' and kind = 'slip' and reminded_at is null
                and created_at < now() - interval '3 hours') then
    perform prep.ops_call(jsonb_build_object('action', 'remind'));
  end if;
  -- รายงานข้อสอบ: ไม่ปลุกซ้อนถ้างาน reports รอบก่อนยังไม่เสร็จ (เกิน 1 ชม. ถือว่าค้าง ปลุกใหม่ได้)
  if not exists (select 1 from prep.owner_commands where kind = 'job' and body = 'reports' and status in ('queued', 'fired')
                    and created_at > now() - interval '1 hour') then
    update prep.reports set ops_queued_at = now()
     where status = 'open' and ops_queued_at is null and created_at < now() - interval '10 minutes';
    get diagnostics n = row_count;
    if n > 0 then perform prep.fire_job('reports'); end if;
  end if;
end $$;
revoke execute on function prep.ops_tick() from public;
