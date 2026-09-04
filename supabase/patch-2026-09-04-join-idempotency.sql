-- Corrige join_event_participant para ser idempotente por evento+client_token.
--
-- Problema: se a resposta HTTP do POST /join se perder na rede (comum em
-- wifi/3G lotado de evento, ou timeout) DEPOIS que o servidor ja inseriu o
-- participante e tentou setar o cookie de sessao, o participante nunca
-- recebe o cookie. Ao tocar "Continuar" de novo (ou em caso de dois toques
-- quase simultaneos), o novo POST tambem nao tem cookie ainda, entao o
-- servidor nao acha "existing" e insere um SEGUNDO participante — inflando
-- participant_count e as contagens de rodada em todo lugar (dashboard,
-- projetor, relatorios).
--
-- Fix: o cliente gera um UUID por evento (localStorage) antes do primeiro
-- POST e reenvia o MESMO token em qualquer retry. A funcao vira idempotente
-- nesse token: usa ON CONFLICT pra lidar corretamente ate com duas chamadas
-- verdadeiramente concorrentes (mesma corrida que o cookie sozinho nao
-- resolve). client_token e opcional (coluna nullable, sem default) — quando
-- omitido, o comportamento e identico ao de antes.

alter table public.participants add column if not exists client_token uuid;

create unique index if not exists participants_event_client_token_idx
  on public.participants (event_id, client_token)
  where client_token is not null;

-- create or replace só substitui uma função com a MESMA assinatura de
-- parâmetros; como estamos acrescentando um parâmetro (p_client_token), sem
-- o drop primeiro ficariam duas versões (a antiga de 5 argumentos e a nova
-- de 6) sobrepostas no Postgres, gerando ambiguidade pro PostgREST.
drop function if exists join_event_participant(uuid, text, text, text, timestamptz);

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
      -- Ja existe um participante para esse token (join anterior cuja
      -- resposta se perdeu): so renova a sessao, sem inserir de novo nem
      -- incrementar contadores outra vez.
      update participants
      set session_token_hash = p_session_token_hash,
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
  if v_event_status not in ('open', 'waiting') then
    raise exception 'EVENT_NOT_OPEN';
  end if;

  insert into participants (event_id, mode, name, session_token_hash, session_expires_at, client_token)
  values (p_event_id, p_mode, p_name, p_session_token_hash, p_session_expires_at, p_client_token)
  on conflict (event_id, client_token) where client_token is not null do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    -- So chega aqui com client_token preenchido: corrida ganha por outra
    -- chamada concorrente com o mesmo token, que inseriu primeiro.
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
