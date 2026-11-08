-- แพ็กซื้อขาด (term = 'lifetime') ขายถึงสิ้นวันเสาร์ที่ 15 พ.ย. 2569 (23:59 น. เวลาไทย) เท่านั้น
-- หลังจากนั้นปิดรับคำสั่งซื้อแบบซื้อขาดทุกช่องทาง (ซื้อเดี่ยว / อัปเกรด / ซื้อกลุ่ม) ที่ตาราง prep.orders
-- คำสั่งซื้อที่ส่งก่อนเวลาปิดยังอนุมัติได้ตามปกติ และผู้ที่ซื้อไว้แล้วใช้ได้ตลอดเหมือนเดิม (ไม่แตะ prep.user_packages)
create or replace function prep.lifetime_cutoff() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.term = 'lifetime' and now() >= timestamptz '2026-11-16 00:00:00+07' then
    raise exception 'lifetime_closed';
  end if;
  return new;
end $$;
revoke execute on function prep.lifetime_cutoff() from public;

drop trigger if exists orders_lifetime_cutoff on prep.orders;
create trigger orders_lifetime_cutoff before insert on prep.orders
  for each row execute function prep.lifetime_cutoff();
