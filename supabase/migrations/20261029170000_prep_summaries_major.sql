-- Mind maps for วิชาเอก (group B3). A major's maps list only for users who chose that major (the map's topics hold the
-- major's code, e.g. B3-INDART); admins see every map. Like ภาค ข maps they open with a B or ALL package, plus the
-- map marked free. prep_summary_list is the production definition plus the major filter.
alter table prep.summaries drop constraint summaries_grp_check;
alter table prep.summaries add constraint summaries_grp_check check (grp in ('A1', 'A2', 'A3', 'B1', 'B2', 'B3'));

create or replace function public.prep_summary_list() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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
             'locked', not (s.free or case when s.grp like 'B%' then v_b else v_a end)) order by s.sort)
      from prep.summaries s left join prep.summary_approvals a on a.id = s.id
     where (v_admin or a.id is not null)
       and (s.grp <> 'B3' or v_admin or (v_major is not null and s.data->'topics' ? v_major))), '[]'::jsonb);
end $$;
revoke execute on function public.prep_summary_list() from public, anon;
grant execute on function public.prep_summary_list() to authenticated;
