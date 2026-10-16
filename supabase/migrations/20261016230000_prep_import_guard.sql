-- Questions that depend on a file the student never sees are not accepted any more.
--  * prep.refers_to_missing_source(stem): true for stems that ask about the source document itself (pages, order, counts)
--    or about "the passage / the article" without the text being part of the stem.
--  * prep_admin_import counts such items as invalid instead of inserting them.
-- Same rules as refersToMissingSource() in supabase/functions/prep-import/logic.ts; keep both in sync.

create or replace function prep.refers_to_missing_source(stem text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    stem ~ 'ตามเอกสาร(?!สิทธิ|ราชการ)|ในเอกสาร(?:ที่|นี้|ฉบับ|ชุด|ดังกล่าว|ข้างต้น)|ในเอกสาร$|จากเอกสาร(?!ราชการ|ใด)|เอกสารทบทวน|ชุดเอกสาร|เอกสารฉบับนี้|เอกสารชุดนี้|ในหน้า\s*[0-9]+|จากหน้า\s*[0-9]+|หน้า\s*[0-9]+\s*(?:ของ|ถึง)|ตามชีท|ในชีท|ในเนื้อความ'
    or (length(stem) < 200
        and stem !~ '["''“”‘’]'
        and stem ~ '(?:ข้อความ|บทความ)(?:เรื่อง|เกี่ยวกับ|ที่กำหนด|ที่ระบุ|ข้างต้น|ดังกล่าว|แนะนำ|ของผู้เขียน)|(?:ตาม|จาก)(?:ข้อความ|บทความ)(?:\s|ใน|$)'),
    false)
$$;

create or replace function public.prep_admin_import(p_items jsonb, p_source text, p_origin text default 'sheet') returns jsonb
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
       or (it->>'answer') is null or (it->>'answer')::int not between 0 and 3
       or prep.refers_to_missing_source(it->>'stem') then
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
