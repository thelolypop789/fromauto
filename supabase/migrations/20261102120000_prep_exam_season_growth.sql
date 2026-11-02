-- เตรียมช่วงก่อน/หลังสอบครูผู้ช่วย 14–15 พ.ย. 2569 (จากการวิเคราะห์ funnel 2 พ.ย.)
-- 1) prep.quote: ALL รายรอบ อัปเกรดเป็น ALL ซื้อขาดจ่ายแค่ส่วนต่าง (เดิมต้องจ่ายเต็ม 179)
-- 2) event ใหม่ qr_view (เลื่อนมาเห็น QR) และ ref_share (กดแชร์ลิงก์ชวนเพื่อน) — หาให้เจอว่าคนเปิดหน้าซื้อแล้วหลุดตรงไหน
-- 3) ชุดฟรีโบนัส (profiles.free_sets_bonus) + ระบบชวนเพื่อน: เพื่อนสมัครผ่านลิงก์แล้วทำชุดแรกเสร็จ ได้ +1 ชุดทั้งคู่
-- 4) ถามผลสอบหลังวันสอบ (prep.exam_outcomes) เพื่อเสนอแพ็กซื้อขาดให้คนสอบรอบหน้า / ขอรีวิวคนที่ผ่าน
-- 5) ข้อความดึงกลับ (win-back) ถึงคนที่ใช้ชุดฟรีหมด ยังไม่ซื้อ และยังเข้าแอปช่วง 3 วันหลัง
-- ฟังก์ชันที่ redefine (quote, prep_me, prep_create_set, prep_track, prep_admin_pay_funnel) ยกมาจาก definition จริงบน DB ณ 2 พ.ย.

alter table prep.profiles add column if not exists free_sets_bonus int not null default 0;
alter table prep.profiles add column if not exists ref_code text unique;

CREATE OR REPLACE FUNCTION prep.quote(u uuid, p_pkg text, p_term text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $$
declare
  base    int;
  credit  int := 0;
  secs    text[];
  s       text;
  held    int;
  exp     timestamptz;
  all_own boolean := true;
  kind    text := 'new';
begin
  select amount into base from prep.prices where package = p_pkg and term = p_term;
  if base is null then return jsonb_build_object('error', 'invalid_package'); end if;
  secs := case p_pkg when 'ALL' then array['A', 'B'] else array[p_pkg] end;

  -- Everything the target grants is already owned for life?
  foreach s in array secs loop
    if not exists (select 1 from prep.entitlements e
                    where e.user_id = u and e.revoked_at is null and e.expires_at is null
                      and e.package in (s, 'ALL')) then
      all_own := false;
    end if;
  end loop;
  if all_own then return jsonb_build_object('error', 'already_owned'); end if;

  -- Credit: paid value of the entitlements of the same section that the target replaces.
  if p_pkg = 'ALL' or p_term = 'lifetime' then
    foreach s in array secs loop
      select max(case when e.expires_at is null
                      then (select amount from prep.prices where package = s and term = 'lifetime')
                      else (select amount from prep.prices where package = s and term = 'round') end)
        into held
        from prep.entitlements e
       where e.user_id = u and e.package = s and e.revoked_at is null
         and (e.expires_at is null or e.expires_at > now());
      credit := credit + coalesce(held, 0);
    end loop;
  end if;

  -- ALL รายรอบ → ALL ซื้อขาด: หักราคารายรอบที่จ่ายไปแล้ว (เดิมคิดเครดิตเฉพาะแพ็ก A/B ทำให้คนถือ ALL รายรอบต้องจ่ายเต็ม)
  if p_pkg = 'ALL' and p_term = 'lifetime' and exists (
       select 1 from prep.entitlements e
        where e.user_id = u and e.package = 'ALL' and e.revoked_at is null and e.expires_at > now()) then
    credit := greatest(credit, (select amount from prep.prices where package = 'ALL' and term = 'round'));
  end if;

  if base - credit < 20 then return jsonb_build_object('error', 'nothing_to_upgrade'); end if;

  if p_term = 'lifetime' then
    exp := null;
  elsif p_pkg = 'ALL' and credit > 0 then
    -- Upgrade of a running round: ends with the round it replaces.
    select max(e.expires_at) into exp from prep.entitlements e
     where e.user_id = u and e.package in ('A', 'B') and e.revoked_at is null and e.expires_at > now();
    if exp is null then return jsonb_build_object('error', 'nothing_to_upgrade'); end if;
    -- Already upgraded: an ALL entitlement covers that period, a second upgrade would add nothing.
    if exists (select 1 from prep.entitlements e
                where e.user_id = u and e.package = 'ALL' and e.revoked_at is null
                  and (e.expires_at is null or e.expires_at >= exp)) then
      return jsonb_build_object('error', 'already_owned');
    end if;
  else
    -- New or renewed round: 90 days, counted from the end of an active round of the same package.
    select greatest(now(), coalesce(max(e.expires_at), now())) + interval '90 days' into exp
      from prep.entitlements e
     where e.user_id = u and e.package = p_pkg and e.revoked_at is null and e.expires_at > now();
  end if;

  if credit > 0 then kind := 'upgrade';
  elsif exists (select 1 from prep.entitlements e
                 where e.user_id = u and e.package = p_pkg and e.revoked_at is null
                   and (e.expires_at is null or e.expires_at > now())) then kind := 'renew';
  end if;

  return jsonb_build_object('package', p_pkg, 'term', p_term, 'base', base, 'credit', credit,
                            'amount', base - credit, 'kind', kind, 'expires_at', exp);
end $$;

CREATE OR REPLACE FUNCTION public.prep_me()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  u    uuid := prep.uid();
  p    prep.profiles;
  pkgs text[];
begin
  p := prep.lock_profile(u);
  pkgs := prep.active_packages(u);
  return jsonb_build_object(
    'plan',            case when cardinality(pkgs) > 0 then 'paid' else 'free' end,
    'packages',        coalesce((
       select jsonb_agg(jsonb_build_object('package', package, 'expires_at', expires_at) order by package)
         from (select package, case when bool_or(expires_at is null) then null else max(expires_at) end as expires_at
                 from prep.entitlements
                where user_id = u and revoked_at is null and (expires_at is null or expires_at > now())
                group by package) x), '[]'::jsonb),
    'free_sets_used',  p.free_sets_used,
    'free_sets_limit', 3 + p.free_sets_bonus,
    'max_set_size',    case when cardinality(pkgs) > 0 then 200 else 40 end,
    'is_admin',        prep.is_admin(u),
    'answered_today',  coalesce((select d.answered from prep.daily_activity d
                                  where d.user_id = u and d.day = prep.today()), 0),
    'daily_cap',       prep.daily_cap(u)
  );
end $$;

CREATE OR REPLACE FUNCTION public.prep_create_set(p_topics text[], p_size integer, p_mode text DEFAULT 'new'::text, p_title text DEFAULT NULL::text, p_subtopics text[] DEFAULT NULL::text[], p_tag text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  u       uuid := prep.uid();
  p       prep.profiles;
  covered boolean;
  maxsize int;
  ids     int[];
  sid     uuid;
  n_sets  int;
  narrowed text[];   -- majors whose questions are limited to the chosen sub-topics
begin
  p := prep.lock_profile(u);                     -- row lock serialises the free quota
  -- Only topics of the user's track (สพฐ. / สอศ.) or shared by both; a set never mixes in the other track's topics.
  p_topics := array(select t.code from prep.topics t where t.code = any (coalesce(p_topics, '{}'))
                       and (t.track is null or t.track = coalesce(p.track, 'obec')));
  if p_topics is null or cardinality(p_topics) = 0 then
    raise exception 'no_topics';
  end if;
  covered := prep.covers(prep.active_packages(u), p_topics);
  maxsize := case when covered then 200 else 40 end;
  if p_size is null or p_size < 5 or p_size > maxsize then
    raise exception 'invalid_size';
  end if;
  if not covered and p.free_sets_used >= 3 + p.free_sets_bonus then
    raise exception 'free_quota_exceeded';
  end if;
  if p_mode not in ('new', 'weak', 'mixed') then
    raise exception 'invalid_mode';
  end if;
  select coalesce(array_agg(distinct s.topic), '{}') into narrowed
    from prep.subtopics s where s.code = any (coalesce(p_subtopics, '{}')) and s.topic = any (p_topics);

  select array_agg(x.id) into ids
  from (
    select q.id
    from prep.questions q
    left join prep.user_question_state s on s.user_id = u and s.question_id = q.id
    where q.status = 'approved' and q.topic = any (p_topics)
      and (q.topic <> all (narrowed) or q.subtopic = any (p_subtopics))
      and (p_tag is null or q.exam_tag like p_tag || '%')
    order by
      case p_mode
        when 'new'  then case when s.question_id is null then 0 else 1 end
        when 'weak' then case when s.last_correct = false then 0
                              when s.question_id is null then 1 else 2 end
        else 0
      end,
      case when p_mode = 'weak' then -coalesce(s.wrong, 0) else 0 end,
      random()
    limit p_size
  ) x;

  if ids is null or cardinality(ids) < 5 then
    raise exception 'not_enough_questions';
  end if;

  select count(*) into n_sets from prep.sets where user_id = u;

  insert into prep.sets (user_id, title, topics, question_ids, is_free)
  values (u,
          coalesce(nullif(left(trim(p_title), 80), ''), 'ชุดที่ ' || (n_sets + 1)),
          p_topics, ids, not covered)
  returning id into sid;

  if not covered then
    update prep.profiles set free_sets_used = free_sets_used + 1 where user_id = u;
  end if;

  return sid;
end $$;

CREATE OR REPLACE FUNCTION public.prep_track(p_name text, p_props jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  u   uuid := prep.uid();
  v_src text;
begin
  if p_name not in ('visit', 'buy_view', 'free_limit', 'level_view', 'readiness_view', 'subtopic_pick', 'promo_apply', 'scoredist_view', 'board_view',
                    'install_view', 'install_click', 'install_done', 'summary_view',
                    'paywall_click', 'pkg_select', 'qr_save', 'slip_pick', 'slip_fail',
                    'qr_view', 'ref_share') then
    raise exception 'invalid_event';
  end if;
  perform prep.lock_profile(u);
  if p_name = 'visit' then
    v_src := nullif(left(regexp_replace(lower(coalesce(p_props->>'src', '')), '[^a-z0-9_-]', '', 'g'), 40), '');
    if v_src is not null then update prep.profiles set src = v_src where user_id = u and profiles.src is null; end if;
  end if;
  insert into prep.events (user_id, name, props)
  values (u, p_name, case when p_name = 'visit' and v_src is not null then jsonb_build_object('src', v_src) else '{}'::jsonb end)
  on conflict (user_id, name, day) do nothing;
end $$;

CREATE OR REPLACE FUNCTION public.prep_admin_pay_funnel(p_days integer DEFAULT 14, p_track text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  d0 date := prep.today() - (least(greatest(coalesce(p_days, 14), 1), 90) - 1);
  t0 timestamptz := d0::timestamp at time zone 'Asia/Bangkok';
  ev jsonb;
begin
  perform prep.require_admin();
  select coalesce(jsonb_object_agg(name, n), '{}'::jsonb) into ev
    from (select name, count(distinct user_id) n from prep.events
           where day >= d0 and prep.in_track(user_id, p_track)
             and name in ('free_limit', 'paywall_click', 'buy_view', 'pkg_select', 'qr_view', 'qr_save', 'slip_pick', 'slip_fail')
           group by name) x;
  return jsonb_build_object(
    'since', d0,
    'events', ev,
    'submitted', (select count(distinct user_id) from prep.orders where created_at >= t0 and prep.in_track(user_id, p_track)),
    'approved',  (select count(distinct user_id) from prep.orders where created_at >= t0 and status = 'approved' and prep.in_track(user_id, p_track)),
    -- of the people who hit the free limit in the window: how many opened the buy screen, and how many bought
    'wall', (select jsonb_build_object(
               'n', count(*),
               'viewed', count(*) filter (where exists (select 1 from prep.events b where b.user_id = w.user_id and b.name = 'buy_view' and b.day >= w.day)),
               'bought', count(*) filter (where exists (select 1 from prep.orders o where o.user_id = w.user_id and o.status = 'approved')))
             from (select user_id, min(day) as day from prep.events where name = 'free_limit' and day >= d0 and prep.in_track(user_id, p_track) group by user_id) w)
  );
end $$;

-- ---------- ชวนเพื่อน ----------
create table if not exists prep.referrals (
  referee     uuid primary key references auth.users(id) on delete cascade,
  referrer    uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  rewarded_at timestamptz,
  check (referee <> referrer)
);
create index if not exists referrals_referrer on prep.referrals (referrer);
alter table prep.referrals enable row level security;   -- ไม่มี policy: เข้าถึงผ่าน RPC เท่านั้น

-- โค้ดชวนของฉัน (สร้างครั้งแรกที่เปิด) + สถิติ
create or replace function public.prep_my_referral() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := prep.uid();
  p prep.profiles := prep.lock_profile(u);
  c text := p.ref_code;
begin
  while c is null loop
    c := upper(substr(translate(encode(extensions.gen_random_bytes(8), 'base64'), '+/=0O1IL', ''), 1, 6));
    if length(c) < 6 or exists (select 1 from prep.profiles where ref_code = c) then c := null; continue; end if;
    update prep.profiles set ref_code = c where user_id = u;
  end loop;
  return jsonb_build_object(
    'code', c,
    'invited',  (select count(*) from prep.referrals where referrer = u),
    'rewarded', (select count(*) from prep.referrals where referrer = u and rewarded_at is not null),
    'cap', 10,
    'bonus', p.free_sets_bonus);
end $$;

-- เรียกหลังล็อกอินเมื่อเปิดลิงก์ ?ref= มา: ผูกได้ครั้งเดียว เฉพาะบัญชีใหม่ (สมัครไม่เกิน 3 วันและยังไม่เคยส่งชุดไหน)
create or replace function public.prep_claim_referral(p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := prep.uid();
  p prep.profiles := prep.lock_profile(u);
  r uuid;
begin
  select user_id into r from prep.profiles where ref_code = upper(trim(coalesce(p_code, '')));
  if r is null then return 'bad_code'; end if;
  if r = u then return 'self'; end if;
  if exists (select 1 from prep.referrals where referee = u) then return 'already'; end if;
  if p.created_at < now() - interval '3 days'
     or exists (select 1 from prep.attempts where user_id = u and submitted_at is not null) then return 'not_new'; end if;
  insert into prep.referrals (referee, referrer) values (u, r) on conflict do nothing;
  return 'ok';
end $$;

-- รางวัล: เมื่อเพื่อนที่ถูกชวนส่งชุดแรก ได้ +1 ชุดฟรีทั้งคู่ (ผู้ชวนได้สูงสุด 10 ครั้ง) และแจ้งผู้ชวนในแอป
create or replace function prep.referral_reward() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r uuid;
begin
  update prep.referrals set rewarded_at = now()
   where referee = new.user_id and rewarded_at is null
  returning referrer into r;
  if r is null then return null; end if;
  update prep.profiles set free_sets_bonus = free_sets_bonus + 1 where user_id = new.user_id;
  if (select count(*) from prep.referrals where referrer = r and rewarded_at is not null) <= 10 then
    update prep.profiles set free_sets_bonus = free_sets_bonus + 1 where user_id = r;
    insert into prep.notifications (user_id, kind, title, body)
    values (r, 'referral', 'เพื่อนที่คุณชวนเริ่มซ้อมแล้ว', 'ได้ชุดฟรีเพิ่ม 1 ชุด ขอบคุณที่ชวนเพื่อนมาซ้อมด้วยกัน');
  end if;
  return null;
end $$;
drop trigger if exists attempts_referral_reward on prep.attempts;
create trigger attempts_referral_reward after update of submitted_at on prep.attempts
  for each row when (old.submitted_at is null and new.submitted_at is not null)
  execute function prep.referral_reward();

-- ---------- ผลสอบหลังวันสอบ ----------
create table if not exists prep.exam_outcomes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  event_id   int  not null references prep.exam_events(id) on delete cascade,
  result     text not null check (result in ('pass', 'unsure', 'fail')),
  updated_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
alter table prep.exam_outcomes enable row level security;

-- วันสอบล่าสุดที่ผ่านไปแล้วไม่เกิน 45 วัน + คำตอบของฉัน; null ถ้าไม่ต้องถาม (บัญชีสมัครหลังวันสอบ)
-- คำตอบ "รอลุ้นผล" ถามซ้ำได้หลัง 14 วัน
create or replace function public.prep_exam_followup() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  u  uuid := prep.uid();
  ev prep.exam_events;
  o  prep.exam_outcomes;
  today date := prep.today();
begin
  select * into ev from prep.exam_events
   where published and kind = 'exam' and coalesce(ends_on, starts_on) < today and coalesce(ends_on, starts_on) >= today - 45
   order by coalesce(ends_on, starts_on) desc, id desc limit 1;
  if ev.id is null then return null; end if;
  -- สอบหลายวันติดกัน (ภาค ก เสาร์ / ภาค ข อาทิตย์): รอให้ครบทุกวันก่อนค่อยถาม
  if exists (select 1 from prep.exam_events where published and kind = 'exam' and starts_on between today and today + 3) then return null; end if;
  if (select created_at from prep.profiles where user_id = u) >= (ev.starts_on::timestamp at time zone 'Asia/Bangkok') then return null; end if;
  select * into o from prep.exam_outcomes where user_id = u and event_id = ev.id;
  return jsonb_build_object('event_id', ev.id, 'title', ev.title, 'date', coalesce(ev.ends_on, ev.starts_on),
    'result', o.result,
    'ask', o.result is null or (o.result = 'unsure' and o.updated_at < now() - interval '14 days'));
end $$;

create or replace function public.prep_set_exam_outcome(p_event int, p_result text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.uid();
begin
  if p_result not in ('pass', 'unsure', 'fail') then raise exception 'bad_choice'; end if;
  if not exists (select 1 from prep.exam_events where id = p_event and published and kind = 'exam') then raise exception 'not_found'; end if;
  insert into prep.exam_outcomes (user_id, event_id, result) values (u, p_event, p_result)
  on conflict (user_id, event_id) do update set result = excluded.result, updated_at = now();
end $$;

create or replace function public.prep_admin_exam_outcomes() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return coalesce((select jsonb_agg(x) from (
    select e.id, e.title, e.starts_on,
           count(*) filter (where o.result = 'pass') pass,
           count(*) filter (where o.result = 'unsure') unsure,
           count(*) filter (where o.result = 'fail') fail
      from prep.exam_outcomes o join prep.exam_events e on e.id = o.event_id
     group by e.id order by e.starts_on desc) x), '[]'::jsonb);
end $$;

-- ---------- win-back ----------
-- กลุ่มเป้าหมาย: ใช้ชุดฟรีครบ, ไม่มีแพ็กที่ใช้งานได้, เข้าแอปใน 3 วันล่าสุด, ยังไม่ได้ข้อความ win-back ใน 7 วัน, ไม่ใช่แอดมิน
create or replace function prep.winback_targets() returns setof uuid
language sql stable set search_path = '' as $$
  select p.user_id from prep.profiles p
   where p.free_sets_used >= 3 + p.free_sets_bonus
     and cardinality(prep.active_packages(p.user_id)) = 0
     and not prep.is_admin(p.user_id)
     and exists (select 1 from prep.presence_log l where l.user_id = p.user_id and l.bucket >= now() - interval '3 days')
     and not exists (select 1 from prep.notifications n where n.user_id = p.user_id and n.kind = 'winback' and n.created_at >= now() - interval '7 days')
$$;

-- p_send = false: นับจำนวนอย่างเดียว
create or replace function public.prep_admin_winback(p_title text, p_body text, p_send boolean default false) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform prep.require_admin();
  if not p_send then return (select count(*) from prep.winback_targets()); end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_body), '') = '' then raise exception 'bad_input'; end if;
  insert into prep.notifications (user_id, kind, title, body)
  select t, 'winback', left(trim(p_title), 120), left(trim(p_body), 1000) from prep.winback_targets() t;
  get diagnostics n = row_count;
  return n;
end $$;

-- ข้อความ win-back ล่าสุดที่ยังไม่อ่าน (แสดงเป็นการ์ดในหน้าแรก) / ปิดการ์ด
create or replace function public.prep_my_promo_notice() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', id, 'title', title, 'body', body) from prep.notifications
   where user_id = prep.uid() and kind = 'winback' and read_at is null
   order by created_at desc limit 1
$$;
create or replace function public.prep_dismiss_notice(p_id int) returns void
language sql security definer set search_path = '' as $$
  update prep.notifications set read_at = now() where id = p_id and user_id = prep.uid() and read_at is null
$$;

do $$
declare f text;
begin
  for f in select unnest(array[
      'public.prep_my_referral()', 'public.prep_claim_referral(text)',
      'public.prep_exam_followup()', 'public.prep_set_exam_outcome(integer,text)', 'public.prep_admin_exam_outcomes()',
      'public.prep_admin_winback(text,text,boolean)', 'public.prep_my_promo_notice()', 'public.prep_dismiss_notice(integer)']) loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  revoke execute on function prep.referral_reward() from public, anon, authenticated;
  revoke execute on function prep.winback_targets() from public, anon, authenticated;
end $$;
