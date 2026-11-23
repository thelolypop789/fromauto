-- "งานค้าง" ใน LINE: โพสต์เพจรายวันที่รออนุมัติขึ้นก่อนเรื่องอื่น (หลังสลิป) ใหม่ก่อน
-- เหตุ: เรื่องค้างเก่าเป็นร้อย (ซ่อนข้อ ฯลฯ) ดันโพสต์ของวันนี้ตกไปหลัง limit 4 และโควตา push LINE เต็มบ่อย
-- คำขออนุมัติโพสต์ที่ผูก fb_post_id แต่ร่างนั้นไม่ใช่ draft แล้ว (อนุมัติ/ยกเลิกในหน้าแอดมิน) ไม่นับและไม่แสดง
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
  delete from prep.ops_outbox where delivered_at is null and created_at < now() - interval '3 days';

  with live as (
    select a.id, a.kind, a.created_at,
           (a.kind = 'post' and a.detail ? 'fb_post_id') as daily
      from prep.ops_actions a
     where a.status = 'pending'
       and (a.kind <> 'slip' or exists (select 1 from prep.orders o where o.id = a.ref::int and o.status = 'pending'))
       and (a.kind <> 'post' or not (a.detail ? 'fb_post_id')
            or exists (select 1 from prep.fb_posts p where p.id = (a.detail->>'fb_post_id')::int and p.status = 'draft'))),
  pick as (
    select id from live
     order by (kind = 'slip') desc, daily desc, case when daily then created_at end desc nulls last, created_at
     limit greatest(1, least(coalesce(p_limit, 4), 4))),
  upd as (
    update prep.ops_actions a set expires_at = greatest(a.expires_at, now() + interval '24 hours')
     where a.id in (select id from pick)
    returning a.id, a.kind, a.title, a.token, a.detail, a.created_at,
              (a.kind = 'post' and a.detail ? 'fb_post_id') as daily)
  select (select count(*) from live),
         coalesce(jsonb_agg(to_jsonb(upd) - 'daily' order by (kind = 'slip') desc, daily desc,
                            case when daily then created_at end desc nulls last, created_at), '[]'::jsonb)
    into total, acts from upd;
  return jsonb_build_object('outbox', ob, 'actions', acts, 'total', total);
end $$;

revoke execute on function public.prep_ops_pending(text, integer) from public, anon, authenticated;
grant execute on function public.prep_ops_pending(text, integer) to service_role;
