-- LINE bot, part 3: answer a burst of messages once. Each LINE message is queued here; the webhook waits a few seconds
-- (PREP_LINE_DEBOUNCE_S, default 8) and only the newest message of the burst takes the whole queue and answers it, so
-- "สวัสดีครับ" / "อยากถามเรื่องแพ็ก" / "ซื้อขาดใช้ได้นานไหม" get one reply instead of three. If the customer keeps typing,
-- the burst is answered anyway once its first message is p_max_s old. Rows are taken (deleted) atomically, so two
-- webhooks never answer the same message. Additive only; service role only.

create table prep.line_pending (
  id          bigint generated always as identity primary key,
  line_user   text not null check (line_user ~ '^U[0-9a-f]{32}$'),
  kind        text not null check (kind in ('text', 'media')),
  text        text not null default '',
  reply_token text not null,
  created_at  timestamptz not null default now()
);
create index line_pending_user on prep.line_pending (line_user, id);
alter table prep.line_pending enable row level security;

create function public.prep_line_pending_add(p_user text, p_kind text, p_text text, p_token text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare i bigint;
begin
  insert into prep.line_pending (line_user, kind, text, reply_token) values (p_user, p_kind, left(coalesce(p_text, ''), 2000), p_token)
  returning id into i;
  delete from prep.line_pending where created_at < now() - interval '10 minutes'; -- leftovers of a crashed run
  return i;
end $$;

-- Called by the webhook of message p_id after its wait. Takes the whole burst when p_id is still the newest message,
-- or when the burst's first message is already p_max_s seconds old; otherwise a newer message will answer: [].
create function public.prep_line_pending_take(p_user text, p_id bigint, p_max_s int default 25) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare newest bigint; oldest timestamptz; r jsonb;
begin
  select max(id), min(created_at) into newest, oldest from prep.line_pending where line_user = p_user;
  if newest is null then return '[]'::jsonb; end if;
  if newest > p_id and oldest > now() - make_interval(secs => p_max_s) then return '[]'::jsonb; end if;
  with gone as (delete from prep.line_pending where line_user = p_user and id <= newest returning id, kind, text, reply_token)
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'text', text, 'reply_token', reply_token) order by id), '[]'::jsonb)
    into r from gone;
  return r;
end $$;

revoke execute on function public.prep_line_pending_add(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.prep_line_pending_take(text, bigint, integer) from public, anon, authenticated;
grant execute on function public.prep_line_pending_add(text, text, text, text) to service_role;
grant execute on function public.prep_line_pending_take(text, bigint, integer) to service_role;
