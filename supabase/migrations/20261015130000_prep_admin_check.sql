-- Lets the prep-import Edge Function (called with the user's JWT) confirm the caller is a prep admin.
create function public.prep_admin_check() returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  return prep.is_admin(prep.uid());
end $$;

revoke execute on function public.prep_admin_check() from public, anon;
grant execute on function public.prep_admin_check() to authenticated;
