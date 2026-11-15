-- โพลสั้นแบบ pop up บนหน้าแรก (15 พ.ย. 2569 วันสอบภาค ข): "ข้อสอบใน SOBPREP ช่วยได้แค่ไหน"
-- ตอบได้คนละ 1 ครั้งต่อโพล (ตอบซ้ำ = เปลี่ยนคำตอบ); คืนผลรวมให้หน้า pop up แสดงหลังตอบ
create table if not exists prep.poll_answers (
  poll       text not null,
  user_id    uuid not null,
  choice     text not null,
  created_at timestamptz not null default now(),
  primary key (poll, user_id)
);
alter table prep.poll_answers enable row level security;
revoke all on prep.poll_answers from public, anon, authenticated;

create or replace function public.prep_poll_answer(p_poll text, p_choice text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.uid();
begin
  if u is null then raise exception 'not_authenticated'; end if;
  if p_poll is distinct from '2026-11-b-help' or p_choice not in ('much', 'some', 'little', 'none') then raise exception 'bad_poll'; end if;
  insert into prep.poll_answers (poll, user_id, choice) values (p_poll, u, p_choice)
    on conflict (poll, user_id) do update set choice = excluded.choice, created_at = now();
  return (select jsonb_build_object('total', coalesce(sum(c.n), 0), 'counts', coalesce(jsonb_object_agg(c.choice, c.n), '{}'::jsonb))
            from (select choice, count(*) n from prep.poll_answers where poll = p_poll group by choice) c);
end $$;
revoke execute on function public.prep_poll_answer(text, text) from public, anon;
grant execute on function public.prep_poll_answer(text, text) to authenticated;
