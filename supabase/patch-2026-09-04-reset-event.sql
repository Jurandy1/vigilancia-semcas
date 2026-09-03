-- Reseta um evento inteiro (todas as rodadas, respostas e participantes) de
-- uma vez, em vez de rodada por rodada. Cada evento do usuário tem só um
-- bloco de perguntas na prática, então resetar por rodada era redundante e
-- ficava escondido demais (dentro de Perguntas do evento). Este é o botão
-- "Resetar evento" que aparece direto na lista de Eventos.
-- Rode só isso — não precisa repetir o schema.sql inteiro.

create or replace function reset_event(p_event_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from events where id = p_event_id for update) then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  -- Cascata: participants -> participant_rounds e submissions (on delete cascade).
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
