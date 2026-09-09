-- Perguntas condicionais: uma pergunta pode depender da alternativa escolhida
-- em uma pergunta anterior da mesma rodada.

alter table questions
  add column if not exists show_if_question_order int,
  add column if not exists show_if_value text;

create unique index if not exists questions_round_order_unique
  on questions (round_id, "order");

alter table questions drop constraint if exists questions_condition_complete;
alter table questions add constraint questions_condition_complete check (
  (show_if_question_order is null and show_if_value is null)
  or (
    show_if_question_order is not null
    and show_if_value is not null
    and show_if_question_order > 0
    and show_if_question_order < "order"
  )
);

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
  if v_status is null then raise exception 'ROUND_NOT_FOUND'; end if;
  if v_status = 'open' then raise exception 'ROUND_IS_OPEN'; end if;

  select exists (select 1 from submissions where round_id = p_round_id)
    into v_has_submissions;
  if v_has_submissions then raise exception 'ROUND_HAS_SUBMISSIONS'; end if;

  delete from questions where round_id = p_round_id;

  insert into questions (
    round_id, "order", type, title, explanation, required, options,
    max_length, max_selections, show_if_question_order, show_if_value
  )
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
    nullif(q->>'maxSelections', '')::int,
    nullif(q->>'showIfQuestionOrder', '')::int,
    nullif(q->>'showIfValue', '')
  from jsonb_array_elements(p_questions) with ordinality as t(q, ordinality);

  select count(*) into v_count from questions where round_id = p_round_id;
  update rounds set question_count = v_count where id = p_round_id;
end;
$$;

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
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;

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
      round_id, "order", type, title, explanation, required, options,
      max_length, max_selections, show_if_question_order, show_if_value
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
      nullif(q->>'maxSelections', '')::int,
      nullif(q->>'showIfQuestionOrder', '')::int,
      nullif(q->>'showIfValue', '')
    );
  end loop;

  return v_round_id;
end;
$$;

-- Aplica a convenção já usada nos textos dos questionários existentes.
update questions q
set show_if_question_order = q."order" - 1, show_if_value = 'Sim'
from questions parent
where parent.round_id = q.round_id
  and parent."order" = q."order" - 1
  and 'Sim' = any(parent.options)
  and lower(q.title) ~ '^(caso (seja )?sim|se positivo)';

-- Mantém perguntas complementares de participantes na mesma ramificação.
update questions q
set show_if_question_order = previous.show_if_question_order,
    show_if_value = previous.show_if_value
from questions previous
where previous.round_id = q.round_id
  and previous."order" = q."order" - 1
  and previous.show_if_question_order is not null
  and lower(q.title) like 'quem seriam os participantes%';

revoke all on function replace_round_questions(uuid, jsonb) from public, anon, authenticated;
revoke all on function create_round_content(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function replace_round_questions(uuid, jsonb) to service_role;
grant execute on function create_round_content(uuid, jsonb, jsonb) to service_role;
