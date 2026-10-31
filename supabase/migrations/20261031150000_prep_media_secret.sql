-- Shared secret for the Edge Function prep-media (Gemini text-to-speech for the summary clips). The clip builder sends
-- it as x-media-secret; the function checks it here. Service role only.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'media_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'media_secret', 'shared secret for prep-media');
  end if;
end $$;

create function public.prep_media_secret_ok(p_secret text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(length(p_secret) >= 16 and p_secret = (select decrypted_secret from vault.decrypted_secrets where name = 'media_secret'), false);
$$;
revoke execute on function public.prep_media_secret_ok(text) from public, anon, authenticated;
grant execute on function public.prep_media_secret_ok(text) to service_role;
