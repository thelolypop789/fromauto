-- Questions whose topic was corrected after a set was built (e.g. 17 Thai-language questions moved out of A2-* into
-- B3-THAI) stayed in the set's frozen question_ids, so 111 custom sets kept serving them under the old subject and
-- users reported "คนละวิชา" again after the fix. A new round of a custom set now also drops questions whose current
-- topic is no longer one of the set's topics. Review sets (review_due / review_wrong) are built from the user's own
-- history across topics, so they keep the old rule. Same signature as 20261016140000_prep_phase0_guards.sql.

create or replace function public.prep_start_round(p_set uuid, p_mode text default 'full') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u    uuid := prep.uid();
  st   prep.sets;
  a_id uuid;
  qids int[];
begin
  select * into st from prep.sets where id = p_set and user_id = u for update;
  if not found then raise exception 'not_found'; end if;

  if not st.is_free and not prep.covers(prep.active_packages(u), st.topics) then
    raise exception 'pack_expired';
  end if;

  select id into a_id from prep.attempts where set_id = p_set and submitted_at is null;
  if found then return prep.round_payload(a_id); end if;

  if p_mode = 'wrong' then
    if st.last_wrong is null or cardinality(st.last_wrong) = 0 then
      raise exception 'nothing_wrong';
    end if;
    qids := st.last_wrong;
  else
    p_mode := 'full';
    qids := st.question_ids;
  end if;

  select array_agg(q.id order by random()) into qids
    from prep.questions q
   where q.id = any (qids) and q.status = 'approved'
     and (st.kind <> 'custom' or q.topic = any (st.topics));
  if qids is null or cardinality(qids) = 0 then
    raise exception '%', case when p_mode = 'wrong' then 'nothing_wrong' else 'not_enough_questions' end;
  end if;

  insert into prep.attempts (set_id, user_id, round_no, mode, question_ids, answers, correct)
  values (p_set, u, st.rounds + 1, p_mode, qids,
          array_fill(null::smallint, array[cardinality(qids)]),
          array_fill(null::boolean,  array[cardinality(qids)]))
  returning id into a_id;

  return prep.round_payload(a_id);
end $$;

revoke execute on function public.prep_start_round(uuid, text) from public, anon;
grant execute on function public.prep_start_round(uuid, text) to authenticated;
