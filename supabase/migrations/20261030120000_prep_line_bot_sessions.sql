-- LINE OA bot (Edge Function prep-line-bot): one row per LINE user, for two things only:
--   * the recent conversation, so the AI answers follow-up questions. A session ends after 30 minutes without a
--     message; the next message starts fresh. At most the last 12 turns are kept.
--   * hand-off to a human: after the customer asks for แอดมิน the bot stays quiet for that customer until 2 hours
--     pass without a message from them (each new message pushes the end back), so it never talks over an admin.
-- Additive only. Called by the Edge Function with the service role; no client role can read or call any of it.

create table prep.line_chats (
  line_user_id  text primary key check (line_user_id ~ '^U[0-9a-f]{32}$'),
  history       jsonb not null default '[]'::jsonb check (jsonb_typeof(history) = 'array'),
  last_at       timestamptz not null default now(),
  handoff_until timestamptz
);
create index line_chats_last_at on prep.line_chats (last_at);
alter table prep.line_chats enable row level security;

-- Result: {history: [...] ([] when the session expired), handoff: true while a human has the chat}.
-- A message during hand-off pushes handoff_until 2 hours past now.
create function public.prep_line_session(p_user text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r prep.line_chats;
begin
  select * into r from prep.line_chats where line_user_id = p_user;
  if not found then return jsonb_build_object('history', '[]'::jsonb, 'handoff', false); end if;
  if r.handoff_until > now() then
    update prep.line_chats set handoff_until = now() + interval '2 hours', last_at = now() where line_user_id = p_user;
    return jsonb_build_object('history', '[]'::jsonb, 'handoff', true);
  end if;
  return jsonb_build_object('history', case when r.last_at > now() - interval '30 minutes' then r.history else '[]'::jsonb end,
                            'handoff', false);
end $$;

-- Saves the turns of this message (p_turns: [{role, content}, ...]) onto the live session, keeps the last 12,
-- and starts a hand-off when p_handoff. Rows idle for 30 days are deleted on the way (no old chats kept).
create function public.prep_line_session_save(p_user text, p_turns jsonb, p_handoff boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare h jsonb;
begin
  if jsonb_typeof(p_turns) <> 'array' then raise exception 'p_turns must be an array'; end if;
  select case when last_at > now() - interval '30 minutes' then history else '[]'::jsonb end into h
    from prep.line_chats where line_user_id = p_user;
  h := coalesce(h, '[]'::jsonb) || p_turns;
  if jsonb_array_length(h) > 12 then
    select coalesce(jsonb_agg(e order by i), '[]'::jsonb) into h
      from jsonb_array_elements(h) with ordinality as t(e, i)
     where i > jsonb_array_length(h) - 12;
  end if;
  insert into prep.line_chats (line_user_id, history, last_at, handoff_until)
  values (p_user, h, now(), case when p_handoff then now() + interval '2 hours' end)
  on conflict (line_user_id) do update
    set history = excluded.history, last_at = now(),
        handoff_until = case when p_handoff then excluded.handoff_until else prep.line_chats.handoff_until end;
  delete from prep.line_chats where last_at < now() - interval '30 days';
end $$;

revoke execute on function public.prep_line_session(text) from public, anon, authenticated;
revoke execute on function public.prep_line_session_save(text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.prep_line_session(text) to service_role;
grant execute on function public.prep_line_session_save(text, jsonb, boolean) to service_role;
