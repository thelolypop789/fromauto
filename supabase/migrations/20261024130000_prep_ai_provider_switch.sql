-- Admin switch: which AI the prep functions use (prep-gen-questions, prep-subtopic-tag, prep-report-ai, prep-import).
-- 'gemini' (GEMINI_KEY) or 'deepseek' (DEEPSEEK_API_KEY, supabase/functions/_shared/deepseek.ts).
alter table prep.gen_settings add column ai_provider text not null default 'gemini'
  check (ai_provider in ('gemini', 'deepseek'));

-- Read by the edge functions: service_role (cron callers) and admins (their own token). Not secret.
create function public.prep_ai_provider() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select ai_provider from prep.gen_settings where id = 1), 'gemini')
$$;
revoke execute on function public.prep_ai_provider() from public, anon;
grant execute on function public.prep_ai_provider() to authenticated, service_role;

create function public.prep_admin_ai_provider_set(p_provider text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  if p_provider not in ('gemini', 'deepseek') then raise exception 'bad_provider'; end if;
  update prep.gen_settings set ai_provider = p_provider, updated_at = now() where id = 1;
end $$;
revoke execute on function public.prep_admin_ai_provider_set(text) from public, anon;
grant execute on function public.prep_admin_ai_provider_set(text) to authenticated;

create or replace function public.prep_admin_gen_get() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g prep.gen_settings;
begin
  perform prep.require_admin();
  select * into g from prep.gen_settings where id = 1;
  return jsonb_build_object(
    'enabled', g.enabled, 'topics', to_jsonb(g.topics), 'review_topics', to_jsonb(g.review_topics), 'ai_provider', g.ai_provider,
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
