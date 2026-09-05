-- CANÔNICO: join idempotente (client_token) + sem FOR UPDATE longo.
-- Aplique DEPOIS de qualquer patch que redefina join_event_participant
-- (ex.: reduce-lock-contention), senão a idempotência some.
--
-- Ordem recomendada de patches (docs/supabase-patches.md):
--   rate-limit → … → reduce-lock-contention → ESTE arquivo por último para join.

alter table public.participants add column if not exists client_token uuid;

create unique index if not exists participants_event_client_token_idx
  on public.participants (event_id, client_token)
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
  if p_client_token is not null then
    select id into v_participant_id
    from participants
    where event_id = p_event_id and client_token = p_client_token;
    if v_participant_id is not null then
      update participants
      set session_token_hash = p_session_token_hash,
          session_expires_at = p_session_expires_at,
          last_activity_at = now()
      where id = v_participant_id;
      return v_participant_id;
    end if;
  end if;

  -- Leitura simples (sem FOR UPDATE longo): só o UPDATE do contador serializa.
  select status into v_event_status from events where id = p_event_id;
  if v_event_status is null then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  -- Somente evento aberto aceita novos participantes (sala de espera no QR
  -- fixo antes do início).
  if v_event_status <> 'open' then
    raise exception 'EVENT_NOT_OPEN';
  end if;

  insert into participants (event_id, mode, name, session_token_hash, session_expires_at, client_token)
  values (p_event_id, p_mode, p_name, p_session_token_hash, p_session_expires_at, p_client_token)
  on conflict (event_id, client_token) where client_token is not null do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    select id into v_participant_id from participants where event_id = p_event_id and client_token = p_client_token;
    update participants
    set session_token_hash = p_session_token_hash, session_expires_at = p_session_expires_at, last_activity_at = now()
    where id = v_participant_id;
    return v_participant_id;
  end if;

  update events set participant_count = participant_count + 1 where id = p_event_id;
  update public_events set participant_count = participant_count + 1, updated_at = now() where event_id = p_event_id;

  return v_inserted_id;
end;
$$;
