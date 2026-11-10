-- ปลุก Claude Code ผ่าน edge function prep-ops แทนการยิงตรงจาก SQL
-- เหตุผล: เจ้าของเก็บ Fire URL / token เป็น Edge Function secrets (claude_routine_url, claude_routine_token) ไม่ใช่ Vault
-- และให้ prep-ops บันทึกผล (status, session_url) + แจ้ง LINE เมื่อปลุกไม่สำเร็จ
alter table prep.ops_fires
  add column if not exists status_code int,
  add column if not exists session_url text;

create or replace function prep.fire_agent(p_job text, p_command bigint default null) returns bigint
language plpgsql security definer set search_path = '' as $$
declare fid bigint;
begin
  insert into prep.ops_fires (job, command_id) values (p_job, p_command) returning id into fid;
  update prep.ops_fires
     set request_id = prep.ops_call(jsonb_build_object('action', 'fire', 'job', p_job, 'command_id', p_command, 'fire_id', fid))
   where id = fid;
  if p_command is not null then
    update prep.owner_commands set status = 'fired', fired_at = now() where id = p_command and status = 'queued';
  end if;
  return fid;
end $$;
revoke execute on function prep.fire_agent(text, bigint) from public;

create or replace function public.prep_ops_fire_result(p_fire bigint, p_status int, p_session text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare cid bigint;
begin
  update prep.ops_fires set status_code = p_status, session_url = p_session, note = p_note where id = p_fire
  returning command_id into cid;
  if cid is null then return; end if;
  if p_status = 200 then
    update prep.owner_commands set session_url = p_session where id = cid;
  else
    update prep.owner_commands set status = 'failed', result = left('ปลุก Claude Code ไม่สำเร็จ: ' || coalesce(p_note, p_status::text), 4000),
           finished_at = now()
     where id = cid and status in ('queued', 'fired');
  end if;
end $$;
revoke execute on function public.prep_ops_fire_result(bigint, integer, text, text) from public, anon, authenticated;
grant execute on function public.prep_ops_fire_result(bigint, integer, text, text) to service_role;
