-- Mind-map summaries move from the app bundle to the database, so locked maps are never sent to users without a
-- ภาค ก package. Content rows are written by scripts/prep/gen_summaries_sql.mjs (a separate, generated migration).
create table prep.summaries (
  id         text primary key check (id ~ '^[a-z0-9-]{1,60}$'),
  grp        text not null check (grp in ('A1', 'A2', 'A3')),
  free       boolean not null default false,   -- sample map open to everyone (one per group)
  sort       int not null default 0,
  data       jsonb not null,                   -- the MindMap object (src/prep/summaries/types.ts)
  updated_at timestamptz not null default now()
);
alter table prep.summaries enable row level security;   -- no policies: read through the functions below

-- ภาค ก maps open with a package covering ภาค ก (A or ALL); admins see everything, drafts included.
create function prep.summary_open(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select prep.is_admin(u) or prep.active_packages(u) && array['A', 'ALL']
$$;
revoke execute on function prep.summary_open(uuid) from public;

-- Cards for the list: approved maps (all maps for admins) without their content.
create function public.prep_summary_list() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  u     uuid := prep.uid();
  v_admin boolean := prep.is_admin(u);
  v_full  boolean := prep.summary_open(u);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id, 'group', s.grp, 'free', s.free, 'title', s.data->>'title', 'icon', s.data->>'icon',
             'branches', jsonb_array_length(s.data->'branches'), 'tone', s.data->'branches'->0->>'tone',
             'approved', a.id is not null, 'locked', not (v_full or s.free)) order by s.sort)
      from prep.summaries s left join prep.summary_approvals a on a.id = s.id
     where v_admin or a.id is not null), '[]'::jsonb);
end $$;
revoke execute on function public.prep_summary_list() from public, anon;
grant execute on function public.prep_summary_list() to authenticated;

-- One map's content, only when approved (or admin) and free or covered by a package.
create function public.prep_summary_get(p_id text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  u uuid := prep.uid();
  s prep.summaries;
begin
  select * into s from prep.summaries where id = p_id;
  if not found or not (prep.is_admin(u) or exists (select 1 from prep.summary_approvals a where a.id = p_id)) then
    raise exception 'not_found';
  end if;
  if not (s.free or prep.summary_open(u)) then raise exception 'summary_locked'; end if;
  return s.data;
end $$;
revoke execute on function public.prep_summary_get(text) from public, anon;
grant execute on function public.prep_summary_get(text) to authenticated;
