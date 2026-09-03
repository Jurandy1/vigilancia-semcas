-- Corrige update_progress: faltava incrementar registered_count junto com
-- answering_count na primeira vez que o participante aparece na rodada.
-- Rode só isso — não precisa repetir o schema.sql inteiro.

create or replace function update_progress(
  p_event_id uuid, p_round_id uuid, p_participant_id uuid, p_current_question int
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_existing_status text;
begin
  select status into v_existing_status
  from participant_rounds where round_id = p_round_id and participant_id = p_participant_id for update;

  if v_existing_status is null then
    insert into participant_rounds (event_id, round_id, participant_id, status, current_question, started_at, last_activity_at)
    values (p_event_id, p_round_id, p_participant_id, 'answering', p_current_question, now(), now());

    update rounds set registered_count = registered_count + 1, answering_count = answering_count + 1 where id = p_round_id;
    update public_round_stats
    set registered_count = registered_count + 1, answering_count = answering_count + 1, updated_at = now()
    where round_id = p_round_id;
  elsif v_existing_status <> 'completed' then
    update participant_rounds
    set status = 'answering', current_question = p_current_question, last_activity_at = now()
    where round_id = p_round_id and participant_id = p_participant_id;
  end if;
end;
$$;
