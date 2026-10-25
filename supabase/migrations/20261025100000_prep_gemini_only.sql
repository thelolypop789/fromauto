-- Gemini only: remove the Gemini/DeepSeek admin switch (20261024130000_prep_ai_provider_switch.sql).
-- The edge functions no longer read prep_ai_provider(); an older deployed function that still calls it gets an error,
-- which its helper already treats as "gemini".
drop function if exists public.prep_admin_ai_provider_set(text);
drop function if exists public.prep_ai_provider();

-- prep_admin_gen_get without the ai_provider field (column dropped below).
create or replace function public.prep_admin_gen_get() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g prep.gen_settings;
begin
  perform prep.require_admin();
  select * into g from prep.gen_settings where id = 1;
  return jsonb_build_object(
    'enabled', g.enabled, 'topics', to_jsonb(g.topics), 'review_topics', to_jsonb(g.review_topics),
    'made_24h', (select count(*) from prep.questions where source like 'gen:%' and created_at > now() - interval '24 hours'),
    'made_total', (select count(*) from prep.questions where source like 'gen:%'),
    'held', (select count(*) from prep.questions where source like 'gen:%' and status = 'review'),
    'majors', coalesce((
      select jsonb_agg(jsonb_build_object(
               'topic', t.code, 'name', case when t.track = 'vec' then t.name || ' (สอศ.)' else t.name end,
               'have', (select count(*) from prep.questions q where q.topic = t.code and q.status = 'approved'),
               'held', (select count(*) from prep.questions q where q.topic = t.code and q.status = 'review' and q.source like 'gen:%'),
               'goal', (select sum(prep.gen_goal(s.code)) from prep.subtopics s where s.topic = t.code),
               'filled', (select sum(least(prep.gen_goal(s.code),
                                           (select count(*) from prep.questions q where q.subtopic = s.code and q.status in ('approved', 'review'))))
                            from prep.subtopics s where s.topic = t.code))
             order by t.sort)
        from prep.topics t where exists (select 1 from prep.subtopics s where s.topic = t.code)), '[]'::jsonb));
end $$;

alter table prep.gen_settings drop column if exists ai_provider;
