-- ภาค ข mind maps (groups B1, B2). A map opens with a package covering its own ภาค: A or ALL for A1–A3, B or ALL for
-- B1–B2. prep.summary_open now takes the map's group, so the list marks each card locked or open on its own.
alter table prep.summaries drop constraint summaries_grp_check;
alter table prep.summaries add constraint summaries_grp_check check (grp in ('A1', 'A2', 'A3', 'B1', 'B2'));

create function prep.summary_open(u uuid, g text) returns boolean
language sql stable security definer set search_path = '' as $$
  select prep.is_admin(u) or prep.active_packages(u) && array[left(g, 1), 'ALL']
$$;
revoke execute on function prep.summary_open(uuid, text) from public;

create or replace function public.prep_summary_list() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  u       uuid := prep.uid();
  v_admin boolean := prep.is_admin(u);
  v_a     boolean := prep.summary_open(u, 'A');
  v_b     boolean := prep.summary_open(u, 'B');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id, 'group', s.grp, 'free', s.free, 'title', s.data->>'title', 'icon', s.data->>'icon',
             'branches', jsonb_array_length(s.data->'branches'), 'tone', s.data->'branches'->0->>'tone',
             'approved', a.id is not null,
             'locked', not (s.free or case when s.grp like 'B%' then v_b else v_a end)) order by s.sort)
      from prep.summaries s left join prep.summary_approvals a on a.id = s.id
     where v_admin or a.id is not null), '[]'::jsonb);
end $$;

create or replace function public.prep_summary_get(p_id text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  u uuid := prep.uid();
  s prep.summaries;
begin
  select * into s from prep.summaries where id = p_id;
  if not found or not (prep.is_admin(u) or exists (select 1 from prep.summary_approvals a where a.id = p_id)) then
    raise exception 'not_found';
  end if;
  if not (s.free or prep.summary_open(u, s.grp)) then raise exception 'summary_locked'; end if;
  return s.data;
end $$;

drop function prep.summary_open(uuid);
