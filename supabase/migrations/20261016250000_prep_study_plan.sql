-- Exam countdown and daily goal.
--  * prep.profiles.exam_date / daily_goal: set by the user on the home screen.
--  * prep_plan(): exam date, goal, days left, answered today, and the streak of days in a row with at least one answer.
--  * prep_set_plan(date, goal): date must be today .. two years ahead (or null to clear); goal 10..300.

alter table prep.profiles add column if not exists exam_date date;
alter table prep.profiles add column if not exists daily_goal int not null default 40 check (daily_goal between 10 and 300);

create or replace function public.prep_plan() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p     prep.profiles := prep.lock_profile(prep.uid());
  today date := prep.today();
  d     date;
  n     int := 0;
begin
  -- streak: count back from today (or from yesterday if nothing answered yet today)
  d := case when exists (select 1 from prep.daily_activity where user_id = p.user_id and day = today and answered > 0) then today else today - 1 end;
  while exists (select 1 from prep.daily_activity where user_id = p.user_id and day = d and answered > 0) and n < 1000 loop
    n := n + 1; d := d - 1;
  end loop;
  return jsonb_build_object(
    'exam_date', p.exam_date,
    'daily_goal', p.daily_goal,
    'days_left', case when p.exam_date is null then null else p.exam_date - today end,
    'answered_today', coalesce((select answered from prep.daily_activity where user_id = p.user_id and day = today), 0),
    'streak', n);
end $$;

create or replace function public.prep_set_plan(p_exam_date date, p_goal int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.uid();
begin
  if p_exam_date is not null and (p_exam_date < prep.today() or p_exam_date > prep.today() + 730) then raise exception 'invalid_date'; end if;
  if p_goal is null or p_goal not between 10 and 300 then raise exception 'invalid_goal'; end if;
  perform prep.lock_profile(u);
  update prep.profiles set exam_date = p_exam_date, daily_goal = p_goal where user_id = u;
  return public.prep_plan();
end $$;

revoke execute on function public.prep_plan() from public, anon;
grant execute on function public.prep_plan() to authenticated;
revoke execute on function public.prep_set_plan(date, int) from public, anon;
grant execute on function public.prep_set_plan(date, int) to authenticated;
