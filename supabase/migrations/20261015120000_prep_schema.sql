-- ====================================================================
-- FormAuto Prep: practice system for the ครูผู้ช่วย exam (/prep)
--
-- Security model
--   * All tables live in schema "prep", which is NOT exposed through the Data API.
--     Keep it out of Settings → API → Exposed schemas.
--   * The browser only calls the public.prep_* functions below. They run as
--     SECURITY DEFINER, read the caller from auth.uid(), and never return an
--     answer key for a question the caller has not answered yet.
--   * Prep admins are Supabase Auth users listed in prep.admins (not FormAuto
--     license keys).
-- ====================================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists prep;
revoke all on schema prep from public;

-- ---------- content ----------

create table prep.topics (
  code    text primary key,
  section text not null check (section in ('A', 'B')),
  grp     text not null,                       -- A1, A2, A3, B1, B2
  name    text not null,
  sort    int  not null
);

create table prep.questions (
  id           int generated always as identity primary key,
  topic        text not null references prep.topics(code),
  level        text not null default 'remember'
               check (level in ('remember', 'understand', 'apply', 'analyze')),
  stem         text not null check (length(trim(stem)) > 0),
  choices      jsonb not null
               check (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) = 4),
  answer       smallint not null check (answer between 0 and 3),
  explanation  text not null default '',
  law_ref      text,
  origin       text not null default 'sheet' check (origin in ('sheet', 'template', 'ai', 'manual')),
  source       text,
  status       text not null default 'approved' check (status in ('review', 'approved', 'hidden')),
  content_hash text not null unique,
  created_at   timestamptz not null default now()
);
create index questions_topic_approved on prep.questions (topic) where status = 'approved';

-- First-try answers only, so retakes of memorised questions don't skew difficulty.
create table prep.question_stats (
  question_id   int primary key references prep.questions(id) on delete cascade,
  n             int not null default 0,
  correct       int not null default 0,
  choice_counts int[] not null default '{0,0,0,0}'
);

create table prep.reports (
  id          int generated always as identity primary key,
  question_id int not null references prep.questions(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  reason      text not null,
  status      text not null default 'open' check (status in ('open', 'fixed', 'rejected')),
  created_at  timestamptz not null default now()
);

-- ---------- accounts ----------

create table prep.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table prep.profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  plan           text not null default 'free' check (plan in ('free', 'paid')),
  paid_at        timestamptz,
  free_sets_used int not null default 0,
  redeem_fails   int not null default 0,
  redeem_fail_at timestamptz,
  created_at     timestamptz not null default now()
);

create table prep.keys (
  id          int generated always as identity primary key,
  key_hash    text not null unique,              -- sha256 of the normalised key; plaintext is never stored
  note        text,                              -- buyer / transfer slip details
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  revoked_at  timestamptz
);

-- ---------- practice ----------

create table prep.sets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  topics       text[] not null,
  question_ids int[] not null,
  is_free      boolean not null,
  rounds       int not null default 0,
  best_pct     numeric(5,2),                     -- best score of a full round
  last_wrong   int[],                            -- still wrong after the latest round; null = never played
  cleared_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index sets_user on prep.sets (user_id, created_at desc);

create table prep.attempts (
  id           uuid primary key default gen_random_uuid(),
  set_id       uuid not null references prep.sets(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  round_no     int not null,
  mode         text not null check (mode in ('full', 'wrong')),
  question_ids int[] not null,                   -- order shown in this round
  answers      smallint[] not null,              -- original choice index; null = unanswered
  correct      boolean[] not null,
  started_at   timestamptz not null default now(),
  submitted_at timestamptz
);
create index attempts_set on prep.attempts (set_id, round_no desc);
create unique index attempts_one_open on prep.attempts (set_id) where submitted_at is null;

create table prep.user_question_state (
  user_id      uuid not null references auth.users(id) on delete cascade,
  question_id  int  not null references prep.questions(id) on delete cascade,
  seen         int  not null default 0,
  wrong        int  not null default 0,
  last_correct boolean,
  last_at      timestamptz not null default now(),
  primary key (user_id, question_id)
);

-- First-try answers only (true knowledge, not memorised retakes).
create table prep.user_topic_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  topic   text not null references prep.topics(code),
  n       int  not null default 0,
  correct int  not null default 0,
  primary key (user_id, topic)
);

create table prep.daily_activity (
  user_id  uuid not null references auth.users(id) on delete cascade,
  day      date not null,
  answered int  not null default 0,
  correct  int  not null default 0,
  primary key (user_id, day)
);

-- Defence in depth: even if someone exposes the schema later, nothing is readable.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'prep' loop
    execute format('alter table prep.%I enable row level security', t);
  end loop;
end $$;

-- ---------- helpers (not callable by clients) ----------

create function prep.uid() returns uuid
language plpgsql stable set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'not_authenticated'; end if;
  return u;
end $$;

create function prep.today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Bangkok')::date
$$;

create function prep.is_admin(u uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from prep.admins where user_id = u)
$$;

create function prep.require_admin() returns uuid
language plpgsql stable set search_path = '' as $$
declare u uuid := prep.uid();
begin
  if not prep.is_admin(u) then raise exception 'forbidden'; end if;
  return u;
end $$;

-- Locks and returns the caller's profile, creating it on first use.
create function prep.lock_profile(u uuid) returns prep.profiles
language plpgsql set search_path = '' as $$
declare p prep.profiles;
begin
  insert into prep.profiles (user_id) values (u) on conflict do nothing;
  select * into p from prep.profiles where user_id = u for update;
  return p;
end $$;

create function prep.normalize_key(k text) returns text
language sql immutable set search_path = '' as $$
  select upper(regexp_replace(coalesce(k, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

create function prep.hash_key(k text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(prep.normalize_key(k), 'sha256'), 'hex')
$$;

create function prep.content_hash(stem text, choices jsonb) returns text
language sql immutable set search_path = '' as $$
  select md5(lower(regexp_replace(stem, '\s', '', 'g')) || '|' ||
             lower(regexp_replace(choices::text, '\s', '', 'g')))
$$;

-- Round payload: answer/explanation only for items already answered.
create function prep.round_payload(p_attempt uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'attempt_id', a.id,
    'set_id',     a.set_id,
    'title',      s.title,
    'round_no',   a.round_no,
    'mode',       a.mode,
    'items', (
      select jsonb_agg(jsonb_build_object(
        'idx',         o.i - 1,
        'question_id', q.id,
        'topic',       t.name,
        'stem',        q.stem,
        'choices',     q.choices,
        'picked',      a.answers[o.i],
        'correct',     a.correct[o.i],
        'answer',      case when a.answers[o.i] is not null then q.answer end,
        'explanation', case when a.answers[o.i] is not null then q.explanation end,
        'law_ref',     case when a.answers[o.i] is not null then q.law_ref end
      ) order by o.i)
      from unnest(a.question_ids) with ordinality as o(qid, i)
      join prep.questions q on q.id = o.qid
      join prep.topics t on t.code = q.topic
    )
  )
  from prep.attempts a
  join prep.sets s on s.id = a.set_id
  where a.id = p_attempt
$$;

-- ====================================================================
-- Client API (public.prep_*)
-- ====================================================================

create function public.prep_topics()
returns table (code text, section text, grp text, name text, sort int, available int)
language sql stable security definer set search_path = '' as $$
  select t.code, t.section, t.grp, t.name, t.sort,
         (select count(*)::int from prep.questions q
           where q.topic = t.code and q.status = 'approved')
  from prep.topics t
  order by t.sort
$$;

create function public.prep_me() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := prep.uid();
  p prep.profiles;
begin
  p := prep.lock_profile(u);
  return jsonb_build_object(
    'plan',            p.plan,
    'free_sets_used',  p.free_sets_used,
    'free_sets_limit', 3,
    'max_set_size',    case when p.plan = 'paid' then 200 else 40 end,
    'is_admin',        prep.is_admin(u),
    'answered_today',  coalesce((select d.answered from prep.daily_activity d
                                  where d.user_id = u and d.day = prep.today()), 0),
    'daily_cap',       1000
  );
end $$;

-- p_mode: 'new' = unseen questions first, 'weak' = questions answered wrong first, 'mixed' = random
create function public.prep_create_set(p_topics text[], p_size int, p_mode text default 'new', p_title text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  u       uuid := prep.uid();
  p       prep.profiles;
  maxsize int;
  ids     int[];
  sid     uuid;
  n_sets  int;
begin
  p := prep.lock_profile(u);                     -- row lock serialises the free quota
  maxsize := case when p.plan = 'paid' then 200 else 40 end;
  if p_size is null or p_size < 5 or p_size > maxsize then
    raise exception 'invalid_size';
  end if;
  if p.plan <> 'paid' and p.free_sets_used >= 3 then
    raise exception 'free_quota_exceeded';
  end if;
  if p_topics is null or cardinality(p_topics) = 0 then
    raise exception 'no_topics';
  end if;
  if p_mode not in ('new', 'weak', 'mixed') then
    raise exception 'invalid_mode';
  end if;

  select array_agg(x.id) into ids
  from (
    select q.id
    from prep.questions q
    left join prep.user_question_state s on s.user_id = u and s.question_id = q.id
    where q.status = 'approved' and q.topic = any (p_topics)
    order by
      case p_mode
        when 'new'  then case when s.question_id is null then 0 else 1 end
        when 'weak' then case when s.last_correct = false then 0
                              when s.question_id is null then 1 else 2 end
        else 0
      end,
      case when p_mode = 'weak' then -coalesce(s.wrong, 0) else 0 end,
      random()
    limit p_size
  ) x;

  if ids is null or cardinality(ids) < 5 then
    raise exception 'not_enough_questions';
  end if;

  select count(*) into n_sets from prep.sets where user_id = u;

  insert into prep.sets (user_id, title, topics, question_ids, is_free)
  values (u,
          coalesce(nullif(left(trim(p_title), 80), ''), 'ชุดที่ ' || (n_sets + 1)),
          p_topics, ids, p.plan <> 'paid')
  returning id into sid;

  if p.plan <> 'paid' then
    update prep.profiles set free_sets_used = free_sets_used + 1 where user_id = u;
  end if;

  return sid;
end $$;

create function public.prep_list_sets() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',         s.id,
    'title',      s.title,
    'topics',     s.topics,
    'size',       cardinality(s.question_ids),
    'rounds',     s.rounds,
    'best_pct',   s.best_pct,
    'remaining',  case when s.last_wrong is null then cardinality(s.question_ids)
                       else cardinality(s.last_wrong) end,
    'cleared_at', s.cleared_at,
    'created_at', s.created_at,
    'open_round', (select jsonb_build_object(
                     'answered', (select count(*) from unnest(a.answers) x where x is not null),
                     'total', cardinality(a.question_ids),
                     'mode', a.mode)
                   from prep.attempts a where a.set_id = s.id and a.submitted_at is null)
  ) order by s.created_at desc), '[]'::jsonb)
  from prep.sets s
  where s.user_id = prep.uid()
$$;

-- p_mode: 'full' = whole set, 'wrong' = only questions still wrong. An open round is resumed.
create function public.prep_start_round(p_set uuid, p_mode text default 'full') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u    uuid := prep.uid();
  st   prep.sets;
  a_id uuid;
  qids int[];
begin
  select * into st from prep.sets where id = p_set and user_id = u for update;
  if not found then raise exception 'not_found'; end if;

  select id into a_id from prep.attempts where set_id = p_set and submitted_at is null;
  if found then return prep.round_payload(a_id); end if;

  if p_mode = 'wrong' then
    if st.last_wrong is null or cardinality(st.last_wrong) = 0 then
      raise exception 'nothing_wrong';
    end if;
    qids := st.last_wrong;
  else
    p_mode := 'full';
    qids := st.question_ids;
  end if;

  select array_agg(x order by random()) into qids from unnest(qids) x;

  insert into prep.attempts (set_id, user_id, round_no, mode, question_ids, answers, correct)
  values (p_set, u, st.rounds + 1, p_mode, qids,
          array_fill(null::smallint, array[cardinality(qids)]),
          array_fill(null::boolean,  array[cardinality(qids)]))
  returning id into a_id;

  return prep.round_payload(a_id);
end $$;

create function public.prep_get_round(p_attempt uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from prep.attempts where id = p_attempt and user_id = prep.uid()) then
    raise exception 'not_found';
  end if;
  return prep.round_payload(p_attempt);
end $$;

-- Records one answer (first answer is final) and returns the key + explanation for it.
create function public.prep_answer(p_attempt uuid, p_idx int, p_choice int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u     uuid := prep.uid();
  a     prep.attempts;
  q     prep.questions;
  i     int := p_idx + 1;
  ok    boolean;
  first boolean;
  d     date := prep.today();
begin
  select * into a from prep.attempts where id = p_attempt and user_id = u for update;
  if not found then raise exception 'not_found'; end if;
  if a.submitted_at is not null then raise exception 'round_closed'; end if;
  if i < 1 or i > cardinality(a.question_ids) then raise exception 'bad_index'; end if;
  if p_choice is null or p_choice < 0 or p_choice > 3 then raise exception 'bad_choice'; end if;

  select * into q from prep.questions where id = a.question_ids[i];

  if a.answers[i] is not null then
    return jsonb_build_object('picked', a.answers[i], 'correct', a.correct[i],
                              'answer', q.answer, 'explanation', q.explanation, 'law_ref', q.law_ref);
  end if;

  if coalesce((select answered from prep.daily_activity where user_id = u and day = d), 0) >= 1000 then
    raise exception 'daily_cap';
  end if;

  ok := (p_choice = q.answer);
  update prep.attempts set answers[i] = p_choice, correct[i] = ok where id = a.id;

  first := not exists (select 1 from prep.user_question_state
                        where user_id = u and question_id = q.id);

  insert into prep.user_question_state as s (user_id, question_id, seen, wrong, last_correct)
  values (u, q.id, 1, (not ok)::int, ok)
  on conflict (user_id, question_id) do update
    set seen = s.seen + 1, wrong = s.wrong + (not ok)::int, last_correct = ok, last_at = now();

  insert into prep.daily_activity as da (user_id, day, answered, correct)
  values (u, d, 1, ok::int)
  on conflict (user_id, day) do update
    set answered = da.answered + 1, correct = da.correct + ok::int;

  if first then
    insert into prep.user_topic_stats as ts (user_id, topic, n, correct)
    values (u, q.topic, 1, ok::int)
    on conflict (user_id, topic) do update
      set n = ts.n + 1, correct = ts.correct + ok::int;

    insert into prep.question_stats as qs (question_id, n, correct, choice_counts)
    values (q.id, 1, ok::int,
            (select array_agg((g = p_choice)::int order by g) from generate_series(0, 3) g))
    on conflict (question_id) do update
      set n = qs.n + 1,
          correct = qs.correct + ok::int,
          choice_counts[p_choice + 1] = qs.choice_counts[p_choice + 1] + 1;
  end if;

  return jsonb_build_object('picked', p_choice, 'correct', ok,
                            'answer', q.answer, 'explanation', q.explanation, 'law_ref', q.law_ref);
end $$;

-- Closes the round. Unanswered items count as wrong.
create function public.prep_submit(p_attempt uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u       uuid := prep.uid();
  a       prep.attempts;
  total   int;
  right_n int;
  wrong   int[];
  pct     numeric(5,2);
  cleared boolean;
begin
  select * into a from prep.attempts where id = p_attempt and user_id = u for update;
  if not found then raise exception 'not_found'; end if;
  if a.submitted_at is not null then raise exception 'round_closed'; end if;

  total := cardinality(a.question_ids);
  select count(*) filter (where t.ok),
         coalesce(array_agg(t.qid) filter (where not coalesce(t.ok, false)), '{}')
    into right_n, wrong
  from unnest(a.question_ids, a.correct) as t(qid, ok);

  pct := round(100.0 * right_n / greatest(total, 1), 2);
  cleared := cardinality(wrong) = 0;

  update prep.attempts set submitted_at = now() where id = a.id;

  update prep.sets
     set rounds     = a.round_no,
         best_pct   = case when a.mode = 'full' then greatest(coalesce(best_pct, 0), pct) else best_pct end,
         last_wrong = wrong,
         cleared_at = case when cleared then coalesce(cleared_at, now()) else cleared_at end
   where id = a.set_id;

  return jsonb_build_object('set_id', a.set_id, 'round_no', a.round_no, 'mode', a.mode,
                            'correct', right_n, 'total', total, 'pct', pct,
                            'wrong_count', cardinality(wrong), 'cleared', cleared);
end $$;

create function public.prep_dashboard() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  u     uuid := prep.uid();
  today date := prep.today();
  res   jsonb;
begin
  with days as (
         select day from prep.daily_activity where user_id = u and answered > 0),
       runs as (
         select day, day - (row_number() over (order by day))::int as grp from days),
       streak as (
         select count(*)::int as n from runs
          where grp = (select grp from runs order by day desc limit 1)
            and (select max(day) from days) >= today - 1)
  select jsonb_build_object(
    'answered_total', coalesce((select sum(answered) from prep.daily_activity where user_id = u), 0),
    'correct_total',  coalesce((select sum(correct)  from prep.daily_activity where user_id = u), 0),
    'seen',           (select count(*) from prep.user_question_state where user_id = u),
    'bank',           (select count(*) from prep.questions where status = 'approved'),
    'stubborn',       (select count(*) from prep.user_question_state where user_id = u and wrong >= 2),
    'still_wrong',    (select count(*) from prep.user_question_state where user_id = u and last_correct = false),
    'streak',         coalesce((select n from streak), 0),
    'sets',           (select count(*) from prep.sets where user_id = u),
    'sets_cleared',   (select count(*) from prep.sets where user_id = u and cleared_at is not null),
    'days', coalesce((
       select jsonb_agg(jsonb_build_object('day', g::date,
                'answered', coalesce(d.answered, 0), 'correct', coalesce(d.correct, 0)) order by g)
       from generate_series(today - 13, today, interval '1 day') g
       left join prep.daily_activity d on d.user_id = u and d.day = g::date), '[]'::jsonb),
    'topics', coalesce((
       select jsonb_agg(jsonb_build_object(
                'code', t.code, 'name', t.name, 'grp', t.grp, 'section', t.section,
                'n', coalesce(ts.n, 0), 'correct', coalesce(ts.correct, 0),
                'available', (select count(*) from prep.questions q
                               where q.topic = t.code and q.status = 'approved'),
                'seen', (select count(*) from prep.user_question_state s
                           join prep.questions q on q.id = s.question_id
                          where s.user_id = u and q.topic = t.code)
              ) order by t.sort)
       from prep.topics t
       left join prep.user_topic_stats ts on ts.user_id = u and ts.topic = t.code), '[]'::jsonb)
  ) into res;
  return res;
end $$;

create function public.prep_report(p_question int, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.uid();
begin
  if coalesce(length(trim(p_reason)), 0) = 0 then raise exception 'empty_reason'; end if;
  if (select count(*) from prep.reports where user_id = u and created_at > now() - interval '1 day') >= 30 then
    raise exception 'too_many_reports';
  end if;
  insert into prep.reports (question_id, user_id, reason) values (p_question, u, left(p_reason, 500));
end $$;

create function public.prep_redeem_key(p_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u  uuid := prep.uid();
  p  prep.profiles;
  kid int;
begin
  p := prep.lock_profile(u);
  if p.plan = 'paid' then return jsonb_build_object('ok', true, 'already', true); end if;
  if p.redeem_fails >= 5 and p.redeem_fail_at > now() - interval '15 minutes' then
    return jsonb_build_object('ok', false, 'error', 'too_many_attempts');
  end if;

  update prep.keys
     set redeemed_by = u, redeemed_at = now()
   where key_hash = prep.hash_key(p_key) and redeemed_by is null and revoked_at is null
  returning id into kid;

  if kid is null then
    update prep.profiles
       set redeem_fails = case when redeem_fail_at > now() - interval '15 minutes' then redeem_fails + 1 else 1 end,
           redeem_fail_at = now()
     where user_id = u;
    return jsonb_build_object('ok', false, 'error', 'invalid_key');
  end if;

  update prep.profiles set plan = 'paid', paid_at = now(), redeem_fails = 0 where user_id = u;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- admin ----------

create function public.prep_admin_create_keys(p_count int, p_note text) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  u        uuid := prep.require_admin();
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- no 0/O/1/I
  b        bytea;
  k        text;
  out      text[] := '{}';
begin
  if p_count is null or p_count < 1 or p_count > 50 then raise exception 'invalid_count'; end if;
  for n in 1..p_count loop
    b := extensions.gen_random_bytes(12);
    k := 'PREP';
    for j in 0..11 loop
      if j % 4 = 0 then k := k || '-'; end if;
      k := k || substr(alphabet, (get_byte(b, j) % 32) + 1, 1);
    end loop;
    insert into prep.keys (key_hash, note, created_by) values (prep.hash_key(k), p_note, u);
    out := out || k;
  end loop;
  return out;
end $$;

create function public.prep_admin_list_keys() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare res jsonb;
begin
  perform prep.require_admin();
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', k.id, 'note', k.note, 'created_at', k.created_at,
    'redeemed_at', k.redeemed_at, 'redeemed_email', au.email, 'revoked_at', k.revoked_at
  ) order by k.created_at desc), '[]'::jsonb) into res
  from prep.keys k left join auth.users au on au.id = k.redeemed_by;
  return res;
end $$;

-- Revoking a redeemed key downgrades that account back to free.
create function public.prep_admin_revoke_key(p_id int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := prep.require_admin();
  r uuid;
begin
  update prep.keys set revoked_at = now() where id = p_id and revoked_at is null returning redeemed_by into r;
  if r is not null then
    update prep.profiles set plan = 'free', paid_at = null where user_id = r;
  end if;
end $$;

-- p_items: [{topic, level, stem, choices[4], answer, explanation, law_ref, status}]
create function public.prep_admin_import(p_items jsonb, p_source text, p_origin text default 'sheet') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u        uuid := prep.require_admin();
  it       jsonb;
  inserted int := 0;
  skipped  int := 0;
  invalid  int := 0;
  rid      int;
begin
  for it in select * from jsonb_array_elements(p_items) loop
    if not exists (select 1 from prep.topics where code = it->>'topic')
       or jsonb_typeof(it->'choices') <> 'array' or jsonb_array_length(it->'choices') <> 4
       or coalesce(length(trim(it->>'stem')), 0) = 0
       or (it->>'answer') is null or (it->>'answer')::int not between 0 and 3 then
      invalid := invalid + 1;
      continue;
    end if;
    insert into prep.questions (topic, level, stem, choices, answer, explanation, law_ref,
                                origin, source, status, content_hash)
    values (it->>'topic',
            coalesce(nullif(it->>'level', ''), 'remember'),
            trim(it->>'stem'),
            it->'choices',
            (it->>'answer')::smallint,
            coalesce(it->>'explanation', ''),
            nullif(it->>'law_ref', ''),
            p_origin,
            p_source,
            coalesce(nullif(it->>'status', ''), 'approved'),
            prep.content_hash(trim(it->>'stem'), it->'choices'))
    on conflict (content_hash) do nothing
    returning id into rid;
    if rid is null then skipped := skipped + 1; else inserted := inserted + 1; end if;
    rid := null;
  end loop;
  return jsonb_build_object('inserted', inserted, 'skipped', skipped, 'invalid', invalid);
end $$;

-- Review queue: questions in 'review' plus questions with open reports.
create function public.prep_admin_review_queue(p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare res jsonb;
begin
  perform prep.require_admin();
  select coalesce(jsonb_agg(x order by x->>'reports' desc, (x->>'id')::int), '[]'::jsonb) into res
  from (
    select jsonb_build_object(
      'id', q.id, 'topic', q.topic, 'stem', q.stem, 'choices', q.choices, 'answer', q.answer,
      'explanation', q.explanation, 'law_ref', q.law_ref, 'status', q.status, 'source', q.source,
      'reports', (select coalesce(jsonb_agg(r.reason), '[]'::jsonb) from prep.reports r
                   where r.question_id = q.id and r.status = 'open')) as x
    from prep.questions q
    where q.status = 'review'
       or exists (select 1 from prep.reports r where r.question_id = q.id and r.status = 'open')
    order by q.id
    limit greatest(1, least(p_limit, 200))
  ) s;
  return res;
end $$;

-- Approve / hide / edit a question. Null fields are left unchanged. Closes open reports.
create function public.prep_admin_update_question(
  p_id int, p_status text default null, p_stem text default null, p_choices jsonb default null,
  p_answer int default null, p_explanation text default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  update prep.questions
     set status      = coalesce(p_status, status),
         stem        = coalesce(p_stem, stem),
         choices     = coalesce(p_choices, choices),
         answer      = coalesce(p_answer::smallint, answer),
         explanation = coalesce(p_explanation, explanation)
   where id = p_id;
  update prep.reports set status = 'fixed' where question_id = p_id and status = 'open';
end $$;

create function public.prep_admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return jsonb_build_object(
    'users',          (select count(*) from prep.profiles),
    'paid',           (select count(*) from prep.profiles where plan = 'paid'),
    'answered_today', coalesce((select sum(answered) from prep.daily_activity where day = prep.today()), 0),
    'active_today',   (select count(*) from prep.daily_activity where day = prep.today()),
    'questions',      (select jsonb_object_agg(status, n) from
                        (select status, count(*) n from prep.questions group by status) s),
    'open_reports',   (select count(*) from prep.reports where status = 'open'),
    'keys_unused',    (select count(*) from prep.keys where redeemed_by is null and revoked_at is null)
  );
end $$;

-- ---------- privileges ----------
-- New functions are executable by PUBLIC (and Supabase also grants anon) by default.

revoke execute on all functions in schema prep from public;

do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.proname like 'prep\_%' loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

grant execute on function public.prep_topics() to anon;
