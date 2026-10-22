-- AI question writer for major sub-topics. The Edge Function prep-gen-questions writes a batch for one sub-topic,
-- a second stronger model answers it blind, and only questions where both agree are saved (approved, labelled).
-- Everything stays off until an admin switches it on for chosen majors (prep.gen_settings), and a sub-topic stops
-- being filled once it holds 3x its mock-exam share of approved questions (the same target the admin page shows).

create table prep.gen_settings (
  id         int primary key check (id = 1),
  enabled    boolean not null default false,
  topics     text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table prep.gen_settings enable row level security;
insert into prep.gen_settings (id) values (1);

-- Sub-topics of enabled majors that are under target, biggest gap first (service_role / cron).
create function public.prep_gen_next(p_limit int default 5) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(x.code order by x.gap desc, x.code), '{}')
    from (select s.code,
                 3 * round(100.0 * s.weight / (select sum(w.weight) from prep.subtopics w where w.topic = s.topic))
                   - (select count(*) from prep.questions q where q.subtopic = s.code and q.status = 'approved') as gap
            from prep.subtopics s, prep.gen_settings g
           where g.id = 1 and g.enabled and s.topic = any (g.topics)
           order by 2 desc limit greatest(1, least(coalesce(p_limit, 5), 12))) x
   where x.gap > 0
$$;

-- Work order for one sub-topic. Null when generation is off for its major (unless p_force, used by an admin test).
create function public.prep_gen_work(p_subtopic text, p_force boolean default false) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s prep.subtopics; g prep.gen_settings; have int; goal int;
begin
  select * into s from prep.subtopics where code = p_subtopic;
  if not found then return null; end if;
  select * into g from prep.gen_settings where id = 1;
  if not p_force and not (g.enabled and s.topic = any (g.topics)) then return null; end if;
  select count(*) into have from prep.questions q where q.subtopic = s.code and q.status = 'approved';
  goal := 3 * round(100.0 * s.weight / (select sum(w.weight) from prep.subtopics w where w.topic = s.topic))::int;
  return jsonb_build_object(
    'subtopic', s.code, 'topic', s.topic, 'major', (select name from prep.topics where code = s.topic),
    'name', s.name, 'kind', s.kind, 'keywords', s.keywords, 'need', greatest(goal - have, 0),
    'stems', coalesce((select jsonb_agg(left(regexp_replace(q.stem, '\s+', ' ', 'g'), 90))
                         from (select stem from prep.questions where subtopic = s.code and status = 'approved'
                                order by id desc limit 60) q), '[]'::jsonb),
    'sibling_names', coalesce((select jsonb_agg(o.name order by o.sort) from prep.subtopics o where o.topic = s.topic and o.code <> s.code), '[]'::jsonb));
end $$;

create function public.prep_gen_save(p_subtopic text, p_items jsonb, p_source text) returns int
language plpgsql security definer set search_path = '' as $$
declare s prep.subtopics; it jsonb; rid int; n int := 0;
begin
  select * into s from prep.subtopics where code = p_subtopic;
  if not found then raise exception 'bad_subtopic'; end if;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if jsonb_typeof(it->'choices') <> 'array' or jsonb_array_length(it->'choices') <> 4
       or coalesce(length(trim(it->>'stem')), 0) < 12
       or (it->>'answer') is null or (it->>'answer')::int not between 0 and 3
       or prep.refers_to_missing_source(it->>'stem') then
      continue;
    end if;
    insert into prep.questions (topic, level, stem, choices, answer, explanation, origin, source, status, content_hash, subtopic)
    values (s.topic, coalesce(nullif(it->>'level', ''), 'remember'), trim(it->>'stem'), it->'choices', (it->>'answer')::smallint,
            coalesce(it->>'explanation', ''), 'ai', left(p_source, 200), 'approved',
            prep.content_hash(trim(it->>'stem'), it->'choices'), s.code)
    on conflict (content_hash) do nothing
    returning id into rid;
    if rid is not null then
      insert into prep.subtopic_tags (question_id, subtopic, confidence, source, model) values (rid, s.code, 1, 'ai', 'generated');
      n := n + 1;
    end if;
    rid := null;
  end loop;
  return n;
end $$;

-- ---------- admin ----------
create function public.prep_admin_gen_get() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g prep.gen_settings;
begin
  perform prep.require_admin();
  select * into g from prep.gen_settings where id = 1;
  return jsonb_build_object(
    'enabled', g.enabled, 'topics', to_jsonb(g.topics),
    'made_24h', (select count(*) from prep.questions where source like 'gen:%' and created_at > now() - interval '24 hours'),
    'made_total', (select count(*) from prep.questions where source like 'gen:%'),
    'majors', coalesce((
      select jsonb_agg(jsonb_build_object(
               'topic', t.code, 'name', t.name,
               'have', (select count(*) from prep.questions q where q.topic = t.code and q.status = 'approved'),
               'goal', (select sum(3 * round(100.0 * s.weight / (select sum(w.weight) from prep.subtopics w where w.topic = s.topic)))
                          from prep.subtopics s where s.topic = t.code),
               'filled', (select sum(least(3 * round(100.0 * s.weight / (select sum(w.weight) from prep.subtopics w where w.topic = s.topic)),
                                           (select count(*) from prep.questions q where q.subtopic = s.code and q.status = 'approved')))
                            from prep.subtopics s where s.topic = t.code))
             order by t.sort)
        from prep.topics t where exists (select 1 from prep.subtopics s where s.topic = t.code)), '[]'::jsonb));
end $$;

create function public.prep_admin_gen_set(p_enabled boolean, p_topics text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  if exists (select 1 from unnest(coalesce(p_topics, '{}')) t where not exists (select 1 from prep.subtopics s where s.topic = t)) then
    raise exception 'bad_topic';
  end if;
  update prep.gen_settings set enabled = coalesce(p_enabled, false), topics = coalesce(p_topics, '{}'), updated_at = now() where id = 1;
end $$;

-- ---------- cron ----------
create function prep.gen_tick() returns void
language plpgsql security definer set search_path = '' as $$
declare c text;
begin
  if not coalesce((select enabled from prep.gen_settings where id = 1), false) then return; end if;
  for c in select unnest(public.prep_gen_next(5)) loop
    perform net.http_post(
      url := 'https://diprxrkddsqmzzihjjwi.supabase.co/functions/v1/prep-gen-questions',
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'subtopic_cron_secret')),
      body := jsonb_build_object('subtopic', c),
      timeout_milliseconds := 140000);
  end loop;
end $$;
revoke execute on function prep.gen_tick() from public;

do $$
declare f text;
begin
  for f in select unnest(array['public.prep_gen_next(integer)', 'public.prep_gen_work(text,boolean)', 'public.prep_gen_save(text,jsonb,text)']) loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
  for f in select unnest(array['public.prep_admin_gen_get()', 'public.prep_admin_gen_set(boolean,text[])']) loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

select cron.schedule('prep-gen-tick', '*/2 * * * *', 'select prep.gen_tick()');
