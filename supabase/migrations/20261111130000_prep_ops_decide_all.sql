-- เจ้าของพิมพ์ "อนุมัติทั้งหมด" ใน LINE → อนุมัติทุกเรื่องที่รออยู่ เหมือนกด ✅ ทีละปุ่ม (ใช้ prep_ops_decide ตัวเดิม)
--  * ไม่รวมสลิป: สลิปที่ส่งมาถึงเจ้าของคือสลิปที่ตรวจอัตโนมัติแล้วสงสัย ต้องดูทีละใบ
--  * ไม่รวมเรื่องที่ปุ่มหมดอายุ (เกิน 24 ชม.) — นับจำนวนบอกไว้ ให้พิมพ์ "งานค้าง" เพื่อดู/ต่ออายุก่อน
create or replace function public.prep_ops_decide_all(p_line text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a prep.ops_actions;
  r jsonb;
  done jsonb := '[]'::jsonb;
  slips int;
  expired int;
begin
  if not exists (select 1 from prep.ops_owners where line_user_id = p_line) then return jsonb_build_object('error', 'not_owner'); end if;
  for a in select * from prep.ops_actions
            where status = 'pending' and kind <> 'slip' and expires_at >= now()
            order by created_at, id
  loop
    r := public.prep_ops_decide(p_line, a.token, true);
    done := done || jsonb_build_array(jsonb_build_object('title', a.title, 'ok', coalesce((r ->> 'ok')::boolean, false),
                                                         'error', r ->> 'error', 'command_id', r -> 'command_id'));
  end loop;
  select count(*) into slips from prep.ops_actions a
   where a.status = 'pending' and a.kind = 'slip'
     and exists (select 1 from prep.orders o where o.id = a.ref::int and o.status = 'pending');
  select count(*) into expired from prep.ops_actions where status = 'pending' and kind <> 'slip' and expires_at < now();
  return jsonb_build_object('decided', done, 'slips', slips, 'expired', expired);
end $$;

revoke execute on function public.prep_ops_decide_all(text) from public, anon, authenticated;
grant execute on function public.prep_ops_decide_all(text) to service_role;
