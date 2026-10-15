-- In-app payment notice: the buyer picks a package, pays by QR and uploads the slip; an admin
-- checks the bank app and approves (access starts at once, no key needed) or rejects with a note.
-- Additive only: private storage bucket + policies, prep.orders, entitlements.order_id, new functions.

-- ---------- slip storage (private) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prep-slips', 'prep-slips', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

-- Files live under "<user id>/...". Owners upload and read their own; admins read all. No updates/deletes.
create policy "prep slips: owner uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'prep-slips' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "prep slips: owner or admin reads" on storage.objects for select to authenticated
  using (bucket_id = 'prep-slips' and ((storage.foldername(name))[1] = auth.uid()::text or public.prep_admin_check()));

-- ---------- orders ----------
create table prep.orders (
  id          int generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  package     text not null check (package in ('A', 'B', 'ALL')),
  term        text not null check (term in ('round', 'lifetime')),   -- round = 90 days
  amount      int,                                                   -- price shown to the buyer (baht)
  slip_path   text not null,
  note        text,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note  text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index orders_status on prep.orders (status, created_at);
create index orders_user on prep.orders (user_id, created_at desc);
alter table prep.orders enable row level security;

alter table prep.entitlements add column if not exists order_id int references prep.orders(id) on delete set null;

create function public.prep_submit_order(p_package text, p_term text, p_amount int, p_slip_path text, p_note text default null)
returns int
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.uid(); oid int;
begin
  if p_package not in ('A', 'B', 'ALL') then raise exception 'invalid_package'; end if;
  if p_term not in ('round', 'lifetime') then raise exception 'invalid_duration'; end if;
  if p_slip_path is null or split_part(p_slip_path, '/', 1) <> u::text then raise exception 'invalid_slip'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'prep-slips' and o.name = p_slip_path) then
    raise exception 'invalid_slip';
  end if;
  if (select count(*) from prep.orders where user_id = u and status = 'pending') >= 3 then
    raise exception 'too_many_orders';
  end if;
  insert into prep.orders (user_id, package, term, amount, slip_path, note)
  values (u, p_package, p_term, p_amount, p_slip_path, nullif(left(trim(coalesce(p_note, '')), 300), ''))
  returning id into oid;
  return oid;
end $$;

create function public.prep_my_orders() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := prep.uid();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', o.id, 'package', o.package, 'term', o.term, 'amount', o.amount, 'status', o.status,
             'admin_note', o.admin_note, 'created_at', o.created_at, 'reviewed_at', o.reviewed_at,
             'access_until', (select e.expires_at from prep.entitlements e where e.order_id = o.id limit 1))
           order by o.created_at desc)
      from (select * from prep.orders where user_id = u order by created_at desc limit 20) o), '[]'::jsonb);
end $$;

-- p_status: 'pending' (default) | 'approved' | 'rejected' | null = all
create function public.prep_admin_orders(p_status text default 'pending', p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', o.id, 'email', au.email, 'package', o.package, 'term', o.term, 'amount', o.amount,
             'slip_path', o.slip_path, 'note', o.note, 'status', o.status, 'admin_note', o.admin_note,
             'created_at', o.created_at, 'reviewed_at', o.reviewed_at,
             'active_packages', to_jsonb(prep.active_packages(o.user_id)))
           order by case when o.status = 'pending' then o.created_at end asc, o.created_at desc)
      from (select * from prep.orders
             where p_status is null or status = p_status
             order by created_at desc limit greatest(1, least(coalesce(p_limit, 50), 200))) o
      left join auth.users au on au.id = o.user_id), '[]'::jsonb);
end $$;

-- Approve: grants the package like a key would (a round extends an active one by 90 days).
create function public.prep_admin_review_order(p_id int, p_approve boolean, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a    uuid := prep.require_admin();
  o    prep.orders;
  base timestamptz;
  exp  timestamptz;
begin
  select * into o from prep.orders where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if o.status <> 'pending' then raise exception 'already_reviewed'; end if;

  update prep.orders
     set status = case when p_approve then 'approved' else 'rejected' end,
         admin_note = nullif(trim(coalesce(p_note, '')), ''), reviewed_by = a, reviewed_at = now()
   where id = p_id;
  if not p_approve then return jsonb_build_object('ok', true, 'status', 'rejected'); end if;

  perform prep.lock_profile(o.user_id);
  if o.term = 'round' then
    select greatest(now(), coalesce(max(e.expires_at), now())) into base
      from prep.entitlements e
     where e.user_id = o.user_id and e.package = o.package and e.revoked_at is null and e.expires_at > now();
    exp := base + interval '90 days';
  else
    exp := null;
  end if;
  insert into prep.entitlements (user_id, package, expires_at, order_id) values (o.user_id, o.package, exp, o.id);
  update prep.profiles set plan = 'paid', paid_at = now() where user_id = o.user_id;
  return jsonb_build_object('ok', true, 'status', 'approved', 'expires_at', exp);
end $$;

do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('prep_submit_order', 'prep_my_orders', 'prep_admin_orders', 'prep_admin_review_order') loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
