-- Runs the prep-subtopic-tag Edge Function every 2 minutes for up to 6 majors that still have unlabelled questions
-- (new questions are picked up the same way). The shared secret is generated here, kept only in Vault.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'subtopic_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'subtopic_cron_secret', 'x-cron-secret for prep-subtopic-tag');
  end if;
end $$;

create function public.prep_subtopic_secret_ok(p_secret text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(length(p_secret) >= 16
                  and p_secret = (select decrypted_secret from vault.decrypted_secrets where name = 'subtopic_cron_secret'), false);
$$;
revoke execute on function public.prep_subtopic_secret_ok(text) from public, anon, authenticated;
grant execute on function public.prep_subtopic_secret_ok(text) to service_role;

create function prep.subtopic_tick() returns void
language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  for r in select * from jsonb_array_elements(public.prep_ai_subtopic_pending()) limit 6 loop
    perform net.http_post(
      url := 'https://diprxrkddsqmzzihjjwi.supabase.co/functions/v1/prep-subtopic-tag',
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'subtopic_cron_secret')),
      body := jsonb_build_object('topic', r->>'topic', 'batches', 4),
      timeout_milliseconds := 120000);
  end loop;
end $$;
revoke execute on function prep.subtopic_tick() from public;

select cron.schedule('prep-subtopic-tick', '*/2 * * * *', 'select prep.subtopic_tick()');
