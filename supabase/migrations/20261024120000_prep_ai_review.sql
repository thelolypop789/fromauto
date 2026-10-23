-- "ตรวจด้วย AI" in แอดมิน → ข้อสอบรอตรวจ. The Edge Function prep-ai-review reads the questions through
-- prep_admin_ai_pick (with the admin's own token), has two DeepSeek models answer blind and DeepSeek Pro judge with the key,
-- and stores one combined verdict per question with prep_admin_ai_save. The admin still decides: a verdict never
-- changes a question by itself.

create table if not exists prep.ai_reviews (
  question_id int primary key references prep.questions(id) on delete cascade,
  verdict     text not null check (verdict in ('ok', 'fix', 'hide')),
  answer      smallint check (answer between 0 and 3),   -- the reviewers' answer (blind majority)
  confidence  text check (confidence in ('high', 'medium', 'low')),
  issue       text,
  fix         jsonb,                                     -- {stem, choices, answer, explanation}, null = unchanged
  detail      jsonb,                                     -- each model's blind answer and the judge's verdict
  model       text,
  reviewed_at timestamptz not null default now()
);
alter table prep.ai_reviews enable row level security;   -- read and written only through the admin functions below

create or replace function public.prep_admin_ai_pick(p_ids int[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  if cardinality(coalesce(p_ids, '{}')) > 20 then raise exception 'too_many'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', q.id, 'topic', t.name, 'subtopic', s.name, 'track', coalesce(t.track, 'obec'), 'grp', t.grp,
             'stem', q.stem, 'choices', q.choices, 'answer', q.answer, 'explanation', q.explanation, 'law_ref', q.law_ref)
           order by q.id)
      from prep.questions q join prep.topics t on t.code = q.topic left join prep.subtopics s on s.code = q.subtopic
     where q.id = any (p_ids)), '[]'::jsonb);
end $$;

create or replace function public.prep_admin_ai_save(p_items jsonb, p_model text) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform prep.require_admin();
  insert into prep.ai_reviews (question_id, verdict, answer, confidence, issue, fix, detail, model, reviewed_at)
  select (x->>'id')::int, x->>'verdict', nullif(x->>'answer', '')::smallint,
         case when x->>'confidence' in ('high', 'medium', 'low') then x->>'confidence' end,
         nullif(x->>'issue', ''), case when jsonb_typeof(x->'fix') = 'object' then x->'fix' end,
         case when jsonb_typeof(x->'detail') = 'object' then x->'detail' end, p_model, now()
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x
   where x->>'verdict' in ('ok', 'fix', 'hide') and exists (select 1 from prep.questions q where q.id = (x->>'id')::int)
  on conflict (question_id) do update
     set verdict = excluded.verdict, answer = excluded.answer, confidence = excluded.confidence, issue = excluded.issue,
         fix = excluded.fix, detail = excluded.detail, model = excluded.model, reviewed_at = excluded.reviewed_at;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.prep_admin_ai_get(p_ids int[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return coalesce((
    select jsonb_object_agg(r.question_id::text, jsonb_build_object(
             'verdict', r.verdict, 'answer', r.answer, 'confidence', r.confidence, 'issue', r.issue, 'fix', r.fix,
             'detail', r.detail, 'model', r.model, 'at', r.reviewed_at))
      from prep.ai_reviews r where r.question_id = any (coalesce(p_ids, '{}'))), '{}'::jsonb);
end $$;

revoke execute on function public.prep_admin_ai_pick(int[]), public.prep_admin_ai_save(jsonb, text),
                           public.prep_admin_ai_get(int[]) from public, anon;
grant execute on function public.prep_admin_ai_pick(int[]), public.prep_admin_ai_save(jsonb, text),
                          public.prep_admin_ai_get(int[]) to authenticated;
