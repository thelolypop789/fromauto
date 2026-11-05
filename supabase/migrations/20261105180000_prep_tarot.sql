-- เปิดไพ่ดวงสอบ (/prep/tarot): ผู้ใช้ที่ล็อกอินแล้วเปิดไพ่ได้วันละ 1 ชุด (3 ใบ) ต่อบัญชี
-- ผู้ใช้สุ่มและเลือกไพ่ในเบราว์เซอร์ ฐานข้อมูลแค่บันทึก ตรวจรูปแบบ และคืนชุดเดิมถ้าวันนี้เปิดไปแล้ว
-- ตารางไม่เปิดให้อ่านตรง (RLS ไม่มี policy) เรียกผ่าน RPC เท่านั้น ไม่ให้ anon เรียก

create table if not exists prep.tarot_draws (
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        date not null,
  picks      jsonb not null,           -- [{c: 0..21, r: bool}, …] 3 ใบ ตามลำดับ อดีต ปัจจุบัน อนาคต
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table prep.tarot_draws enable row level security;
revoke all on prep.tarot_draws from public, anon, authenticated;

-- ไพ่ของวันนี้ (null ถ้ายังไม่เปิด)
create or replace function public.prep_tarot_today()
returns jsonb language sql stable security definer set search_path to '' as $$
  select d.picks from prep.tarot_draws d where d.user_id = prep.uid() and d.day = prep.today()
$$;

-- บันทึกไพ่ของวันนี้ ถ้าวันนี้เปิดไปแล้วคืนชุดเดิม (กดซ้ำหรือเปิดอีกเครื่องก็ได้ชุดเดิม)
create or replace function public.prep_tarot_draw(p_picks jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  u   uuid := prep.uid();
  cur jsonb;
begin
  if u is null then raise exception 'not_signed_in'; end if;
  select picks into cur from prep.tarot_draws where user_id = u and day = prep.today();
  if found then return cur; end if;

  if jsonb_typeof(p_picks) <> 'array' or jsonb_array_length(p_picks) <> 3
     or exists (select 1 from jsonb_array_elements(p_picks) e
                 where jsonb_typeof(e->'c') <> 'number' or jsonb_typeof(e->'r') <> 'boolean'
                    or (e->>'c')::int not between 0 and 21)
     or (select count(distinct (e->>'c')::int) from jsonb_array_elements(p_picks) e) <> 3 then
    raise exception 'bad_picks';
  end if;

  insert into prep.tarot_draws (user_id, day, picks)
  values (u, prep.today(), (select jsonb_agg(jsonb_build_object('c', (e->>'c')::int, 'r', (e->>'r')::boolean))
                              from jsonb_array_elements(p_picks) e))
  on conflict (user_id, day) do nothing;
  return (select picks from prep.tarot_draws where user_id = u and day = prep.today());
end $$;

revoke execute on function public.prep_tarot_today() from public, anon;
revoke execute on function public.prep_tarot_draw(jsonb) from public, anon;
grant execute on function public.prep_tarot_today() to authenticated;
grant execute on function public.prep_tarot_draw(jsonb) to authenticated;
