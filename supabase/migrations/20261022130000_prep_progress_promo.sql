-- Four learner-facing additions:
--  1. prep_progress(): XP (for levels) and streaks, computed from history that already exists (no new tables).
--  2. prep_readiness(): estimated exam score from topic accuracy weighted by the mock-exam blueprint (prep.mock_quota).
--  3. prep_mock_scorecard(): best / latest mock score per subject and totals per section (ภาค ก / ภาค ข).
--  4. Promo codes customers type at checkout: prep.promo_codes, two columns on prep.orders, admin RPCs, a price check,
--     and prep_submit_order / prep_admin_orders replaced to carry the code (same behaviour when no code is given).

-- ---------- 1. progress ----------
-- XP = answers + correct answers + 20 per finished daily quiz + 50 per submitted mock exam. Levels are named in the app.
create function public.prep_progress() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  u     uuid := prep.uid();
  today date := prep.today();
begin
  return (
    with days as (select day from prep.daily_activity where user_id = u and answered > 0),
         runs as (select day, day - (row_number() over (order by day))::int as grp from days),
         lens as (select grp, count(*)::int as n, max(day) as last from runs group by grp)
    select jsonb_build_object(
      'answered', coalesce((select sum(answered) from prep.daily_activity where user_id = u), 0),
      'correct',  coalesce((select sum(correct)  from prep.daily_activity where user_id = u), 0),
      'daily_done', (select count(*) from prep.daily_answers x where x.user_id = u
                        and not exists (select 1 from unnest(x.answers) v where v is null)),
      'mocks', (select count(*) from prep.mock_attempts where user_id = u and submitted_at is not null),
      'xp', coalesce((select sum(answered + correct) from prep.daily_activity where user_id = u), 0)
            + 20 * (select count(*) from prep.daily_answers x where x.user_id = u
                      and not exists (select 1 from unnest(x.answers) v where v is null))
            + 50 * (select count(*) from prep.mock_attempts where user_id = u and submitted_at is not null),
      'streak', coalesce((select n from lens where last >= today - 1 order by last desc limit 1), 0),
      'best_streak', coalesce((select max(n) from lens), 0),
      'active_days', (select count(*) from days),
      'practiced_today', exists (select 1 from days where day = today)));
end $$;

-- ---------- 2. readiness ----------
-- Each blueprint topic's accuracy is shrunk toward guessing (25%) with the weight of 5 answers, so a topic with
-- 2 answers cannot read 100%. Subject % = blueprint-weighted mean; section % = subjects weighted by question count.
-- The user's major fills the '*MAJOR*' slot; without a major that subject is left out (has_major = false).
create function public.prep_readiness() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  u     uuid := prep.uid();
  major text := (select p.major from prep.profiles p where p.user_id = u);
begin
  return (
    with q as (
      select s.code as subject, s.name as subject_name, s.section, s.questions, s.sort,
             case when m.topic = '*MAJOR*' then major else m.topic end as topic, m.n as w
        from prep.mock_subjects s join prep.mock_quota m on m.subject = s.code),
    t as (
      select q.*, tp.name as topic_name, coalesce(st.n, 0) as n, coalesce(st.correct, 0) as correct,
             (coalesce(st.correct, 0) + 1.25) / (coalesce(st.n, 0) + 5.0) as acc
        from q join prep.topics tp on tp.code = q.topic
        left join prep.user_topic_stats st on st.user_id = u and st.topic = q.topic),
    subj as (
      select subject, subject_name, section, questions, sort,
             round(100 * sum(w * acc) / sum(w), 1) as pct, sum(n)::int as n
        from t group by subject, subject_name, section, questions, sort),
    sec as (
      select section, round(sum(questions * pct) / sum(questions), 1) as pct, sum(n)::int as n, count(*) as subjects
        from subj group by section)
    select jsonb_build_object(
      'has_major', major is not null,
      'answered', coalesce((select sum(n) from sec), 0),
      'overall', (select round(sum(s2.questions * s2.pct) / nullif(sum(s2.questions), 0), 1) from subj s2),
      'sections', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'section', sec.section, 'pct', sec.pct, 'n', sec.n,
                 'subjects', (select jsonb_agg(jsonb_build_object('code', subject, 'name', subject_name, 'questions', questions,
                                                                 'pct', pct, 'n', n) order by sort)
                                from subj where subj.section = sec.section))
               order by sec.section) from sec), '[]'::jsonb),
      -- Where practice pays most: topics still under 60% first, then questions the topic carries x share still missed.
      'focus', coalesce((
        select jsonb_agg(f.item order by f.rk)
          from (select jsonb_build_object('code', topic, 'name', topic_name, 'subject', subject_name, 'w', w,
                                          'pct', round(100 * acc), 'n', n) as item,
                       row_number() over (order by acc < 0.6 desc, w * (1 - acc) desc) as rk
                  from t) f where f.rk <= 3), '[]'::jsonb)));
end $$;

-- ---------- 3. mock scorecard ----------
create function public.prep_mock_scorecard() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := prep.uid();
begin
  return (
    with a as (
      select x.subject, x.score, cardinality(x.question_ids) as total, x.submitted_at,
             round(100.0 * x.score / greatest(cardinality(x.question_ids), 1))::int as pct
        from prep.mock_attempts x
       where x.user_id = u and x.submitted_at is not null and x.score is not null),
    s as (
      select m.code, m.name, m.section, m.questions, m.sort,
             (select max(a.score) from a where a.subject = m.code) as best,
             (select a.score from a where a.subject = m.code order by a.submitted_at desc limit 1) as last,
             (select max(a.submitted_at) from a where a.subject = m.code) as last_at,
             (select count(*) from a where a.subject = m.code) as tries,
             coalesce((select jsonb_agg(h.pct order by h.submitted_at)
                         from (select * from a where a.subject = m.code order by a.submitted_at desc limit 8) h), '[]'::jsonb) as history
        from prep.mock_subjects m)
    select jsonb_build_object('sections', coalesce((
      select jsonb_agg(jsonb_build_object(
               'section', g.section,
               'questions', g.questions,
               'best_sum', g.best_sum,
               'done', g.done, 'subjects_n', g.n,
               'subjects', (select jsonb_agg(jsonb_build_object('code', code, 'name', name, 'questions', questions, 'best', best,
                                                                'last', last, 'last_at', last_at, 'tries', tries, 'history', history)
                                             order by sort)
                              from s where s.section = g.section))
             order by g.section)
        from (select section, sum(questions)::int as questions, coalesce(sum(best), 0)::int as best_sum,
                     count(*) filter (where tries > 0) as done, count(*) as n
                from s group by section) g), '[]'::jsonb)));
end $$;

-- ---------- 4. promo codes ----------
create table prep.promo_codes (
  code       text primary key check (code ~ '^[A-Z0-9_-]{3,30}$'),
  kind       text not null check (kind in ('percent', 'amount')),
  value      int  not null check (value > 0),
  packages   text[],                        -- null = every package
  max_uses   int check (max_uses is null or max_uses > 0),
  expires_at timestamptz,
  active     boolean not null default true,
  note       text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (kind <> 'percent' or value <= 90)
);
alter table prep.promo_codes enable row level security;

alter table prep.orders add column promo_code text references prep.promo_codes(code) on update cascade,
                        add column discount   int not null default 0;

-- Price for this user with a code, or {error}. A code counts as used by pending and approved orders (a rejected
-- order frees it), once per user. The price never drops below 1 baht (give free access with a key instead).
create function prep.promo_quote(u uuid, p_code text, p_pkg text, p_term text, p_lock boolean default false) returns jsonb
language plpgsql set search_path = '' as $$
declare
  c    prep.promo_codes;
  q    jsonb;
  base int;
  d    int;
begin
  if p_lock then
    select * into c from prep.promo_codes where code = upper(trim(p_code)) for update;
  else
    select * into c from prep.promo_codes where code = upper(trim(p_code));
  end if;
  if not found then return jsonb_build_object('error', 'promo_not_found'); end if;
  if not c.active then return jsonb_build_object('error', 'promo_inactive'); end if;
  if c.expires_at is not null and c.expires_at < now() then return jsonb_build_object('error', 'promo_expired'); end if;
  if c.packages is not null and not (p_pkg = any (c.packages)) then return jsonb_build_object('error', 'promo_not_for_package'); end if;
  if exists (select 1 from prep.orders o where o.user_id = u and o.promo_code = c.code and o.status in ('pending', 'approved')) then
    return jsonb_build_object('error', 'promo_already_used');
  end if;
  if c.max_uses is not null
     and (select count(*) from prep.orders o where o.promo_code = c.code and o.status in ('pending', 'approved')) >= c.max_uses then
    return jsonb_build_object('error', 'promo_used_up');
  end if;
  q := prep.quote(u, p_pkg, p_term);
  if q ? 'error' then return q; end if;
  base := (q->>'amount')::int;
  d := case when c.kind = 'percent' then round(base * c.value / 100.0)::int else c.value end;
  d := least(d, base - 1);
  return q || jsonb_build_object('code', c.code, 'kind', c.kind, 'value', c.value, 'before', base,
                                 'discount', d, 'amount', base - d);
end $$;

create function public.prep_check_promo(p_code text, p_package text, p_term text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  return prep.promo_quote(prep.uid(), p_code, p_package, p_term);
end $$;

drop function public.prep_submit_order(text, text, integer, text, text);
create function public.prep_submit_order(p_package text, p_term text, p_amount integer, p_slip_path text,
                                         p_note text default null, p_promo text default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare u uuid := prep.uid(); oid int; q jsonb;
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
  if nullif(trim(coalesce(p_promo, '')), '') is null then
    q := prep.quote(u, p_package, p_term);
  else
    q := prep.promo_quote(u, p_promo, p_package, p_term, true);   -- row lock: two buyers cannot pass max_uses together
  end if;
  if q ? 'error' then raise exception '%', q->>'error'; end if;
  insert into prep.orders (user_id, package, term, amount, credit, slip_path, note, promo_code, discount)
  values (u, p_package, p_term, (q->>'amount')::int, (q->>'credit')::int, p_slip_path,
          nullif(left(trim(coalesce(p_note, '')), 300), ''), q->>'code', coalesce((q->>'discount')::int, 0))
  returning id into oid;
  return oid;
end $$;

-- Same as before plus promo_code / discount.
create or replace function public.prep_admin_orders(p_status text default 'pending', p_limit integer default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', o.id, 'email', au.email, 'package', o.package, 'term', o.term, 'amount', o.amount,
             'credit', o.credit, 'promo_code', o.promo_code, 'discount', o.discount,
             'list_price', (select pr.amount from prep.prices pr where pr.package = o.package and pr.term = o.term),
             'slip_path', o.slip_path, 'note', o.note, 'status', o.status, 'admin_note', o.admin_note,
             'created_at', o.created_at, 'reviewed_at', o.reviewed_at,
             'active_packages', to_jsonb(prep.active_packages(o.user_id)))
           order by case when o.status = 'pending' then o.created_at end asc, o.created_at desc)
      from (select * from prep.orders
             where p_status is null or status = p_status
             order by created_at desc limit greatest(1, least(coalesce(p_limit, 50), 200))) o
      left join auth.users au on au.id = o.user_id), '[]'::jsonb);
end $$;

create function public.prep_admin_promo_list() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'code', c.code, 'kind', c.kind, 'value', c.value, 'packages', c.packages, 'max_uses', c.max_uses,
             'expires_at', c.expires_at, 'active', c.active, 'note', c.note, 'created_at', c.created_at,
             'pending', (select count(*) from prep.orders o where o.promo_code = c.code and o.status = 'pending'),
             'approved', (select count(*) from prep.orders o where o.promo_code = c.code and o.status = 'approved'),
             'revenue', coalesce((select sum(o.amount) from prep.orders o where o.promo_code = c.code and o.status = 'approved'), 0),
             'discount', coalesce((select sum(o.discount) from prep.orders o where o.promo_code = c.code and o.status = 'approved'), 0))
           order by c.active desc, c.created_at desc)
      from prep.promo_codes c), '[]'::jsonb);
end $$;

create function public.prep_admin_promo_create(p_code text, p_kind text, p_value int, p_packages text[] default null,
                                               p_max_uses int default null, p_expires_on date default null,
                                               p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a uuid := prep.require_admin(); c text := upper(trim(coalesce(p_code, '')));
begin
  if c !~ '^[A-Z0-9_-]{3,30}$' then raise exception 'promo_bad_code'; end if;
  if p_kind not in ('percent', 'amount') or coalesce(p_value, 0) <= 0 or (p_kind = 'percent' and p_value > 90) then
    raise exception 'promo_bad_value';
  end if;
  if p_packages is not null and (cardinality(p_packages) = 0 or not p_packages <@ array['A', 'B', 'ALL']) then
    raise exception 'invalid_package';
  end if;
  if exists (select 1 from prep.promo_codes where code = c) then raise exception 'promo_exists'; end if;
  insert into prep.promo_codes (code, kind, value, packages, max_uses, expires_at, note, created_by)
  values (c, p_kind, p_value, p_packages, p_max_uses,
          case when p_expires_on is null then null
               else ((p_expires_on + 1)::timestamp at time zone 'Asia/Bangkok') end,   -- valid through that Thai day
          nullif(left(trim(coalesce(p_note, '')), 200), ''), a);
  return jsonb_build_object('code', c);
end $$;

create function public.prep_admin_promo_set_active(p_code text, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform prep.require_admin();
  update prep.promo_codes set active = p_active where code = p_code;
  if not found then raise exception 'not_found'; end if;
end $$;

revoke execute on function prep.promo_quote(uuid, text, text, text, boolean) from public;
do $$
declare f text;
begin
  for f in select unnest(array[
      'public.prep_progress()', 'public.prep_readiness()', 'public.prep_mock_scorecard()',
      'public.prep_check_promo(text,text,text)', 'public.prep_submit_order(text,text,integer,text,text,text)',
      'public.prep_admin_orders(text,integer)', 'public.prep_admin_promo_list()',
      'public.prep_admin_promo_create(text,text,integer,text[],integer,date,text)',
      'public.prep_admin_promo_set_active(text,boolean)']) loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
