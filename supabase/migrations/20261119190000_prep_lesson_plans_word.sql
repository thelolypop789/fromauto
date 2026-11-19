-- แผนสำเร็จรูป: ไฟล์ Word
-- * แพ็กครบทุกภาค / แอดมิน = PDF + Word ทุกแผนทุกรูปแบบ
-- * ซื้อรายรูปแบบ: PDF = lesson_plans.price (69) · PDF + Word = lesson_plans.price_word (99)
--   มี PDF อยู่แล้วอัปเกรดเป็น Word ได้ จ่ายส่วนต่าง (price_word − price)
-- * plan_purchases.word = รูปแบบนี้โหลด Word ได้ · orders.plan_tier = 'pdf' | 'word' · plan_downloads.kind = 'pdf' | 'docx'

alter table prep.lesson_plans add column if not exists price_word int not null default 99;
alter table prep.lesson_plans drop constraint if exists lesson_plans_price_word_check;
alter table prep.lesson_plans add constraint lesson_plans_price_word_check check (price_word > price);
alter table prep.plan_purchases add column if not exists word boolean not null default false;
alter table prep.orders add column if not exists plan_tier text;
alter table prep.orders drop constraint if exists orders_plan_tier_check;
alter table prep.orders add constraint orders_plan_tier_check check (plan_tier is null or plan_tier in ('pdf', 'word'));
alter table prep.plan_downloads add column if not exists kind text not null default 'pdf';
alter table prep.plan_downloads drop constraint if exists plan_downloads_kind_check;
alter table prep.plan_downloads add constraint plan_downloads_kind_check check (kind in ('pdf', 'docx'));

-- โหลด Word ได้ไหม (รูปแบบหนึ่งของแผน)
create or replace function prep.plan_word(u uuid, p_plan int, p_format text) returns boolean
language sql stable set search_path = '' as $$
  select prep.plan_pack(u) is not null
      or exists (select 1 from prep.plan_purchases pp where pp.user_id = u and pp.plan_id = p_plan and pp.format = p_format and pp.word)
$$;
revoke execute on function prep.plan_word(uuid, int, text) from public;

create or replace function prep.plan_label(p_plan int, p_format text) returns text
language sql stable set search_path = '' as $$
  select lp.title || coalesce(' · ' || (lp.formats->p_format->>'name'), '') from prep.lesson_plans lp where lp.id = p_plan
$$;

-- ---------- รายการแผน: เพิ่มราคา Word และรูปแบบที่ซื้อ Word แล้ว ----------
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
               'periods', p.periods, 'minutes', p.minutes, 'summary', p.summary, 'price', p.price, 'price_word', p.price_word,
               'media_url', p.media_url,
               'formats', (select jsonb_agg(jsonb_build_object('key', f.key, 'name', f.value->>'name', 'full', f.value->>'full',
                                                               'desc', f.value->>'desc', 'steps', f.value->'steps')
                                            order by case f.key when 'phenobl' then 1 when 'active' then 2 when '5e' then 3 else 4 end)
                             from jsonb_each(p.formats) f),
               'published', p.published,
               'access', prep.plan_pack(u),
               'owned', coalesce((select jsonb_agg(pp.format) from prep.plan_purchases pp where pp.user_id = u and pp.plan_id = p.id), '[]'::jsonb),
               'owned_word', coalesce((select jsonb_agg(pp.format) from prep.plan_purchases pp where pp.user_id = u and pp.plan_id = p.id and pp.word), '[]'::jsonb),
               'pending', coalesce((select jsonb_agg(distinct o.plan_format) from prep.orders o
                                     where o.user_id = u and o.plan_id = p.id and o.status = 'pending'), '[]'::jsonb))
             order by p.grp, p.sort, p.id)
        from prep.lesson_plans p
       where p.published or prep.is_admin(u)), '[]'::jsonb));
end $$;

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
    'id', p.id, 'format', p_format, 'access', acc, 'word', prep.plan_word(u, p.id, p_format),
    'preview', f->'preview',
    'locked', case when acc is not null then f->'locked' end,
    'locked_blocks', jsonb_array_length(f->'locked'));
end $$;

-- ---------- โหลด: แยก PDF / Word ----------
drop function if exists public.prep_lesson_plan_download(integer, text);
create or replace function public.prep_lesson_plan_download(p_id int, p_format text, p_kind text default 'pdf') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u   uuid := prep.uid();
  acc text;
  nm  text;
  did bigint;
begin
  if p_kind not in ('pdf', 'docx') then raise exception 'not_found'; end if;
  if not exists (select 1 from prep.lesson_plans where id = p_id and formats ? p_format and (published or prep.is_admin(u))) then
    raise exception 'not_found';
  end if;
  acc := prep.plan_access(u, p_id, p_format);
  if acc is null then raise exception 'plan_locked'; end if;
  if p_kind = 'docx' and not prep.plan_word(u, p_id, p_format) then raise exception 'word_locked'; end if;
  select full_name into nm from prep.profiles where user_id = u;
  if nm is null then raise exception 'full_name_required'; end if;
  if (select count(*) from prep.plan_downloads where user_id = u and created_at > now() - interval '1 day') >= 30 then
    raise exception 'too_many_downloads';
  end if;
  insert into prep.plan_downloads (user_id, plan_id, format, full_name, via, kind) values (u, p_id, p_format, nm, acc, p_kind) returning id into did;
  return jsonb_build_object('id', did, 'full_name', nm, 'email', (select email from auth.users where id = u));
end $$;

-- ---------- ซื้อ: PDF / PDF + Word / อัปเกรดเป็น Word ----------
drop function if exists public.prep_submit_plan_order(integer, text, text, text);
create or replace function public.prep_submit_plan_order(p_plan int, p_format text, p_slip_path text, p_note text default null, p_tier text default 'pdf')
returns int
language plpgsql security definer set search_path = '' as $$
declare
  u    uuid := prep.uid();
  p    prep.lesson_plans;
  own  boolean;
  amt  int;
  oid  int;
begin
  if p_tier not in ('pdf', 'word') then raise exception 'not_found'; end if;
  select * into p from prep.lesson_plans where id = p_plan and published and formats ? p_format;
  if not found then raise exception 'not_found'; end if;
  own := prep.plan_access(u, p_plan, p_format) is not null;
  if p_tier = 'pdf' and own then raise exception 'plan_owned'; end if;
  if p_tier = 'word' and prep.plan_word(u, p_plan, p_format) then raise exception 'plan_owned'; end if;
  amt := case when p_tier = 'pdf' then p.price when own then p.price_word - p.price else p.price_word end;
  if p_slip_path is null or split_part(p_slip_path, '/', 1) <> u::text then raise exception 'invalid_slip'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'prep-slips' and o.name = p_slip_path) then
    raise exception 'invalid_slip';
  end if;
  if (select count(*) from prep.orders where user_id = u and status = 'pending') >= 3 then raise exception 'too_many_orders'; end if;
  if exists (select 1 from prep.orders where user_id = u and plan_id = p_plan and plan_format = p_format and status = 'pending') then
    raise exception 'plan_pending';
  end if;
  insert into prep.orders (user_id, package, term, amount, credit, slip_path, note, plan_id, plan_format, plan_tier)
  values (u, 'PLAN', 'item', amt, case when p_tier = 'word' and own then p.price else 0 end, p_slip_path,
          nullif(left(trim(coalesce(p_note, '')), 300), ''), p_plan, p_format, p_tier)
  returning id into oid;
  return oid;
end $$;

-- ---------- อนุมัติ: ซื้อ Word = ตั้ง word = true (อัปเกรดของเดิมได้) ส่วนอื่นเหมือน 20261119120000 ----------
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
    insert into prep.plan_purchases (user_id, plan_id, format, order_id, word)
    values (o.user_id, o.plan_id, o.plan_format, o.id, coalesce(o.plan_tier, 'pdf') = 'word')
    on conflict (user_id, plan_id, format) do update set word = prep.plan_purchases.word or excluded.word;
    return jsonb_build_object('ok', true, 'status', 'approved', 'kind', 'plan', 'plan_id', o.plan_id, 'format', o.plan_format,
                              'tier', coalesce(o.plan_tier, 'pdf'));
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

-- ชื่อแผนในรายการคำสั่งซื้อ: บอกว่าเป็น PDF หรือ PDF + Word
create or replace function prep.plan_order_label(o prep.orders) returns text
language sql stable set search_path = '' as $$
  select prep.plan_label(o.plan_id, o.plan_format)
         || case coalesce(o.plan_tier, 'pdf') when 'word' then case when o.credit > 0 then ' · เพิ่ม Word' else ' · PDF + Word' end else ' · PDF' end
$$;
revoke execute on function prep.plan_order_label(prep.orders) from public;

create or replace function public.prep_my_orders() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := prep.uid();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', o.id, 'package', o.package, 'term', o.term, 'amount', o.amount, 'status', o.status, 'seats', o.seats, 'group_name', o.group_name,
             'admin_note', o.admin_note, 'created_at', o.created_at, 'reviewed_at', o.reviewed_at,
             'plan_id', o.plan_id, 'plan_title', case when o.plan_id is not null then prep.plan_order_label(o) end,
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
                                    (select case when o.plan_tier = 'word' then lp.price_word else lp.price end from prep.lesson_plans lp where lp.id = o.plan_id)),
             'plan_title', case when o.plan_id is not null then prep.plan_order_label(o) end,
             'slip_path', o.slip_path, 'note', o.note, 'status', o.status, 'admin_note', o.admin_note,
             'created_at', o.created_at, 'reviewed_at', o.reviewed_at,
             'active_packages', to_jsonb(prep.active_packages(o.user_id)))
           order by case when o.status = 'pending' then o.created_at end asc, o.created_at desc)
      from (select * from prep.orders
             where p_status is null or status = p_status
             order by created_at desc limit greatest(1, least(coalesce(p_limit, 50), 200))) o
      left join auth.users au on au.id = o.user_id), '[]'::jsonb);
end $$;

create or replace function public.prep_ops_order(p_id integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', o.id, 'package', o.package, 'term', o.term, 'amount', o.amount, 'seats', o.seats,
                            'promo_code', o.promo_code, 'slip_path', o.slip_path, 'status', o.status,
                            'created_at', o.created_at, 'slip_checked_at', o.slip_checked_at,
                            'plan_title', case when o.plan_id is not null then prep.plan_order_label(o) end,
                            'email', (select u.email from auth.users u where u.id = o.user_id))
    from prep.orders o where o.id = p_id;
$$;

do $$
declare f text;
begin
  for f in select unnest(array[
    'public.prep_lesson_plans()', 'public.prep_lesson_plan(integer,text)', 'public.prep_lesson_plan_download(integer,text,text)',
    'public.prep_submit_plan_order(integer,text,text,text,text)', 'public.prep_my_orders()', 'public.prep_admin_orders(text,integer)']) loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
