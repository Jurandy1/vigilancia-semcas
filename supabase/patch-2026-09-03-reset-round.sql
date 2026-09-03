-- Adiciona a função reset_round: permite reabrir uma rodada do zero (apaga
-- respostas e progresso dela) mesmo que o evento já tenha sido encerrado,
-- para o caso de um problema exigir refazer a votação daquela rodada.
-- Rode só isso — não precisa repetir o schema.sql inteiro.

create or replace function reset_round(p_round_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_event_id uuid;
  v_event_status text;
  v_other_open boolean;
begin
  select event_id into v_event_id from rounds where id = p_round_id for update;
  if v_event_id is null then
    raise exception 'ROUND_NOT_FOUND';
  end if;

  select status into v_event_status from events where id = v_event_id for update;

  delete from submissions where round_id = p_round_id;
  delete from participant_rounds where round_id = p_round_id;
  delete from public_round_stats where round_id = p_round_id;

  update rounds
  set status = 'draft', registered_count = 0, answering_count = 0, completed_count = 0,
      opened_at = null, closed_at = null
  where id = p_round_id;

  if v_event_status = 'closed' then
    select exists (select 1 from events where status = 'open' and id <> v_event_id) into v_other_open;
    if v_other_open then
      raise exception 'ANOTHER_EVENT_OPEN';
    end if;

    update events
    set status = 'open', closed_at = null, current_open_round_id = null, updated_at = now()
    where id = v_event_id;

    update public_events
    set status = 'open', current_open_round_id = null, current_round_title = null,
        current_round_status = null, updated_at = now()
    where event_id = v_event_id;
  elsif v_event_status = 'open' then
    -- Se a rodada resetada era a que estava aberta no evento, limpa a referência.
    update events set current_open_round_id = null, updated_at = now()
    where id = v_event_id and current_open_round_id = p_round_id;
    update public_events
    set current_open_round_id = null, current_round_title = null, current_round_status = null,
        updated_at = now()
    where event_id = v_event_id and current_open_round_id = p_round_id;
  end if;
end;
$$;
