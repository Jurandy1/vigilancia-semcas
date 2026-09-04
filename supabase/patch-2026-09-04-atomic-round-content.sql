-- Aplicar antes de publicar a rota que chama update_round_content.
-- Somente define a função; não altera rodadas existentes nem permissões.
create or replace function update_round_content(
  p_event_id uuid, p_round_id uuid, p_questions jsonb, p_settings jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Mesmo bloqueio de evento usado ao abrir rodadas, para serializar edição
  -- e abertura. O vínculo é validado dentro da transação.
  perform 1 from events where id = p_event_id for update;
  perform 1 from rounds where id = p_round_id and event_id = p_event_id for update;
  if not found then
    raise exception 'ROUND_NOT_FOUND';
  end if;

  -- Reutiliza as validações de rodada aberta e respostas existentes.
  perform replace_round_questions(p_round_id, p_questions);

  update rounds set
    title = p_settings->>'title',
    description = p_settings->>'description',
    type = p_settings->>'type',
    allow_new_participants = (p_settings->>'allowNewParticipants')::boolean,
    results_visibility = p_settings->>'resultsVisibility'
  where id = p_round_id;
  -- Qualquer falha acima reverte também a substituição das perguntas.
end;
$$;
