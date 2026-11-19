-- แผนการจัดการเรียนรู้สำเร็จรูป (/prep/plans)
-- * เนื้อหาเป็นพรีเซต (ไม่ใช้ AI ตอนใช้งาน): content/lesson-plans/*.json → scripts/prep/lesson_plans/build.mjs → migration เนื้อหา
--   แผนหนึ่ง (เรื่องหนึ่ง) มีหลายรูปแบบ (formats: phenobl / active / 5e) แต่ละรูปแบบเก็บบล็อกเอกสาร 2 ส่วน
--   preview = ส่วนที่ทุกคนเห็น (หัวแผน ข้อ 1–4)  ·  locked = ส่วนที่เหลือ ส่งให้เฉพาะผู้มีสิทธิ์ (ไม่ส่งลงเครื่องผู้ไม่มีสิทธิ์เลย)
-- * สิทธิ์โหลด: แพ็กครบทุกภาค (ALL หรือมีทั้ง A และ B ที่ยังไม่หมดอายุ) = ทุกแผนทุกรูปแบบ
--   ซื้อรายแผน = ได้เฉพาะรูปแบบที่เลือก (orders.package = 'PLAN', term = 'item', plan_id + plan_format) · แอดมินเห็นทุกอย่าง
-- * แผนใหม่ยังไม่เผยแพร่ (published = false): ลูกค้าไม่เห็น แอดมินตรวจแล้วกดเผยแพร่ในแอป (prep_admin_plan_publish)
-- * โหลดเป็น PDF เท่านั้น ต้องตั้งชื่อ-สกุลก่อน (ล็อกกับบัญชี แก้เองไม่ได้ ให้แอดมินแก้) ชื่อไปอยู่ในช่องผู้สอน/ลงชื่อ
--   ไม่มีลายน้ำบนหน้า (ลูกค้าใช้ยื่นสัมภาษณ์ภาค ค) — ติดตามด้วย log การโหลด + metadata ในไฟล์ PDF แทน

-- ---------- ตาราง ----------
create table prep.lesson_plans (
  id          int generated always as identity primary key,
  slug        text not null unique,
  grp         text not null,                 -- กลุ่มที่แสดงในหน้ารายการ เช่น 'อุตสาหกรรมศิลป์'
  subject     text not null,
  course_code text,
  grade       text not null,                 -- 'ม.3'
  unit_no     int,
  unit_title  text,
  plan_no     int,
  title       text not null,
  periods     int not null default 1,
  minutes     int not null default 50,
  summary     text,
  price       int not null default 69 check (price > 0),
  sort        int not null default 0,
  media_url   text,                          -- หน้าสื่อออนไลน์ static (เปิดได้ไม่ต้องล็อกอิน)
  formats     jsonb not null,                -- {key: {name, full, desc, steps, preview: [...], locked: [...]}}
  published   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table prep.lesson_plans enable row level security;

create table prep.plan_purchases (
  user_id    uuid not null references auth.users(id) on delete cascade,
  plan_id    int not null references prep.lesson_plans(id) on delete cascade,
  format     text not null,                  -- รูปแบบที่ซื้อ ('phenobl' | 'active' | '5e')
  order_id   int references prep.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, plan_id, format)
);
alter table prep.plan_purchases enable row level security;

create table prep.plan_downloads (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  plan_id    int not null references prep.lesson_plans(id) on delete cascade,
  format     text not null,
  full_name  text not null,
  via        text not null,                  -- 'pack' | 'purchase' | 'admin'
  created_at timestamptz not null default now()
);
create index plan_downloads_user on prep.plan_downloads (user_id, created_at desc);
alter table prep.plan_downloads enable row level security;

-- ชื่อ-สกุลเจ้าของบัญชี (ใส่ในแผน) ตั้งเองได้ครั้งเดียว
alter table prep.profiles add column if not exists full_name text;
alter table prep.profiles add column if not exists full_name_at timestamptz;

-- ---------- คำสั่งซื้อรายแผน ----------
alter table prep.orders add column if not exists plan_id int references prep.lesson_plans(id) on delete set null;
alter table prep.orders add column if not exists plan_format text;
alter table prep.orders drop constraint if exists orders_package_check;
alter table prep.orders add  constraint orders_package_check check (package in ('A', 'B', 'ALL', 'PLAN'));
alter table prep.orders drop constraint if exists orders_term_check;
alter table prep.orders add  constraint orders_term_check check (term in ('round', 'lifetime', 'year', 'item'));
alter table prep.orders add  constraint orders_plan_check check ((package = 'PLAN') = (plan_id is not null and plan_format is not null and term = 'item')) not valid;

-- ---------- สิทธิ์ ----------
-- สิทธิ์ทั้งแผน: 'admin' | 'pack' | null
create or replace function prep.plan_pack(u uuid) returns text
language sql stable set search_path = '' as $$
  select case
    when prep.is_admin(u) then 'admin'
    when 'ALL' = any (prep.active_packages(u)) or prep.active_packages(u) @> array['A', 'B'] then 'pack'
  end
$$;
revoke execute on function prep.plan_pack(uuid) from public;

-- สิทธิ์รูปแบบหนึ่งของแผน: 'admin' | 'pack' | 'purchase' | null
create or replace function prep.plan_access(u uuid, p_plan int, p_format text) returns text
language sql stable set search_path = '' as $$
  select coalesce(prep.plan_pack(u),
    case when exists (select 1 from prep.plan_purchases pp where pp.user_id = u and pp.plan_id = p_plan and pp.format = p_format) then 'purchase' end)
$$;
revoke execute on function prep.plan_access(uuid, int, text) from public;

-- ชื่อแผนพร้อมรูปแบบ สำหรับรายการคำสั่งซื้อ
create or replace function prep.plan_label(p_plan int, p_format text) returns text
language sql stable set search_path = '' as $$
  select lp.title || coalesce(' · ' || (lp.formats->p_format->>'name'), '') from prep.lesson_plans lp where lp.id = p_plan
$$;
revoke execute on function prep.plan_label(int, text) from public;

-- ---------- รายการแผน ----------
create or replace function public.prep_lesson_plans() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := prep.uid();
begin
  return jsonb_build_object(
    'full_name', (select full_name from prep.profiles where user_id = u),
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'slug', p.slug, 'grp', p.grp, 'subject', p.subject, 'course_code', p.course_code, 'grade', p.grade,
               'unit_no', p.unit_no, 'unit_title', p.unit_title, 'plan_no', p.plan_no, 'title', p.title,
               'periods', p.periods, 'minutes', p.minutes, 'summary', p.summary, 'price', p.price, 'media_url', p.media_url,
               'formats', (select jsonb_agg(jsonb_build_object('key', f.key, 'name', f.value->>'name', 'full', f.value->>'full',
                                                               'desc', f.value->>'desc', 'steps', f.value->'steps')
                                            order by case f.key when 'phenobl' then 1 when 'active' then 2 when '5e' then 3 else 4 end)
                             from jsonb_each(p.formats) f),
               'published', p.published,
               'access', prep.plan_pack(u),
               'owned', coalesce((select jsonb_agg(pp.format) from prep.plan_purchases pp where pp.user_id = u and pp.plan_id = p.id), '[]'::jsonb),
               'pending', coalesce((select jsonb_agg(distinct o.plan_format) from prep.orders o
                                     where o.user_id = u and o.plan_id = p.id and o.status = 'pending'), '[]'::jsonb))
             order by p.grp, p.sort, p.id)
        from prep.lesson_plans p
       where p.published or prep.is_admin(u)), '[]'::jsonb));
end $$;

-- เนื้อหาแผนหนึ่งรูปแบบ: ผู้มีสิทธิ์ได้ทั้งฉบับ ผู้ไม่มีสิทธิ์ได้เฉพาะ preview + จำนวนบล็อกที่ล็อก
create or replace function public.prep_lesson_plan(p_id int, p_format text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  u   uuid := prep.uid();
  p   prep.lesson_plans;
  f   jsonb;
  acc text;
begin
  select * into p from prep.lesson_plans where id = p_id and (published or prep.is_admin(u));
  if not found then raise exception 'not_found'; end if;
  f := p.formats->p_format;
  if f is null then raise exception 'not_found'; end if;
  acc := prep.plan_access(u, p.id, p_format);
  return jsonb_build_object(
    'id', p.id, 'format', p_format, 'access', acc,
    'preview', f->'preview',
    'locked', case when acc is not null then f->'locked' end,
    'locked_blocks', jsonb_array_length(f->'locked'));
end $$;

-- ตั้งชื่อ-สกุลครั้งเดียว (ใช้ในช่องผู้สอน/ลงชื่อของแผน)
create or replace function public.prep_set_full_name(p_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  u  uuid := prep.uid();
  pr prep.profiles;
  n  text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if length(n) < 5 or length(n) > 80 or position(' ' in n) = 0 or n ~ '[0-9@/:<>]' then raise exception 'bad_full_name'; end if;
  pr := prep.lock_profile(u);
  if pr.full_name is not null then raise exception 'full_name_locked'; end if;
  update prep.profiles set full_name = n, full_name_at = now() where user_id = u;
  return n;
end $$;

-- แอดมินแก้ชื่อให้ (กรณีพิมพ์ผิด) — ส่ง null เพื่อให้ผู้ใช้ตั้งใหม่เอง
create or replace function public.prep_admin_set_full_name(p_user uuid, p_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare n text := nullif(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'), '');
begin
  perform prep.require_admin();
  perform prep.lock_profile(p_user);
  update prep.profiles set full_name = n, full_name_at = case when n is null then null else now() end where user_id = p_user;
  return n;
end $$;

-- บันทึกการโหลด PDF; คืนชื่อที่ใช้ในแผน + เลขการโหลด (ฝังใน metadata ของไฟล์)
create or replace function public.prep_lesson_plan_download(p_id int, p_format text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u   uuid := prep.uid();
  acc text;
  nm  text;
  did bigint;
begin
  if not exists (select 1 from prep.lesson_plans where id = p_id and formats ? p_format and (published or prep.is_admin(u))) then
    raise exception 'not_found';
  end if;
  acc := prep.plan_access(u, p_id, p_format);
  if acc is null then raise exception 'plan_locked'; end if;
  select full_name into nm from prep.profiles where user_id = u;
  if nm is null then raise exception 'full_name_required'; end if;
  if (select count(*) from prep.plan_downloads where user_id = u and created_at > now() - interval '1 day') >= 30 then
    raise exception 'too_many_downloads';
  end if;
  insert into prep.plan_downloads (user_id, plan_id, format, full_name, via) values (u, p_id, p_format, nm, acc) returning id into did;
  return jsonb_build_object('id', did, 'full_name', nm, 'email', (select email from auth.users where id = u));
end $$;

-- ซื้อรายแผน (รูปแบบเดียว): ราคาจาก DB เท่านั้น (ไม่ใช้โค้ดส่วนลด/เครดิต)
create or replace function public.prep_submit_plan_order(p_plan int, p_format text, p_slip_path text, p_note text default null) returns int
language plpgsql security definer set search_path = '' as $$
declare
  u   uuid := prep.uid();
  p   prep.lesson_plans;
  oid int;
begin
  select * into p from prep.lesson_plans where id = p_plan and published and formats ? p_format;
  if not found then raise exception 'not_found'; end if;
  if prep.plan_access(u, p_plan, p_format) is not null then raise exception 'plan_owned'; end if;
  if p_slip_path is null or split_part(p_slip_path, '/', 1) <> u::text then raise exception 'invalid_slip'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'prep-slips' and o.name = p_slip_path) then
    raise exception 'invalid_slip';
  end if;
  if (select count(*) from prep.orders where user_id = u and status = 'pending') >= 3 then raise exception 'too_many_orders'; end if;
  if exists (select 1 from prep.orders where user_id = u and plan_id = p_plan and plan_format = p_format and status = 'pending') then
    raise exception 'plan_pending';
  end if;
  insert into prep.orders (user_id, package, term, amount, credit, slip_path, note, plan_id, plan_format)
  values (u, 'PLAN', 'item', p.price, 0, p_slip_path, nullif(left(trim(coalesce(p_note, '')), 300), ''), p_plan, p_format)
  returning id into oid;
  return oid;
end $$;

-- ---------- อนุมัติ: เพิ่มกรณีซื้อรายแผน (ส่วนอื่นยกมาจาก 20261110120000_prep_ops_agents.sql ทั้งหมด) ----------
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
  if o.package = 'PLAN' then
    insert into prep.plan_purchases (user_id, plan_id, format, order_id) values (o.user_id, o.plan_id, o.plan_format, o.id)
    on conflict (user_id, plan_id, format) do nothing;
    return jsonb_build_object('ok', true, 'status', 'approved', 'kind', 'plan', 'plan_id', o.plan_id, 'format', o.plan_format);
  end if;
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

-- ---------- รายการคำสั่งซื้อ: เพิ่มชื่อแผน ----------
create or replace function public.prep_my_orders() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := prep.uid();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', o.id, 'package', o.package, 'term', o.term, 'amount', o.amount, 'status', o.status, 'seats', o.seats, 'group_name', o.group_name,
             'admin_note', o.admin_note, 'created_at', o.created_at, 'reviewed_at', o.reviewed_at,
             'plan_id', o.plan_id, 'plan_title', prep.plan_label(o.plan_id, o.plan_format),
             'access_until', (select e.expires_at from prep.entitlements e where e.order_id = o.id limit 1))
           order by o.created_at desc)
      from (select * from prep.orders where user_id = u order by created_at desc limit 20) o), '[]'::jsonb);
end $$;

create or replace function public.prep_admin_orders(p_status text default 'pending', p_limit integer default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', o.id, 'email', au.email, 'package', o.package, 'term', o.term, 'amount', o.amount,
             'credit', o.credit, 'promo_code', o.promo_code, 'discount', o.discount, 'seats', o.seats, 'group_name', o.group_name,
             'list_price', coalesce((select pr.amount from prep.prices pr where pr.package = o.package and pr.term = o.term),
                                    (select lp.price from prep.lesson_plans lp where lp.id = o.plan_id)),
             'plan_title', prep.plan_label(o.plan_id, o.plan_format),
             'slip_path', o.slip_path, 'note', o.note, 'status', o.status, 'admin_note', o.admin_note,
             'created_at', o.created_at, 'reviewed_at', o.reviewed_at,
             'active_packages', to_jsonb(prep.active_packages(o.user_id)))
           order by case when o.status = 'pending' then o.created_at end asc, o.created_at desc)
      from (select * from prep.orders
             where p_status is null or status = p_status
             order by created_at desc limit greatest(1, least(coalesce(p_limit, 50), 200))) o
      left join auth.users au on au.id = o.user_id), '[]'::jsonb);
end $$;

-- ข้อมูลออเดอร์ให้ edge function ตรวจสลิป: เพิ่มชื่อแผน (ข้อความ LINE ถึงเจ้าของ)
create or replace function public.prep_ops_order(p_id integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', o.id, 'package', o.package, 'term', o.term, 'amount', o.amount, 'seats', o.seats,
                            'promo_code', o.promo_code, 'slip_path', o.slip_path, 'status', o.status,
                            'created_at', o.created_at, 'slip_checked_at', o.slip_checked_at,
                            'plan_title', prep.plan_label(o.plan_id, o.plan_format),
                            'email', (select u.email from auth.users u where u.id = o.user_id))
    from prep.orders o where o.id = p_id;
$$;

-- เผยแพร่ / ซ่อนแผน (แอดมิน)
create or replace function public.prep_admin_plan_publish(p_id int, p_on boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  update prep.lesson_plans set published = p_on, updated_at = now() where id = p_id;
  if not found then raise exception 'not_found'; end if;
  return p_on;
end $$;

-- ---------- สิทธิ์เรียกฟังก์ชัน (ไม่มี anon) ----------
do $$
declare f text;
begin
  for f in select unnest(array[
    'public.prep_lesson_plans()', 'public.prep_lesson_plan(integer,text)', 'public.prep_set_full_name(text)',
    'public.prep_admin_set_full_name(uuid,text)', 'public.prep_lesson_plan_download(integer,text)',
    'public.prep_submit_plan_order(integer,text,text,text)', 'public.prep_admin_plan_publish(integer,boolean)', 'public.prep_my_orders()', 'public.prep_admin_orders(text,integer)']) loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
