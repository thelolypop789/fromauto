-- โพล pop up เปลี่ยนเป็นถามหลังสอบ: "สอบแล้ว ข้อสอบใน SOBPREP ช่วยได้แค่ไหน" (poll id ใหม่ 2026-11-b-after)
create or replace function public.prep_poll_answer(p_poll text, p_choice text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.uid();
begin
  if u is null then raise exception 'not_authenticated'; end if;
  if p_poll not in ('2026-11-b-help', '2026-11-b-after') or p_choice not in ('much', 'some', 'little', 'none') then raise exception 'bad_poll'; end if;
  insert into prep.poll_answers (poll, user_id, choice) values (p_poll, u, p_choice)
    on conflict (poll, user_id) do update set choice = excluded.choice, created_at = now();
  return (select jsonb_build_object('total', coalesce(sum(c.n), 0), 'counts', coalesce(jsonb_object_agg(c.choice, c.n), '{}'::jsonb))
            from (select choice, count(*) n from prep.poll_answers where poll = p_poll group by choice) c);
end $$;
revoke execute on function public.prep_poll_answer(text, text) from public, anon;
grant execute on function public.prep_poll_answer(text, text) to authenticated;
