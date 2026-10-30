-- Chat bot, part 2 (Edge Function prep-line-bot): the in-app chat, a log of every chat message, and a daily summary
-- for admins (แอดมิน → ผู้ใช้ → แชทลูกค้า). Additive only.
--   * prep.app_chats: the in-app session (same rules as prep.line_chats: ends after 30 minutes idle, last 12 turns)
--   * prep.chat_log: every message of both channels, kept 90 days, so a day can be summarised and read back.
--     An app user's rows go with their account (on delete cascade).
--   * prep.chat_summaries: one AI summary per Bangkok day, written by the function at 00:20 for the day before
--     (pg_cron → prep.chat_summary_tick → x-cron-secret), or on demand by an admin.
-- The function writes with the service role; admins read through prep_admin_* RPCs; users cannot read the log at all
-- (their own in-app session comes back only through the function).

create table prep.app_chats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  history jsonb not null default '[]'::jsonb check (jsonb_typeof(history) = 'array'),
  last_at timestamptz not null default now()
);
alter table prep.app_chats enable row level security;

create table prep.chat_log (
  id         bigint generated always as identity primary key,
  channel    text not null check (channel in ('line', 'app')),
  line_user  text check (line_user ~ '^U[0-9a-f]{32}$'),
  user_id    uuid references auth.users(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  src        text,                     -- assistant rows: ai | preset:<id> | slip | welcome | fallback | handoff | limit
  created_at timestamptz not null default now(),
  check ((channel = 'line') = (line_user is not null) and (channel = 'app') = (user_id is not null))
);
create index chat_log_created on prep.chat_log (created_at);
create index chat_log_app_user on prep.chat_log (user_id, created_at) where user_id is not null;
alter table prep.chat_log enable row level security;

create table prep.chat_summaries (
  day        date primary key,
  summary    text not null,
  stats      jsonb not null default '{}'::jsonb,
  model      text,
  updated_at timestamptz not null default now()
);
alter table prep.chat_summaries enable row level security;

-- Turns as the function sends them: [{role, content, src?}, ...]. Only role/content/src are kept.
create function prep.chat_turns(p_turns jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('role', t->>'role', 'content', left(t->>'content', 5000), 'src', t->>'src')) order by i), '[]'::jsonb)
    from jsonb_array_elements(case when jsonb_typeof(p_turns) = 'array' then p_turns else '[]'::jsonb end) with ordinality as x(t, i)
   where t->>'role' in ('user', 'assistant') and coalesce(t->>'content', '') <> ''
$$;

create function prep.chat_keep12(h jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(e order by i), '[]'::jsonb)
    from jsonb_array_elements(h) with ordinality as t(e, i)
   where i > jsonb_array_length(h) - 12
$$;

-- LINE: same as before, and every saved turn now also goes to the log.
create or replace function public.prep_line_session_save(p_user text, p_turns jsonb, p_handoff boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare h jsonb; t jsonb := prep.chat_turns(p_turns);
begin
  select case when last_at > now() - interval '30 minutes' then history else '[]'::jsonb end into h
    from prep.line_chats where line_user_id = p_user;
  h := prep.chat_keep12(coalesce(h, '[]'::jsonb) || t);
  insert into prep.line_chats (line_user_id, history, last_at, handoff_until)
  values (p_user, h, now(), case when p_handoff then now() + interval '2 hours' end)
  on conflict (line_user_id) do update
    set history = excluded.history, last_at = now(),
        handoff_until = case when p_handoff then excluded.handoff_until else prep.line_chats.handoff_until end;
  insert into prep.chat_log (channel, line_user, role, content, src)
  select 'line', p_user, e->>'role', e->>'content', e->>'src' from jsonb_array_elements(t) e;
  delete from prep.line_chats where last_at < now() - interval '30 days';
end $$;

-- App: {history, used_today}. used_today = the user's messages today (Bangkok), for the daily cap in the function.
create function public.prep_app_chat_session(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'history', coalesce((select history from prep.app_chats where user_id = p_user and last_at > now() - interval '30 minutes'), '[]'::jsonb),
    'used_today', (select count(*) from prep.chat_log
                    where user_id = p_user and role = 'user' and created_at >= (prep.today()::timestamp at time zone 'Asia/Bangkok')))
$$;

create function public.prep_app_chat_save(p_user uuid, p_turns jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare h jsonb; t jsonb := prep.chat_turns(p_turns);
begin
  select case when last_at > now() - interval '30 minutes' then history else '[]'::jsonb end into h
    from prep.app_chats where user_id = p_user;
  h := prep.chat_keep12(coalesce(h, '[]'::jsonb) || t);
  insert into prep.app_chats (user_id, history, last_at) values (p_user, h, now())
  on conflict (user_id) do update set history = excluded.history, last_at = now();
  insert into prep.chat_log (channel, user_id, role, content, src)
  select 'app', p_user, e->>'role', e->>'content', e->>'src' from jsonb_array_elements(t) e;
end $$;

-- One Bangkok day of chats, grouped per conversation, for the summary. Also clears the log past 90 days.
create function public.prep_chat_day(p_day date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a timestamptz := p_day::timestamp at time zone 'Asia/Bangkok'; b timestamptz := a + interval '1 day'; r jsonb;
begin
  delete from prep.chat_log where created_at < now() - interval '90 days';
  select jsonb_build_object(
    'stats', jsonb_build_object(
      'conversations', count(distinct coalesce(line_user, user_id::text)),
      'line_conversations', count(distinct line_user),
      'app_conversations', count(distinct user_id),
      'messages', count(*) filter (where role = 'user'),
      'ai', count(*) filter (where src = 'ai'),
      'preset', count(*) filter (where src like 'preset:%'),
      'handoff', count(*) filter (where src = 'handoff' or src = 'preset:admin'),
      'fallback', count(*) filter (where src = 'fallback'),
      'slip', count(*) filter (where src = 'slip')),
    'conversations', coalesce((
      select jsonb_agg(c order by c->>'first') from (
        select jsonb_build_object('channel', min(channel), 'first', min(created_at),
                 'turns', jsonb_agg(jsonb_build_object('role', role, 'content', left(content, 800), 'src', src) order by id)) c
          from prep.chat_log where created_at >= a and created_at < b
         group by coalesce(line_user, user_id::text)) x), '[]'::jsonb))
    into r
    from prep.chat_log where created_at >= a and created_at < b;
  return r;
end $$;

create function public.prep_chat_summary_save(p_day date, p_summary text, p_stats jsonb, p_model text) returns void
language sql security definer set search_path = '' as $$
  insert into prep.chat_summaries (day, summary, stats, model, updated_at) values (p_day, p_summary, coalesce(p_stats, '{}'::jsonb), p_model, now())
  on conflict (day) do update set summary = excluded.summary, stats = excluded.stats, model = excluded.model, updated_at = now()
$$;

create function public.prep_chat_secret_ok(p_secret text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(length(p_secret) >= 16 and p_secret = (select decrypted_secret from vault.decrypted_secrets where name = 'chat_cron_secret'), false);
$$;

-- ---------- admin ----------
create function public.prep_admin_chat_summaries(p_limit int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('day', day, 'summary', summary, 'stats', stats, 'model', model, 'updated_at', updated_at) order by day desc)
                     from (select * from prep.chat_summaries order by day desc limit least(greatest(p_limit, 1), 120)) s), '[]'::jsonb);
end $$;

-- Every conversation of one day, newest first, with who it was (app: email; LINE: short id).
create function public.prep_admin_chat_day(p_day date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare a timestamptz := p_day::timestamp at time zone 'Asia/Bangkok'; b timestamptz := a + interval '1 day';
begin
  perform prep.require_admin();
  return coalesce((
    select jsonb_agg(c order by c->>'last' desc) from (
      select jsonb_build_object(
               'channel', min(l.channel),
               'who', coalesce(min(u.email), 'LINE ' || left(min(l.line_user), 9) || '…'),
               'last', max(l.created_at),
               'turns', jsonb_agg(jsonb_build_object('role', l.role, 'content', l.content, 'src', l.src, 'at', l.created_at) order by l.id)) c
        from prep.chat_log l left join auth.users u on u.id = l.user_id
       where l.created_at >= a and l.created_at < b
       group by coalesce(l.line_user, l.user_id::text)) x), '[]'::jsonb);
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.prep_admin_chat_summaries(integer)', 'public.prep_admin_chat_day(date)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array['public.prep_app_chat_session(uuid)', 'public.prep_app_chat_save(uuid,jsonb)', 'public.prep_chat_day(date)',
                           'public.prep_chat_summary_save(date,text,jsonb,text)', 'public.prep_chat_secret_ok(text)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
revoke execute on function prep.chat_turns(jsonb) from public;
revoke execute on function prep.chat_keep12(jsonb) from public;

-- ---------- cron: summarise yesterday at 00:20 Bangkok (17:20 UTC) ----------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'chat_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'chat_cron_secret', 'shared secret between pg_cron and prep-line-bot');
  end if;
end $$;

create function prep.chat_summary_tick() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://diprxrkddsqmzzihjjwi.supabase.co/functions/v1/prep-line-bot',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'chat_cron_secret')),
    body := jsonb_build_object('action', 'summarize', 'day', prep.today() - 1),
    timeout_milliseconds := 120000);
end $$;
revoke execute on function prep.chat_summary_tick() from public;

select cron.schedule('prep-chat-summary', '20 17 * * *', 'select prep.chat_summary_tick()');
