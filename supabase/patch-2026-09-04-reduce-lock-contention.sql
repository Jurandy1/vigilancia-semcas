-- Reduz o tempo que join_event_participant e submit_answers seguram o lock
-- de linha (FOR UPDATE) na linha compartilhada de events/rounds, causa de
-- lentidao severa sob concorrencia real: teste de carga com 120 participantes
-- simultaneos mediu p50 ~58s e maximo ~64s para completar entrada+respostas
-- (via HTTP contra a API em producao), porque toda escrita nos contadores
-- (participant_count em events; registered/answering/completed_count em
-- rounds) tinha que esperar a transacao inteira da chamada anterior (select
-- FOR UPDATE + insert + updates + round-trip de rede) terminar antes de
-- comecar, serializando tudo numa fila de um-por-vez.
--
-- A checagem de status (evento aberto? rodada aberta?) nao precisa segurar o
-- lock — vira uma leitura simples. So o UPDATE final do contador continua
-- tomando o lock de linha do Postgres (inevitavel para um contador
-- compartilhado, mas dura so a duracao desse UPDATE, nao da transacao
-- inteira). Efeito colateral aceito: numa janela de poucos milissegundos ao
-- redor do exato instante em que um evento/rodada fecha, uma entrada/envio
-- que leu "aberto" um instante antes pode terminar de gravar seus contadores
-- ja depois do fechamento — comportamento aceitavel (e ate desejavel) para
-- quem estava legitimamente no meio de uma acao quando o operador encerrou.
--
-- Reaplica a definicao completa das duas funcoes (CREATE OR REPLACE), sem
-- mudar assinatura nem contrato de retorno/excecoes.

create or replace function join_event_participant(
  p_event_id uuid, p_mode text, p_name text,
  p_session_token_hash text, p_session_expires_at timestamptz
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_participant_id uuid;
  v_event_status text;
begin
  select status into v_event_status from events where id = p_event_id;
  if v_event_status is null then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status not in ('open', 'waiting') then
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
  -- Defesa em profundidade: só aceita respostas se a rodada está aberta.
  -- Leitura simples (sem FOR UPDATE) — não serializa com outras submissões;
  -- o UPDATE final dos contadores é o único ponto que precisa do lock.
  select status into v_round_status
  from rounds where id = p_round_id and event_id = p_event_id;
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
