-- Integridade transacional: submit/close, join idempotente, criação de rodada
-- e espelho público de eventos/sequências.
-- Aplicar após patch-2026-09-06-close-atomic-rpc-lockdown.sql.

-- ============================================================================
-- 1) O espelho público acompanha events na MESMA transação
-- ============================================================================

create or replace function sync_event_public_mirror() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public_events (
    event_id, slug, title, description, projector_title, status,
    require_live_code, is_daily_active, participant_count,
    current_open_round_id, sequence_id, sequence_order, sequence_size,
    sequence_root_event_id, sequence_root_slug, next_event_id,
    next_event_title, next_event_slug, updated_at
  ) values (
    new.id, new.slug, new.title, new.description, new.projector_title, new.status,
    new.require_live_code, new.is_daily_active, new.participant_count,
    new.current_open_round_id, new.sequence_id, new.sequence_order, new.sequence_size,
    new.sequence_root_event_id, new.sequence_root_slug, new.next_event_id,
    new.next_event_title, new.next_event_slug, new.updated_at
  )
  on conflict (event_id) do update set
    slug = excluded.slug,
    title = excluded.title,
    description = excluded.description,
    projector_title = excluded.projector_title,
    status = excluded.status,
    require_live_code = excluded.require_live_code,
    is_daily_active = excluded.is_daily_active,
    participant_count = excluded.participant_count,
    current_open_round_id = excluded.current_open_round_id,
    sequence_id = excluded.sequence_id,
    sequence_order = excluded.sequence_order,
    sequence_size = excluded.sequence_size,
    sequence_root_event_id = excluded.sequence_root_event_id,
    sequence_root_slug = excluded.sequence_root_slug,
    next_event_id = excluded.next_event_id,
    next_event_title = excluded.next_event_title,
    next_event_slug = excluded.next_event_slug,
    updated_at = excluded.updated_at;
  return new;
end;
$$;

drop trigger if exists events_sync_public_mirror on events;
create trigger events_sync_public_mirror
after insert or update on events
for each row execute function sync_event_public_mirror();

-- Corrige qualquer divergência anterior sem apagar campos públicos derivados
-- (título/status da rodada e access_challenge).
update events set updated_at = updated_at;

-- ============================================================================
-- 2) Join idempotente respeita a escolha de privacidade mais recente
-- ============================================================================

alter table participants add column if not exists client_token uuid;
create unique index if not exists participants_event_client_token_idx
  on participants (event_id, client_token)
  where client_token is not null;

drop function if exists join_event_participant(uuid, text, text, text, timestamptz);
drop function if exists join_event_participant(uuid, text, text, text, timestamptz, uuid);

create or replace function join_event_participant(
  p_event_id uuid, p_mode text, p_name text,
  p_session_token_hash text, p_session_expires_at timestamptz,
  p_client_token uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_participant_id uuid;
  v_inserted_id uuid;
  v_event_status text;
begin
  if p_mode not in ('identified', 'anonymous') then
    raise exception 'INVALID_PARTICIPANT_MODE';
  end if;
  if p_mode = 'anonymous' then
    p_name := null;
  end if;

  if p_client_token is not null then
    select id into v_participant_id
    from participants
    where event_id = p_event_id and client_token = p_client_token;
    if v_participant_id is not null then
      update participants
      set mode = p_mode,
          name = p_name,
          session_token_hash = p_session_token_hash,
          session_expires_at = p_session_expires_at,
          last_activity_at = now()
      where id = v_participant_id;
      return v_participant_id;
    end if;
  end if;

  select status into v_event_status from events where id = p_event_id;
  if v_event_status is null then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status <> 'open' then
    raise exception 'EVENT_NOT_OPEN';
  end if;

  insert into participants (
    event_id, mode, name, session_token_hash, session_expires_at, client_token
  )
  values (
    p_event_id, p_mode, p_name, p_session_token_hash, p_session_expires_at, p_client_token
  )
  on conflict (event_id, client_token) where client_token is not null do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    select id into v_participant_id
    from participants
    where event_id = p_event_id and client_token = p_client_token;

    update participants
    set mode = p_mode,
        name = p_name,
        session_token_hash = p_session_token_hash,
        session_expires_at = p_session_expires_at,
        last_activity_at = now()
    where id = v_participant_id;
    return v_participant_id;
  end if;

  update events
  set participant_count = participant_count + 1, updated_at = now()
  where id = p_event_id;

  return v_inserted_id;
end;
$$;

-- ============================================================================
-- 3) Submit/progresso compartilham lock com outros participantes, mas
--    serializam corretamente contra close_round_atomic (FOR UPDATE).
-- ============================================================================

create or replace function submit_answers(
  p_event_id uuid, p_round_id uuid, p_participant_id uuid, p_mode text, p_answers jsonb
) returns table (already_submitted boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_inserted_id uuid;
  v_pr_status text;
  v_was_new boolean;
  v_round_status text;
begin
  perform pg_advisory_xact_lock_shared(hashtextextended(p_round_id::text, 0));

  -- FOR KEY SHARE permite submissões concorrentes, mas conflita com o
  -- FOR UPDATE do encerramento. Quem obtiver o lock primeiro define o corte.
  select status into v_round_status
  from rounds
  where id = p_round_id and event_id = p_event_id
  for key share;
  if v_round_status is null then
    raise exception 'ROUND_NOT_FOUND';
  end if;
  if v_round_status <> 'open' then
    raise exception 'ROUND_NOT_OPEN';
  end if;

  select status into v_pr_status
  from participant_rounds
  where round_id = p_round_id and participant_id = p_participant_id
  for update;

  if v_pr_status = 'completed' then
    return query select true;
    return;
  end if;

  insert into submissions (event_id, round_id, participant_id, mode, answers)
  values (p_event_id, p_round_id, p_participant_id, p_mode, p_answers)
  on conflict (round_id, participant_id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    return query select true;
    return;
  end if;

  v_was_new := v_pr_status is null;

  insert into participant_rounds (
    event_id, round_id, participant_id, status, current_question,
    started_at, last_activity_at, completed_at
  )
  values (
    p_event_id, p_round_id, p_participant_id, 'completed',
    (select question_count from rounds where id = p_round_id),
    now(), now(), now()
  )
  on conflict (round_id, participant_id) do update
  set status = 'completed',
      current_question = excluded.current_question,
      last_activity_at = now(),
      completed_at = now();

  update participants set last_activity_at = now() where id = p_participant_id;

  if v_was_new then
    update rounds
    set completed_count = completed_count + 1,
        registered_count = registered_count + 1
    where id = p_round_id;
  else
    update rounds
    set completed_count = completed_count + 1,
        answering_count = greatest(answering_count - 1, 0)
    where id = p_round_id;
  end if;

  update public_round_stats prs
  set registered_count = r.registered_count,
      answering_count = r.answering_count,
      completed_count = r.completed_count,
      updated_at = now()
  from rounds r
  where prs.round_id = p_round_id and r.id = p_round_id;

  return query select false;
end;
$$;

create or replace function update_progress(
  p_event_id uuid, p_round_id uuid, p_participant_id uuid, p_current_question int
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_existing_status text;
  v_round_status text;
begin
  perform pg_advisory_xact_lock_shared(hashtextextended(p_round_id::text, 0));

  select status into v_round_status
  from rounds
  where id = p_round_id and event_id = p_event_id
  for key share;
  if v_round_status is null then
    raise exception 'ROUND_NOT_FOUND';
  end if;
  if v_round_status <> 'open' then
    raise exception 'ROUND_NOT_OPEN';
  end if;

  select status into v_existing_status
  from participant_rounds
  where round_id = p_round_id and participant_id = p_participant_id
  for update;

  if v_existing_status is null then
    insert into participant_rounds (
      event_id, round_id, participant_id, status, current_question,
      started_at, last_activity_at
    )
    values (
      p_event_id, p_round_id, p_participant_id, 'answering',
      p_current_question, now(), now()
    );

    update rounds
    set registered_count = registered_count + 1,
        answering_count = answering_count + 1
    where id = p_round_id;
  elsif v_existing_status <> 'completed' then
    update participant_rounds
    set status = 'answering',
        current_question = p_current_question,
        last_activity_at = now()
    where round_id = p_round_id and participant_id = p_participant_id;
  end if;

  update public_round_stats prs
  set registered_count = r.registered_count,
      answering_count = r.answering_count,
      completed_count = r.completed_count,
      updated_at = now()
  from rounds r
  where prs.round_id = p_round_id and r.id = p_round_id;
end;
$$;

-- ============================================================================
-- 4) Rodada + perguntas em uma transação
-- ============================================================================

create unique index if not exists rounds_event_order_unique
  on rounds (event_id, "order");

create or replace function create_round_content(
  p_event_id uuid, p_settings jsonb, p_questions jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_round_id uuid;
  v_next_order int;
  q jsonb;
  v_ordinality bigint;
begin
  perform 1 from events where id = p_event_id for update;
  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  select coalesce(max("order"), 0) + 1 into v_next_order
  from rounds where event_id = p_event_id;

  insert into rounds (
    event_id, title, description, "order", type, status,
    allow_new_participants, results_visibility, question_count
  )
  values (
    p_event_id,
    p_settings->>'title',
    nullif(p_settings->>'description', ''),
    v_next_order,
    p_settings->>'type',
    'draft',
    coalesce((p_settings->>'allowNewParticipants')::boolean, true),
    coalesce(p_settings->>'resultsVisibility', 'after_close'),
    jsonb_array_length(p_questions)
  )
  returning id into v_round_id;

  for q, v_ordinality in
    select value, ordinality
    from jsonb_array_elements(p_questions) with ordinality
  loop
    insert into questions (
      round_id, "order", type, title, explanation, required,
      options, max_length, max_selections
    )
    values (
      v_round_id,
      coalesce(nullif(q->>'order', '')::int, v_ordinality::int),
      q->>'type',
      q->>'title',
      nullif(q->>'explanation', ''),
      coalesce((q->>'required')::boolean, true),
      case when jsonb_typeof(q->'options') = 'array'
        then array(select jsonb_array_elements_text(q->'options'))
        else null
      end,
      nullif(q->>'maxLength', '')::int,
      nullif(q->>'maxSelections', '')::int
    );
  end loop;

  return v_round_id;
end;
$$;

-- ============================================================================
-- 5) Sequência inteira em uma transação
-- ============================================================================

create or replace function save_event_sequence_atomic(
  p_event_ids uuid[]
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
  v_distinct_count int;
  v_locked_sequence_count int;
  v_sequence_id uuid;
  v_locked_ids uuid[] := array[]::uuid[];
  v_editable_ids uuid[] := array[]::uuid[];
  v_docs uuid[];
  v_previous_sequence_ids uuid[];
  v_root_id uuid;
  v_root_slug text;
  v_next_id uuid;
  v_next_title text;
  v_next_slug text;
  i int;
begin
  v_count := coalesce(array_length(p_event_ids, 1), 0);
  if v_count < 2 or v_count > 50 then
    raise exception 'INVALID_SEQUENCE_SIZE';
  end if;

  select count(distinct event_id)::int into v_distinct_count
  from unnest(p_event_ids) as x(event_id);
  if v_distinct_count <> v_count then
    raise exception 'DUPLICATE_EVENT';
  end if;

  -- Ordem determinística evita deadlock entre duas reorganizações.
  perform 1 from events
  where id = any(p_event_ids)
  order by id
  for update;

  select count(*)::int into v_distinct_count
  from events where id = any(p_event_ids);
  if v_distinct_count <> v_count then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  select count(distinct sequence_id)::int into v_locked_sequence_count
  from events
  where id = any(p_event_ids)
    and status in ('open', 'closed')
    and sequence_id is not null;
  if v_locked_sequence_count > 1 then
    raise exception 'MULTIPLE_LOCKED_SEQUENCES';
  end if;

  select coalesce(array_agg(id order by sequence_order, id), array[]::uuid[])
  into v_locked_ids
  from events
  where id = any(p_event_ids) and status in ('open', 'closed');

  select coalesce(array_agg(e.id order by x.ord), array[]::uuid[])
  into v_editable_ids
  from unnest(p_event_ids) with ordinality as x(id, ord)
  join events e on e.id = x.id
  where e.status not in ('open', 'closed');

  v_docs := v_locked_ids || v_editable_ids;

  if coalesce(array_length(v_locked_ids, 1), 0) > 0 then
    select sequence_id into v_sequence_id
    from events where id = v_locked_ids[1];
  end if;
  v_sequence_id := coalesce(v_sequence_id, gen_random_uuid());

  select coalesce(array_agg(distinct sequence_id), array[]::uuid[])
  into v_previous_sequence_ids
  from events
  where id = any(p_event_ids) and sequence_id is not null;

  if coalesce(array_length(v_previous_sequence_ids, 1), 0) > 0 then
    perform 1 from events
    where sequence_id = any(v_previous_sequence_ids)
    order by id
    for update;

    update events
    set sequence_id = null,
        sequence_order = null,
        sequence_size = null,
        sequence_root_event_id = null,
        sequence_root_slug = null,
        next_event_id = null,
        next_event_title = null,
        next_event_slug = null,
        updated_at = now()
    where sequence_id = any(v_previous_sequence_ids)
      and not (id = any(v_docs))
      and status not in ('open', 'closed');
  end if;

  v_root_id := v_docs[1];
  select slug into v_root_slug from events where id = v_root_id;

  for i in 1..array_length(v_docs, 1) loop
    v_next_id := null;
    v_next_title := null;
    v_next_slug := null;
    if i < array_length(v_docs, 1) then
      v_next_id := v_docs[i + 1];
      select title, slug into v_next_title, v_next_slug
      from events where id = v_next_id;
    end if;

    update events
    set sequence_id = v_sequence_id,
        sequence_order = i - 1,
        sequence_size = array_length(v_docs, 1),
        sequence_root_event_id = v_root_id,
        sequence_root_slug = v_root_slug,
        next_event_id = v_next_id,
        next_event_title = v_next_title,
        next_event_slug = v_next_slug,
        is_daily_active = false,
        updated_at = now()
    where id = v_docs[i];
  end loop;

  return jsonb_build_object(
    'sequenceId', v_sequence_id,
    'rootEventId', v_root_id,
    'rootSlug', v_root_slug,
    'count', array_length(v_docs, 1)
  );
end;
$$;

-- ============================================================================
-- 6) Privilégios das novas/redefinidas RPCs
-- ============================================================================

revoke all on function sync_event_public_mirror() from public, anon, authenticated;
revoke all on function join_event_participant(uuid, text, text, text, timestamptz, uuid)
  from public, anon, authenticated;
revoke all on function submit_answers(uuid, uuid, uuid, text, jsonb)
  from public, anon, authenticated;
revoke all on function update_progress(uuid, uuid, uuid, int)
  from public, anon, authenticated;
revoke all on function create_round_content(uuid, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function save_event_sequence_atomic(uuid[])
  from public, anon, authenticated;

grant execute on function join_event_participant(uuid, text, text, text, timestamptz, uuid)
  to service_role;
grant execute on function submit_answers(uuid, uuid, uuid, text, jsonb)
  to service_role;
grant execute on function update_progress(uuid, uuid, uuid, int)
  to service_role;
grant execute on function create_round_content(uuid, jsonb, jsonb)
  to service_role;
grant execute on function save_event_sequence_atomic(uuid[])
  to service_role;
