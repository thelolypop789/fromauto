-- โควตา push ของ LINE OA (แพ็กฟรี 300 ข้อความ/เดือน) หมดเมื่อ 11 พ.ย. 69 → เจ้าของเลือกใช้ "ตอบกลับ" (ไม่กินโควตา)
--  * ข้อความถึงเจ้าของที่ push ไม่สำเร็จ เก็บใน prep.ops_outbox
--  * เจ้าของพิมพ์ "งานค้าง" ใน LINE → prep_ops_pending: ข้อความค้าง + เรื่องรออนุมัติ (ปุ่มที่แสดงต่ออายุ 24 ชม. นับจากตอนแสดง)
create table prep.ops_outbox (
  id           bigserial primary key,
  text         text not null,
  created_at   timestamptz not null default now(),
  delivered_at timestamptz
);
create index ops_outbox_open on prep.ops_outbox (created_at) where delivered_at is null;
alter table prep.ops_outbox enable row level security;
revoke all on prep.ops_outbox from public, anon, authenticated;

create or replace function public.prep_ops_outbox_add(p_text text) returns void
language sql security definer set search_path = '' as $$
  insert into prep.ops_outbox (text) values (left(p_text, 4900));
$$;

-- คืน {outbox: [ข้อความ...], actions: [{id,kind,title,token,detail}], more: N} แล้วตั้ง outbox ว่าส่งแล้ว
create or replace function public.prep_ops_pending(p_line text, p_limit int default 4) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare ob jsonb; acts jsonb; total int;
begin
  if not exists (select 1 from prep.ops_owners where line_user_id = p_line) then return jsonb_build_object('error', 'not_owner'); end if;
  with o as (
    update prep.ops_outbox set delivered_at = now()
     where id in (select id from prep.ops_outbox where delivered_at is null order by id desc limit 10)
    returning id, text, created_at)
  select coalesce(jsonb_agg(jsonb_build_object('text', text, 'at', created_at) order by id), '[]'::jsonb) into ob from o;
  delete from prep.ops_outbox where delivered_at is null and created_at < now() - interval '3 days';   -- เก่าเกินไม่มีประโยชน์

  -- เรื่องที่ยังรอ: สลิปที่ออเดอร์ยัง pending มาก่อน แล้วเรื่องอื่นเรียงเก่าก่อน; สลิปที่อนุมัติในแอปไปแล้วไม่แสดง
  select count(*) into total from prep.ops_actions a
   where a.status = 'pending'
     and (a.kind <> 'slip' or exists (select 1 from prep.orders o where o.id = a.ref::int and o.status = 'pending'));
  with pick as (
    select a.id from prep.ops_actions a
     where a.status = 'pending'
       and (a.kind <> 'slip' or exists (select 1 from prep.orders o where o.id = a.ref::int and o.status = 'pending'))
     order by (a.kind = 'slip') desc, a.created_at
     limit greatest(1, least(coalesce(p_limit, 4), 4))),
  upd as (
    update prep.ops_actions a set expires_at = greatest(a.expires_at, now() + interval '24 hours')
     where a.id in (select id from pick)
    returning a.id, a.kind, a.title, a.token, a.detail, a.created_at)
  select coalesce(jsonb_agg(to_jsonb(upd) order by (kind = 'slip') desc, created_at), '[]'::jsonb) into acts from upd;
  return jsonb_build_object('outbox', ob, 'actions', acts, 'total', total);
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.prep_ops_outbox_add(text)', 'public.prep_ops_pending(text,integer)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
