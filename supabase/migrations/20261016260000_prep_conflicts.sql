-- Near-duplicate questions whose answer keys disagree (e.g. "กระถางดอกไม้ผลิตจากดินชนิดใด" keyed ดินเหนียว in one file
-- and ดินขาว in another). A student who meets both is told they are wrong either way.
--  * prep_admin_conflicts(): approved pairs in the same topic with very similar stems (trigram similarity >= 0.6 after
--    removing spaces/punctuation), the same numbers and Latin words, different answers, and each answer offered as a
--    choice in the other. Pairs marked as fine are left out. Code-generated pairs (template + template) are skipped.
--  * prep.conflict_ok / prep_admin_conflict_ok(a, b): "these two are different questions on purpose" (เข็มตาม/ทวน, D.C./A.C.).

create extension if not exists pg_trgm with schema extensions;

create table if not exists prep.conflict_ok (
  a          int not null references prep.questions(id) on delete cascade,
  b          int not null references prep.questions(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
alter table prep.conflict_ok enable row level security;

-- Stem without spaces/punctuation, indexed with trigrams so similar stems are found without comparing every pair.
create or replace function prep.norm_stem(s text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select regexp_replace(coalesce(s, ''), '[[:space:][:punct:]“”‘’ๆ]', '', 'g')
$$;
create index if not exists questions_norm_stem_trgm on prep.questions
  using gin (prep.norm_stem(stem) extensions.gin_trgm_ops) where status = 'approved';

create or replace function public.prep_admin_conflicts() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  perform set_config('pg_trgm.similarity_threshold', '0.6', true);
  return coalesce((
    with cand as (
      select a.id a_id, b.id b_id
        from prep.questions a
        join prep.questions b
          on prep.norm_stem(b.stem) operator(extensions.%) prep.norm_stem(a.stem)
         and b.status = 'approved' and b.topic = a.topic and b.id > a.id
       where a.status = 'approved' and not (a.origin = 'template' and b.origin = 'template')),
    q as (
      select id, topic, stem, choices, explanation, source, trim(choices->>answer::int) ans, prep.norm_stem(stem) n,
             array(select m[1] from regexp_matches(stem, '([0-9]+|[A-Za-z]+)', 'g') m) toks
        from prep.questions where id in (select a_id from cand union select b_id from cand)),
    pairs as (
      select c.a_id, c.b_id, extensions.similarity(a.n, b.n) sim
        from cand c join q a on a.id = c.a_id join q b on b.id = c.b_id
       where a.ans <> b.ans
         and a.toks = b.toks
         and abs(length(a.n) - length(b.n)) <= greatest(12, length(a.n) * 0.35)
         and exists (select 1 from jsonb_array_elements_text(b.choices) x where trim(x) = a.ans)
         and exists (select 1 from jsonb_array_elements_text(a.choices) x where trim(x) = b.ans)
         and not exists (select 1 from prep.conflict_ok k where k.a = c.a_id and k.b = c.b_id))
    select jsonb_agg(jsonb_build_object(
             'sim', round(p.sim::numeric, 2),
             'a', (select jsonb_build_object('id', id, 'stem', stem, 'ans', ans, 'explanation', explanation, 'source', source,
                                             'n', coalesce((select s.n from prep.question_stats s where s.question_id = q.id), 0)) from q where id = p.a_id),
             'b', (select jsonb_build_object('id', id, 'stem', stem, 'ans', ans, 'explanation', explanation, 'source', source,
                                             'n', coalesce((select s.n from prep.question_stats s where s.question_id = q.id), 0)) from q where id = p.b_id),
             'topic', (select t.name from prep.topics t join q on q.topic = t.code where q.id = p.a_id))
           order by p.sim desc)
      from pairs p), '[]'::jsonb);
end $$;

create or replace function public.prep_admin_conflict_ok(p_a int, p_b int) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.require_admin();
begin
  insert into prep.conflict_ok (a, b, created_by) values (least(p_a, p_b), greatest(p_a, p_b), u) on conflict do nothing;
end $$;

-- Pairs already reviewed by hand on 2026-10-16: different questions that only look alike.
insert into prep.conflict_ok (a, b)
select least(x, y), greatest(x, y) from (values
  (3181,3182),(1545,1544),(3542,3523),(196,197),(3537,3520),(1278,1277),(3196,3197),(2594,2595),(2372,2373),(2374,2373),
  (2374,2372),(2201,2202),(3210,3209),(1810,1811),(3225,3224),(2389,3080),(2387,2388),(6858,6859),(23,24),(2344,3045),
  (2225,2224),(2375,2376),(195,830),(2611,2610),(1922,2804),(1922,1921),(2805,2804),(2805,1921),(1922,2815),(2805,2815),
  (3222,3236),(3215,3236),(2656,2657),(2712,2711),(3257,3258),(3200,3199),(1719,1720),(2362,2363),(171,174),(172,173),
  (1057,1065),(6792,6791),(4603,4641),(1322,1550)) v(x, y)
where exists (select 1 from prep.questions where id = x) and exists (select 1 from prep.questions where id = y)
on conflict do nothing;

revoke execute on function public.prep_admin_conflicts() from public, anon;
grant execute on function public.prep_admin_conflicts() to authenticated;
revoke execute on function public.prep_admin_conflict_ok(int, int) from public, anon;
grant execute on function public.prep_admin_conflict_ok(int, int) to authenticated;
