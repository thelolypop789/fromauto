-- Near-duplicate questions whose answer keys disagree (e.g. "กระถางดอกไม้ผลิตจากดินชนิดใด" keyed ดินเหนียว in one file
-- and ดินขาว in another). The comparison runs in the admin's browser (AdminConflicts.tsx) so the database only
-- serves a plain list; this migration adds that list and a table of pairs the admin marked as "different on purpose".
--  * prep_admin_bank_lite(): approved questions (id, topic, origin, stem, choices, answer).
--  * prep.conflict_ok / prep_admin_conflict_ok(a, b) / prep_admin_conflict_ok_list().

create table if not exists prep.conflict_ok (
  a          int not null references prep.questions(id) on delete cascade,
  b          int not null references prep.questions(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
alter table prep.conflict_ok enable row level security;

create or replace function public.prep_admin_bank_lite() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return coalesce((select jsonb_agg(jsonb_build_array(id, topic, origin, stem, choices, answer) order by id)
                     from prep.questions where status = 'approved'), '[]'::jsonb);
end $$;

create or replace function public.prep_admin_conflict_ok_list() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return coalesce((select jsonb_agg(jsonb_build_array(a, b)) from prep.conflict_ok), '[]'::jsonb);
end $$;

create or replace function public.prep_admin_conflict_ok(p_a int, p_b int) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.require_admin();
begin
  insert into prep.conflict_ok (a, b, created_by) values (least(p_a, p_b), greatest(p_a, p_b), u) on conflict do nothing;
end $$;

-- Pairs already reviewed by hand on 2026-10-16: different questions that only look alike.
insert into prep.conflict_ok (a, b)
select least(x, y), greatest(x, y) from (values
  (3181,3182),(1545,1544),(3542,3523),(196,197),(3537,3520),(1278,1277),(3196,3197),(2594,2595),(2372,2373),(2374,2373),
  (2374,2372),(2201,2202),(3210,3209),(1810,1811),(3225,3224),(2389,3080),(2387,2388),(6858,6859),(23,24),(2344,3045),
  (2225,2224),(2375,2376),(195,830),(2611,2610),(1922,2804),(1922,1921),(2805,2804),(2805,1921),(1922,2815),(2805,2815),
  (3222,3236),(3215,3236),(2656,2657),(2712,2711),(3257,3258),(3200,3199),(1719,1720),(2362,2363),(171,174),(172,173),
  (1057,1065),(6792,6791)) v(x, y)
where exists (select 1 from prep.questions where id = x) and exists (select 1 from prep.questions where id = y)
on conflict do nothing;

revoke execute on function public.prep_admin_bank_lite() from public, anon;
grant execute on function public.prep_admin_bank_lite() to authenticated;
revoke execute on function public.prep_admin_conflict_ok_list() from public, anon;
grant execute on function public.prep_admin_conflict_ok_list() to authenticated;
revoke execute on function public.prep_admin_conflict_ok(int, int) from public, anon;
grant execute on function public.prep_admin_conflict_ok(int, int) to authenticated;
