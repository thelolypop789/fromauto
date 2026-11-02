-- ผู้ตรวจสรุปแผนผัง: แอดมินมอบสิทธิ์ให้บัญชีผู้ใช้ (ตามอีเมล) ตรวจแผนผังในขอบเขตที่กำหนด (กลุ่ม A3/B1... หรือรหัสหมวด เช่น B3-THAI;
-- ว่าง = ทุกแผนผัง) ผู้ตรวจเห็นแผนผังร่างในขอบเขต เปิดอ่านได้โดยไม่ต้องมีแพ็ก และเขียนคอมเมนต์รายกิ่ง พร้อมผล "ผ่าน" / "ต้องแก้"
-- การเปิดให้ผู้ใช้เห็น (prep_admin_summary_set) ยังเป็นของแอดมินเท่านั้น
-- prep_me / prep_summary_list / prep_summary_get ยกจาก definition จริงบน DB ณ 2 พ.ย. 2569

create table if not exists prep.reviewers (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  scope      text[] not null default '{}',
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now()
);
alter table prep.reviewers enable row level security;

create table if not exists prep.summary_comments (
  id          bigserial primary key,
  summary_id  text not null references prep.summaries(id) on delete cascade,
  branch_id   text,
  user_id     uuid references auth.users(id) on delete set null,
  body        text not null check (length(body) between 1 and 2000),
  verdict     text check (verdict in ('ok', 'fix')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);
create index if not exists summary_comments_map on prep.summary_comments (summary_id, created_at);
alter table prep.summary_comments enable row level security;

-- แอดมิน หรือผู้ตรวจที่ขอบเขตครอบคลุมแผนผังนี้
create or replace function prep.can_review(u uuid, s prep.summaries) returns boolean
language sql stable security definer set search_path = '' as $$
  select prep.is_admin(u) or exists (
    select 1 from prep.reviewers r
     where r.user_id = u
       and (cardinality(r.scope) = 0 or s.grp = any (r.scope) or (s.data->'topics') ?| r.scope))
$$;

CREATE OR REPLACE FUNCTION public.prep_me()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  u    uuid := prep.uid();
  p    prep.profiles;
  pkgs text[];
begin
  p := prep.lock_profile(u);
  pkgs := prep.active_packages(u);
  return jsonb_build_object(
    'plan',            case when cardinality(pkgs) > 0 then 'paid' else 'free' end,
    'packages',        coalesce((
       select jsonb_agg(jsonb_build_object('package', package, 'expires_at', expires_at) order by package)
         from (select package, case when bool_or(expires_at is null) then null else max(expires_at) end as expires_at
                 from prep.entitlements
                where user_id = u and revoked_at is null and (expires_at is null or expires_at > now())
                group by package) x), '[]'::jsonb),
    'free_sets_used',  p.free_sets_used,
    'free_sets_limit', 3 + p.free_sets_bonus,
    'max_set_size',    case when cardinality(pkgs) > 0 then 200 else 40 end,
    'is_admin',        prep.is_admin(u),
    'reviewer',        exists (select 1 from prep.reviewers r where r.user_id = u),
    'answered_today',  coalesce((select d.answered from prep.daily_activity d
                                  where d.user_id = u and d.day = prep.today()), 0),
    'daily_cap',       prep.daily_cap(u)
  );
end $$;

CREATE OR REPLACE FUNCTION public.prep_summary_list()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  u       uuid := prep.uid();
  v_admin boolean := prep.is_admin(u);
  v_a     boolean := prep.summary_open(u, 'A');
  v_b     boolean := prep.summary_open(u, 'B');
  v_major text := (select p.major from prep.profiles p where p.user_id = u);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id, 'group', s.grp, 'free', s.free, 'title', s.data->>'title', 'icon', s.data->>'icon',
             'branches', jsonb_array_length(s.data->'branches'), 'tone', s.data->'branches'->0->>'tone',
             'approved', a.id is not null,
             'topics', s.data->'topics',
             'review', prep.can_review(u, s),
             'comments_open', (select count(*) from prep.summary_comments c where c.summary_id = s.id and c.resolved_at is null),
             'locked', not (s.free or prep.can_review(u, s) or case when s.grp like 'B%' then v_b else v_a end)) order by s.sort)
      from prep.summaries s left join prep.summary_approvals a on a.id = s.id
     where (v_admin or a.id is not null or prep.can_review(u, s))
       and (s.grp <> 'B3' or v_admin or prep.can_review(u, s) or (v_major is not null and s.data->'topics' ? v_major))), '[]'::jsonb);
end $$;

CREATE OR REPLACE FUNCTION public.prep_summary_get(p_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  u uuid := prep.uid();
  s prep.summaries;
begin
  select * into s from prep.summaries where id = p_id;
  if not found or not (prep.can_review(u, s) or exists (select 1 from prep.summary_approvals a where a.id = p_id)) then
    raise exception 'not_found';
  end if;
  if not (s.free or prep.can_review(u, s) or prep.summary_open(u, s.grp)) then raise exception 'summary_locked'; end if;
  return s.data;
end $$;

-- ---------- คอมเมนต์ ----------
create or replace function public.prep_summary_comments(p_id text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  u uuid := prep.uid();
  s prep.summaries;
begin
  select * into s from prep.summaries where id = p_id;
  if not found or not prep.can_review(u, s) then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', c.id, 'branch', c.branch_id, 'body', c.body, 'verdict', c.verdict, 'at', c.created_at,
             'by', coalesce(split_part(au.email, '@', 1), 'ผู้ใช้ที่ลบแล้ว'), 'admin', prep.is_admin(c.user_id),
             'mine', c.user_id = u, 'resolved', c.resolved_at is not null) order by c.created_at)
      from prep.summary_comments c left join auth.users au on au.id = c.user_id
     where c.summary_id = p_id), '[]'::jsonb);
end $$;

create or replace function public.prep_summary_comment_add(p_id text, p_branch text, p_body text, p_verdict text default null) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  u    uuid := prep.uid();
  s    prep.summaries;
  v_id bigint;
begin
  select * into s from prep.summaries where id = p_id;
  if not found or not prep.can_review(u, s) then raise exception 'forbidden'; end if;
  if coalesce(trim(p_body), '') = '' and p_verdict is null then raise exception 'bad_input'; end if;
  if p_verdict is not null and p_verdict not in ('ok', 'fix') then raise exception 'bad_input'; end if;
  if p_branch is not null and not exists (select 1 from jsonb_array_elements(s.data->'branches') b where b->>'id' = p_branch) then
    raise exception 'not_found';
  end if;
  insert into prep.summary_comments (summary_id, branch_id, user_id, body, verdict)
  values (p_id, p_branch, u, left(coalesce(nullif(trim(p_body), ''), case p_verdict when 'ok' then 'ตรวจแล้ว ผ่าน' else 'ต้องแก้' end), 2000), p_verdict)
  returning summary_comments.id into v_id;
  return v_id;
end $$;

-- แอดมิน: ทำเครื่องหมายแก้แล้ว / เปิดใหม่ · ผู้เขียน: ลบของตัวเองที่ยังไม่ถูกปิด
create or replace function public.prep_summary_comment_resolve(p_comment bigint, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare a uuid := prep.require_admin();
begin
  update prep.summary_comments
     set resolved_at = case when p_on then now() end, resolved_by = case when p_on then a end
   where id = p_comment;
end $$;

create or replace function public.prep_summary_comment_delete(p_comment bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.uid();
begin
  delete from prep.summary_comments
   where id = p_comment and (prep.is_admin(u) or (user_id = u and resolved_at is null));
end $$;

-- ---------- จัดการผู้ตรวจ (แอดมิน) ----------
create or replace function public.prep_admin_reviewers() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'user_id', r.user_id, 'email', au.email, 'scope', r.scope, 'granted_at', r.granted_at,
             'comments', (select count(*) from prep.summary_comments c where c.user_id = r.user_id),
             'last_at', (select max(c.created_at) from prep.summary_comments c where c.user_id = r.user_id)) order by r.granted_at)
      from prep.reviewers r join auth.users au on au.id = r.user_id), '[]'::jsonb);
end $$;

-- ผู้ตรวจต้องมีบัญชีแล้ว (เคยล็อกอินแอปอย่างน้อยครั้งหนึ่ง) · p_on = false ถอนสิทธิ์ (คอมเมนต์เดิมยังอยู่)
create or replace function public.prep_admin_reviewer_set(p_email text, p_scope text[], p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a   uuid := prep.require_admin();
  t   uuid;
  new boolean;
begin
  select id into t from auth.users where lower(email) = lower(trim(coalesce(p_email, '')));
  if t is null then raise exception 'user_not_found'; end if;
  if not p_on then delete from prep.reviewers where user_id = t; return; end if;
  new := not exists (select 1 from prep.reviewers where user_id = t);
  insert into prep.reviewers (user_id, scope, granted_by) values (t, coalesce(p_scope, '{}'), a)
  on conflict (user_id) do update set scope = excluded.scope;
  if new then
    insert into prep.notifications (user_id, kind, title, body)
    values (t, 'reviewer', 'คุณได้รับสิทธิ์ผู้ตรวจสรุปแผนผัง',
            'เปิดแท็บ "สรุป" จะเห็นแผนผังร่างที่ได้รับมอบหมาย อ่านแต่ละกิ่งแล้วกด "ผ่าน" หรือเขียนคอมเมนต์จุดที่ต้องแก้ไว้ท้ายแผนผัง ขอบคุณที่ช่วยตรวจครับ');
  end if;
end $$;

do $$
declare f text;
begin
  for f in select unnest(array[
      'public.prep_summary_comments(text)', 'public.prep_summary_comment_add(text,text,text,text)',
      'public.prep_summary_comment_resolve(bigint,boolean)', 'public.prep_summary_comment_delete(bigint)',
      'public.prep_admin_reviewers()', 'public.prep_admin_reviewer_set(text,text[],boolean)']) loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  revoke execute on function prep.can_review(uuid, prep.summaries) from public, anon, authenticated;
end $$;
