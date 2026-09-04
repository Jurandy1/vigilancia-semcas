-- Defesa em profundidade nos RPCs: nao confiar so na camada web.
--
-- 4 mudancas neste patch (todas idempotentes, seguras para rodar num sistema
-- em uso — CREATE OR REPLACE / DROP + CREATE):
--
--   1) submit_answers passa a exigir rounds.status = 'open'. Antes so
--      bloqueava se participant_rounds.status = 'completed'; se a rota web
--      falhasse a checagem, a resposta ainda entrava. Nova excecao:
--      ROUND_NOT_OPEN.
--
--   2) join_event_participant passa a exigir events.status = 'open'. Antes
--      aceitava draft/waiting/closed indiscriminadamente e sempre
--      incrementava participant_count. Novas excecoes: EVENT_NOT_FOUND /
--      EVENT_NOT_OPEN.
--
--   3) reset_event ganha parametro p_force. Sem force, recusa se ha
--      participantes com status = 'answering' (evita apagar sessoes ativas
--      no meio do voto e derrubar submits em voo). Nova excecao:
--      PARTICIPANTS_ANSWERING. A assinatura antiga com 1 arg e removida via
--      DROP para evitar ambiguidade de overload — o app so chama a nova.
--
--   4) Novo replace_round_questions(p_round_id, p_questions jsonb) para
--      transacionalidade do PATCH /rounds/[roundId]. Recusa se a rodada
--      esta open ou tem submissoes. Substitui questoes atomicamente. Novas
--      excecoes: ROUND_NOT_FOUND / ROUND_HAS_SUBMISSIONS / ROUND_IS_OPEN.
--
-- Rode isso no SQL Editor do Supabase antes de fazer o deploy do codigo
-- correspondente. Depois eu confirmo via RPC read-only (com UUIDs falsos)
-- que as funcoes existem e retornam os codigos de excecao esperados.

-- ----------------------------------------------------------------------------
-- 1) submit_answers: exige rodada aberta
-- ----------------------------------------------------------------------------
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
  select status into v_round_status
  from rounds where id = p_round_id and event_id = p_event_id for update;
  if v_round_status is null then
    raise exception 'ROUND_NOT_FOUND';
  end if;
  if v_round_status <> 'open' then
    raise exception 'ROUND_NOT_OPEN';
  end if;

  select status into v_pr_status
  from participant_rounds where round_id = p_round_id and participant_id = p_participant_id for update;

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

  insert into participant_rounds (event_id, round_id, participant_id, status, current_question, started_at, last_activity_at, completed_at)
  values (p_event_id, p_round_id, p_participant_id, 'completed',
          (select question_count from rounds where id = p_round_id), now(), now(), now())
  on conflict (round_id, participant_id) do update
  set status = 'completed', current_question = excluded.current_question,
      last_activity_at = now(), completed_at = now();

  update participants set last_activity_at = now() where id = p_participant_id;

  if v_was_new then
    update rounds set completed_count = completed_count + 1, registered_count = registered_count + 1 where id = p_round_id;
  else
    update rounds
    set completed_count = completed_count + 1,
        answering_count = greatest(answering_count - 1, 0)
    where id = p_round_id;
  end if;

  update public_round_stats prs
  set registered_count = r.registered_count, answering_count = r.answering_count,
      completed_count = r.completed_count, updated_at = now()
  from rounds r
  where prs.round_id = p_round_id and r.id = p_round_id;

  return query select false;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) join_event_participant: exige evento aberto
-- ----------------------------------------------------------------------------
create or replace function join_event_participant(
  p_event_id uuid, p_mode text, p_name text,
  p_session_token_hash text, p_session_expires_at timestamptz
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_participant_id uuid;
  v_event_status text;
begin
  select status into v_event_status from events where id = p_event_id for update;
  if v_event_status is null then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status <> 'open' then
    raise exception 'EVENT_NOT_OPEN';
  end if;

  insert into participants (event_id, mode, name, session_token_hash, session_expires_at)
  values (p_event_id, p_mode, p_name, p_session_token_hash, p_session_expires_at)
  returning id into v_participant_id;

  update events set participant_count = participant_count + 1 where id = p_event_id;
  update public_events set participant_count = participant_count + 1, updated_at = now() where event_id = p_event_id;

  return v_participant_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) reset_event com p_force
-- ----------------------------------------------------------------------------
-- Remove a versao antiga (1 arg) para eliminar overload; a nova tem 2 args.
drop function if exists reset_event(uuid);

create or replace function reset_event(p_event_id uuid, p_force boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_answering integer;
begin
  if not exists (select 1 from events where id = p_event_id for update) then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  if not p_force then
    select count(*) into v_answering
    from participant_rounds pr
    join rounds r on r.id = pr.round_id
    where r.event_id = p_event_id and pr.status = 'answering';
    if v_answering > 0 then
      raise exception 'PARTICIPANTS_ANSWERING';
    end if;
  end if;

  delete from participants where event_id = p_event_id;

  delete from public_round_stats where event_id = p_event_id;

  update rounds
  set status = 'draft', registered_count = 0, answering_count = 0, completed_count = 0,
      opened_at = null, closed_at = null
  where event_id = p_event_id;

  update events
  set status = 'draft', participant_count = 0, opened_at = null, closed_at = null,
      current_open_round_id = null, updated_at = now()
  where id = p_event_id;

  update public_events
  set status = 'draft', participant_count = 0, current_open_round_id = null,
      current_round_title = null, current_round_status = null, updated_at = now()
  where event_id = p_event_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) replace_round_questions: substituicao atomica de perguntas
-- ----------------------------------------------------------------------------
-- p_questions e um jsonb array com cada questao no formato:
--   { "order": 1, "type": "single_choice", "title": "...",
--     "explanation": null|"...", "required": true, "options": [...],
--     "maxLength": null|123, "maxSelections": null|3 }
create or replace function replace_round_questions(
  p_round_id uuid, p_questions jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_has_submissions boolean;
  v_count integer;
begin
  select status into v_status from rounds where id = p_round_id for update;
  if v_status is null then
    raise exception 'ROUND_NOT_FOUND';
  end if;
  if v_status = 'open' then
    raise exception 'ROUND_IS_OPEN';
  end if;

  select exists (select 1 from submissions where round_id = p_round_id) into v_has_submissions;
  if v_has_submissions then
    raise exception 'ROUND_HAS_SUBMISSIONS';
  end if;

  delete from questions where round_id = p_round_id;

  insert into questions (round_id, "order", type, title, explanation, required, options, max_length, max_selections)
  select
    p_round_id,
    coalesce((q->>'order')::int, ordinality),
    q->>'type',
    q->>'title',
    nullif(q->>'explanation', ''),
    coalesce((q->>'required')::boolean, true),
    case when q ? 'options' and jsonb_typeof(q->'options') = 'array'
      then array(select jsonb_array_elements_text(q->'options'))
      else null
    end,
    nullif(q->>'maxLength', '')::int,
    nullif(q->>'maxSelections', '')::int
  from jsonb_array_elements(p_questions) with ordinality as t(q, ordinality);

  select count(*) into v_count from questions where round_id = p_round_id;
  update rounds set question_count = v_count where id = p_round_id;
end;
$$;
