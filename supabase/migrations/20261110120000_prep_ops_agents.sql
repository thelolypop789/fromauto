-- เอเจนต์หลังบ้าน SOBPREP (docs/ops-agents.md)
--  * ตรวจสลิปอัตโนมัติ: ออเดอร์ใหม่ → trigger เรียก edge function prep-ops (Gemini อ่านสลิป) → prep_ops_slip_result
--    ผ่านครบ 5 ข้อ = อนุมัติเอง (orders.auto_approved), ไม่ผ่าน = สร้างเรื่องรออนุมัติ (ops_actions) แล้วส่ง LINE หาเจ้าของ
--    ห้ามปฏิเสธเองเด็ดขาด — สลิปที่ไม่ผ่านค้าง pending จนกว่าเจ้าของจะกด (เตือนซ้ำเมื่อเกิน 3 ชม.)
--  * ปุ่มอนุมัติใน LINE: ops_actions.token ใช้ได้ครั้งเดียว ภายใน 24 ชม. (prep_ops_decide) รับเฉพาะ LINE userId ใน ops_owners
--  * คำสั่ง "สั่ง: ..." จากเจ้าของ → owner_commands → prep.fire_agent ปลุก Claude Code (API trigger ของ scheduled task) ทันที
--    งานตามเวลา (สรุปเช้า 07:40, ตรวจข้อสอบ 01:10) ใช้ทางเดียวกันผ่าน pg_cron
--  * ตั้งค่า Claude Code: เพิ่ม vault secret 'claude_routine_url' (Fire URL) และ 'claude_routine_token' — ถ้ายังไม่ตั้ง
--    fire_agent จะบันทึกว่า not_configured และไม่ทำอะไร
-- additive เท่านั้น: prep_admin_review_order แทนที่ด้วยเวอร์ชันที่เรียก prep.approve_order (พฤติกรรมเดิมทุกอย่าง)

-- ---------- orders: ผลตรวจสลิป ----------
alter table prep.orders
  add column if not exists slip_check      jsonb,
  add column if not exists slip_ref        text,
  add column if not exists slip_checked_at timestamptz,
  add column if not exists auto_approved   boolean not null default false;
create index if not exists orders_slip_ref on prep.orders (slip_ref) where slip_ref is not null;

-- ---------- เจ้าของ / เรื่องรออนุมัติ / คำสั่ง ----------
create table prep.ops_owners (
  line_user_id text primary key,
  note         text,
  added_at     timestamptz not null default now()
);

-- "สั่ง: ลงทะเบียน" ใน LINE ได้รหัส 6 หลัก → เจ้าของบอกรหัสใน Claude Code → เพิ่มเข้า ops_owners ด้วย SQL (ไม่มีทางลัดจาก LINE)
create table prep.ops_owner_requests (
  code         text primary key,
  line_user_id text not null,
  created_at   timestamptz not null default now()
);

create table prep.ops_actions (
  id          bigserial primary key,
  kind        text not null check (kind in ('slip', 'answer', 'hide', 'feedback', 'bot', 'broadcast', 'deploy', 'content', 'other')),
  ref         text,
  title       text not null,
  detail      jsonb not null default '{}'::jsonb,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  token       text not null unique default encode(extensions.gen_random_bytes(12), 'hex'),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '24 hours',
  decided_at  timestamptz,
  decided_by  text,
  reminded_at timestamptz
);
create index ops_actions_pending on prep.ops_actions (created_at) where status = 'pending';

create table prep.owner_commands (
  id           bigserial primary key,
  line_user_id text,
  kind         text not null default 'command' check (kind in ('command', 'action', 'job')),
  body         text not null,
  action_id    bigint references prep.ops_actions(id),
  status       text not null default 'queued' check (status in ('queued', 'fired', 'done', 'failed')),
  session_url  text,
  result       text,
  created_at   timestamptz not null default now(),
  fired_at     timestamptz,
  finished_at  timestamptz
);
create index owner_commands_open on prep.owner_commands (created_at) where status in ('queued', 'fired');

-- ทุกครั้งที่ปลุก Claude Code (ดูผลได้ที่ net._http_response.id = request_id)
create table prep.ops_fires (
  id          bigserial primary key,
  job         text not null,
  command_id  bigint references prep.owner_commands(id),
  request_id  bigint,
  note        text,
  created_at  timestamptz not null default now()
);

alter table prep.ops_owners         enable row level security;
alter table prep.ops_owner_requests enable row level security;
alter table prep.ops_actions        enable row level security;
alter table prep.owner_commands     enable row level security;
alter table prep.ops_fires          enable row level security;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'ops_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'ops_secret', 'shared secret between the database and prep-ops');
  end if;
end $$;

-- ---------- อนุมัติออเดอร์ (ใช้ร่วมกัน: แอดมินในแอป / ตรวจสลิปอัตโนมัติ / ปุ่ม LINE) ----------
-- ยกมาจาก prep_admin_review_order (20261108140000) ทั้งหมด; p_reviewer = null เมื่อไม่ได้อนุมัติผ่านบัญชีแอดมิน
create or replace function prep.approve_order(p_id integer, p_reviewer uuid, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o    prep.orders;
  q    jsonb;
  base timestamptz;
  exp  timestamptz;
begin
  select * into o from prep.orders where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if o.status <> 'pending' then raise exception 'already_reviewed'; end if;

  update prep.orders
     set status = 'approved', admin_note = nullif(trim(coalesce(p_note, '')), ''), reviewed_by = p_reviewer, reviewed_at = now()
   where id = p_id;
  if o.seats > 1 then
    perform prep.make_group_keys(o.id);
    return jsonb_build_object('ok', true, 'status', 'approved', 'keys', o.seats, 'kind', 'group');
  end if;

  perform prep.lock_profile(o.user_id);
  q := prep.quote(o.user_id, o.package, o.term);
  if not (q ? 'error') then
    exp := (q->>'expires_at')::timestamptz;
  elsif o.term in ('round', 'year') then
    select greatest(now(), coalesce(max(e.expires_at), now())) into base
      from prep.entitlements e
     where e.user_id = o.user_id and e.package = o.package and e.revoked_at is null and e.expires_at > now();
    exp := base + case o.term when 'year' then interval '365 days' else interval '90 days' end;
  else
    exp := null;
  end if;
  insert into prep.entitlements (user_id, package, expires_at, order_id) values (o.user_id, o.package, exp, o.id);
  update prep.profiles set plan = 'paid', paid_at = now() where user_id = o.user_id;
  return jsonb_build_object('ok', true, 'status', 'approved', 'expires_at', exp,
                            'kind', coalesce(q->>'kind', 'new'));
end $$;
revoke execute on function prep.approve_order(integer, uuid, text) from public;

create or replace function prep.reject_order(p_id integer, p_reviewer uuid, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o prep.orders;
begin
  select * into o from prep.orders where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if o.status <> 'pending' then raise exception 'already_reviewed'; end if;
  update prep.orders
     set status = 'rejected', admin_note = nullif(trim(coalesce(p_note, '')), ''), reviewed_by = p_reviewer, reviewed_at = now()
   where id = p_id;
  return jsonb_build_object('ok', true, 'status', 'rejected');
end $$;
revoke execute on function prep.reject_order(integer, uuid, text) from public;

-- อนุมัติคำสั่งซื้อ: ถ้าราคาปิดขายไปแล้วระหว่างรอตรวจ (เช่น ส่งสลิปซื้อขาดคืน 15 พ.ย. อนุมัติวันที่ 16) ยังให้สิทธิ์ตามที่ซื้อ
create or replace function public.prep_admin_review_order(p_id integer, p_approve boolean, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a uuid := prep.require_admin();
begin
  if p_approve then return prep.approve_order(p_id, a, p_note); end if;
  return prep.reject_order(p_id, a, p_note);
end $$;

-- ---------- ปลุก Claude Code ----------
-- p_job: 'morning' | 'quality' | 'command' | 'action'; ข้อความที่ส่งไปมีแค่ job + เลขคำสั่ง — เนื้อคำสั่งจริง
-- ให้เอเจนต์อ่านจาก owner_commands เอง (payload ของ API trigger ถือเป็นข้อมูลไม่น่าเชื่อถือ)
create or replace function prep.fire_agent(p_job text, p_command bigint default null) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  u   text := (select decrypted_secret from vault.decrypted_secrets where name = 'claude_routine_url');
  tok text := (select decrypted_secret from vault.decrypted_secrets where name = 'claude_routine_token');
  rid bigint;
  fid bigint;
begin
  if coalesce(u, '') = '' or coalesce(tok, '') = '' then
    insert into prep.ops_fires (job, command_id, note) values (p_job, p_command, 'not_configured') returning id into fid;
    return null;
  end if;
  rid := net.http_post(
    url := trim(u),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || trim(tok),
                                  'anthropic-version', '2023-06-01', 'anthropic-beta', 'experimental-cc-routine-2026-04-01'),
    body := jsonb_build_object('text', jsonb_build_object('job', p_job, 'command_id', p_command)::text),
    timeout_milliseconds := 30000);
  insert into prep.ops_fires (job, command_id, request_id) values (p_job, p_command, rid) returning id into fid;
  if p_command is not null then
    update prep.owner_commands set status = 'fired', fired_at = now() where id = p_command and status = 'queued';
  end if;
  return fid;
end $$;
revoke execute on function prep.fire_agent(text, bigint) from public;

-- งานตามเวลาก็เป็น owner_commands (kind 'job') เพื่อให้เอเจนต์ปิดงานด้วยวิธีเดียวกัน
create or replace function prep.fire_job(p_job text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare cid bigint;
begin
  insert into prep.owner_commands (kind, body) values ('job', p_job) returning id into cid;
  perform prep.fire_agent(p_job, cid);
  return cid;
end $$;
revoke execute on function prep.fire_job(text) from public;

-- ---------- edge function prep-ops (service_role) ----------
create or replace function public.prep_ops_secret_ok(p_secret text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(length(p_secret) >= 16 and p_secret = (select decrypted_secret from vault.decrypted_secrets where name = 'ops_secret'), false);
$$;

create or replace function public.prep_ops_owners() returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(line_user_id order by added_at), '{}') from prep.ops_owners;
$$;

create or replace function public.prep_ops_order(p_id integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', o.id, 'package', o.package, 'term', o.term, 'amount', o.amount, 'seats', o.seats,
                            'promo_code', o.promo_code, 'slip_path', o.slip_path, 'status', o.status,
                            'created_at', o.created_at, 'slip_checked_at', o.slip_checked_at,
                            'email', (select u.email from auth.users u where u.id = o.user_id))
    from prep.orders o where o.id = p_id;
$$;

-- p_pass = ผลตรวจ 4 ข้อจาก edge function (ยอด/ชื่อผู้รับ/เวลา/อ่านชัดไม่ตัดต่อ); ข้อ 5 เลขอ้างอิงไม่ซ้ำ ตรวจที่นี่
-- ทั้งหมดอยู่ใต้ row lock ของออเดอร์ → ถ้าแอดมินกดอนุมัติไปก่อน จะไม่ทำซ้ำ
create or replace function public.prep_ops_slip_result(p_id integer, p_check jsonb, p_ref text, p_pass boolean, p_reasons text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o       prep.orders;
  ref     text := nullif(upper(regexp_replace(coalesce(p_ref, ''), '\s', '', 'g')), '');
  dup     int;
  reasons text[] := coalesce(p_reasons, '{}');
  aid     bigint;
  tok     text;
begin
  select * into o from prep.orders where id = p_id for update;
  if not found then return jsonb_build_object('skipped', 'not_found'); end if;
  if o.status <> 'pending' then return jsonb_build_object('skipped', o.status); end if;
  if o.slip_checked_at is not null then return jsonb_build_object('skipped', 'checked'); end if;

  if ref is not null then
    select id into dup from prep.orders where slip_ref = ref and id <> p_id and status <> 'rejected' limit 1;
    if dup is not null then reasons := reasons || format('เลขอ้างอิงซ้ำกับออเดอร์ #%s', dup); end if;
  end if;

  update prep.orders
     set slip_check = p_check || jsonb_build_object('reasons', to_jsonb(reasons), 'pass', p_pass and dup is null),
         slip_ref = ref, slip_checked_at = now()
   where id = p_id;

  if p_pass and dup is null and cardinality(reasons) = 0 then
    perform prep.approve_order(p_id, null, 'อนุมัติอัตโนมัติ: ตรวจสลิปผ่านครบ 5 ข้อ');
    update prep.orders set auto_approved = true where id = p_id;
    return jsonb_build_object('approved', true);
  end if;

  insert into prep.ops_actions (kind, ref, title, detail)
  values ('slip', p_id::text, format('สลิปออเดอร์ #%s · %s บาท', p_id, o.amount),
          jsonb_build_object('order_id', p_id, 'amount', o.amount, 'package', o.package, 'term', o.term, 'seats', o.seats,
                             'reasons', to_jsonb(reasons), 'check', p_check))
  returning id, token into aid, tok;
  return jsonb_build_object('approved', false, 'action_id', aid, 'token', tok, 'reasons', to_jsonb(reasons));
end $$;

-- เตือนซ้ำ: สลิปที่รอเกิน 3 ชม. และยังไม่เคยเตือน (คืนรายการแล้วตั้ง reminded_at ในคราวเดียว)
create or replace function public.prep_ops_remind_list() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  with due as (
    update prep.ops_actions a set reminded_at = now()
     where a.status = 'pending' and a.kind = 'slip' and a.reminded_at is null and a.created_at < now() - interval '3 hours'
       and exists (select 1 from prep.orders o where o.id = a.ref::int and o.status = 'pending')
    returning a.id, a.title, a.token, a.detail, a.expires_at)
  select coalesce(jsonb_agg(to_jsonb(due)), '[]'::jsonb) into r from due;
  return r;
end $$;

-- ---------- LINE (prep-line-bot, service_role) ----------
create or replace function public.prep_ops_is_owner(p_line text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from prep.ops_owners where line_user_id = p_line);
$$;

-- กดปุ่ม: ใช้ได้ครั้งเดียว, ภายใน expires_at, เฉพาะเจ้าของ
create or replace function public.prep_ops_decide(p_line text, p_token text, p_approve boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a   prep.ops_actions;
  cid bigint;
  res jsonb;
begin
  if not exists (select 1 from prep.ops_owners where line_user_id = p_line) then return jsonb_build_object('error', 'not_owner'); end if;
  select * into a from prep.ops_actions where token = p_token for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if a.status <> 'pending' then return jsonb_build_object('error', 'used', 'status', a.status, 'title', a.title); end if;
  if a.expires_at < now() then
    update prep.ops_actions set status = 'expired' where id = a.id;
    return jsonb_build_object('error', 'expired', 'title', a.title);
  end if;
  update prep.ops_actions
     set status = case when p_approve then 'approved' else 'rejected' end, decided_at = now(), decided_by = p_line
   where id = a.id;

  if a.kind = 'slip' then
    begin
      if p_approve then res := prep.approve_order(a.ref::int, null, 'อนุมัติโดยเจ้าของผ่าน LINE');
      else res := prep.reject_order(a.ref::int, null, 'เจ้าของไม่อนุมัติผ่าน LINE'); end if;
    exception when others then
      return jsonb_build_object('ok', true, 'kind', 'slip', 'title', a.title, 'note', sqlerrm);   -- เช่น อนุมัติในแอปไปแล้ว
    end;
    return jsonb_build_object('ok', true, 'kind', 'slip', 'title', a.title, 'approved', p_approve);
  end if;

  -- เรื่องอื่น: ให้ Claude Code ลงมือ (หรือบันทึกว่าข้าม) — แม้กดไม่อนุมัติก็ปลุก เพื่อให้เอเจนต์ปิดเรื่อง/ปิด PR
  insert into prep.owner_commands (line_user_id, kind, body, action_id)
  values (p_line, 'action', case when p_approve then 'approved' else 'rejected' end, a.id)
  returning id into cid;
  perform prep.fire_agent('action', cid);
  return jsonb_build_object('ok', true, 'kind', a.kind, 'title', a.title, 'approved', p_approve, 'command_id', cid);
end $$;

-- "สั่ง: ..." — ลงทะเบียนได้ทุกคน (ได้แค่รหัส); คำสั่งอื่นเฉพาะเจ้าของ
create or replace function public.prep_ops_command(p_line text, p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b   text := left(trim(coalesce(p_body, '')), 4000);
  cid bigint;
  fid bigint;
  c   text;
begin
  if b ~ '^ลงทะเบียน' then
    if exists (select 1 from prep.ops_owners where line_user_id = p_line) then return jsonb_build_object('registered', true); end if;
    delete from prep.ops_owner_requests where line_user_id = p_line or created_at < now() - interval '1 day';
    c := lpad((floor(random() * 1000000))::int::text, 6, '0');
    insert into prep.ops_owner_requests (code, line_user_id) values (c, p_line);
    return jsonb_build_object('register_code', c);
  end if;
  if not exists (select 1 from prep.ops_owners where line_user_id = p_line) then return jsonb_build_object('error', 'not_owner'); end if;
  if b = '' then return jsonb_build_object('error', 'empty'); end if;
  insert into prep.owner_commands (line_user_id, kind, body) values (p_line, 'command', b) returning id into cid;
  fid := prep.fire_agent('command', cid);
  return jsonb_build_object('ok', true, 'command_id', cid, 'fired', fid is not null);   -- null = ยังไม่ได้ตั้งค่า Claude Code
end $$;

-- ---------- trigger / cron ----------
create or replace function prep.ops_call(p_body jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
begin
  return net.http_post(
    url := 'https://diprxrkddsqmzzihjjwi.supabase.co/functions/v1/prep-ops',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-ops-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ops_secret')),
    body := p_body,
    timeout_milliseconds := 120000);
end $$;
revoke execute on function prep.ops_call(jsonb) from public;

-- pg_net ส่งหลัง commit เท่านั้น ถ้า insert ถูก rollback คำขอก็หายไปด้วย
create or replace function prep.ops_order_inserted() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform prep.ops_call(jsonb_build_object('action', 'slip_check', 'order_id', new.id));
  return new;
end $$;
revoke execute on function prep.ops_order_inserted() from public;
create trigger orders_slip_check after insert on prep.orders for each row execute function prep.ops_order_inserted();

-- ทุก 15 นาที: ตรวจสลิปที่ตกหล่น (edge function ล่ม/timeout) + เตือนสลิปค้างเกิน 3 ชม. — ไม่มีอะไรค้าง = ไม่เรียกเลย
create or replace function prep.ops_tick() returns void
language plpgsql security definer set search_path = '' as $$
declare o record;
begin
  for o in select id from prep.orders
            where status = 'pending' and slip_checked_at is null
              and created_at < now() - interval '5 minutes' and created_at > now() - interval '2 days'
            order by id limit 5 loop
    perform prep.ops_call(jsonb_build_object('action', 'slip_check', 'order_id', o.id));
  end loop;
  if exists (select 1 from prep.ops_actions where status = 'pending' and kind = 'slip' and reminded_at is null
                and created_at < now() - interval '3 hours') then
    perform prep.ops_call(jsonb_build_object('action', 'remind'));
  end if;
end $$;
revoke execute on function prep.ops_tick() from public;

select cron.schedule('prep-ops-tick', '*/15 * * * *', 'select prep.ops_tick()');
select cron.schedule('prep-ops-morning', '40 0 * * *', $$select prep.fire_job('morning')$$);    -- 07:40 ไทย
select cron.schedule('prep-ops-quality', '10 18 * * *', $$select prep.fire_job('quality')$$);   -- 01:10 ไทย

-- ---------- grants ----------
do $$
declare f text;
begin
  foreach f in array array['public.prep_ops_secret_ok(text)', 'public.prep_ops_owners()', 'public.prep_ops_order(integer)',
                           'public.prep_ops_slip_result(integer,jsonb,text,boolean,text[])', 'public.prep_ops_remind_list()',
                           'public.prep_ops_is_owner(text)', 'public.prep_ops_decide(text,text,boolean)',
                           'public.prep_ops_command(text,text)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
