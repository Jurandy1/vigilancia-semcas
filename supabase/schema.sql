-- SEMCAS / EventoVigilancia — schema Postgres para o Supabase.
-- Substitui Firestore por completo. Ver plano de migracao para contexto.

create extension if not exists pgcrypto;

-- ==========================================================================
-- Tabelas privadas (RLS: somente admin le; escrita somente via service_role)
-- ==========================================================================

create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  projector_title text,
  "order" int,
  status text not null default 'draft' check (status in ('draft','waiting','open','closed')),
  is_test boolean not null default false,
  is_daily_active boolean not null default false,
  require_live_code boolean not null default false,
  current_open_round_id uuid,
  participant_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  opened_at timestamptz,
  closed_at timestamptz,
  access_code_hash text,
  access_code_expires_at timestamptz,
  sequence_id uuid,
  sequence_order int,
  sequence_size int,
  sequence_root_event_id uuid,
  sequence_root_slug text,
  next_event_id uuid,
  next_event_title text,
  next_event_slug text
);
create unique index one_open_event on events ((true)) where status = 'open';
create unique index one_daily_active_event on events ((true)) where is_daily_active = true;
create index events_sequence_id_idx on events (sequence_id);

create table rounds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  title text not null,
  description text,
  "order" int not null,
  type text not null default 'survey',
  status text not null default 'draft' check (status in ('draft','waiting','open','closed')),
  allow_new_participants boolean not null default true,
  results_visibility text not null default 'after_close',
  question_count int not null default 0,
  registered_count int not null default 0,
  answering_count int not null default 0,
  completed_count int not null default 0,
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  closed_at timestamptz
);
create unique index one_open_round_per_event on rounds (event_id) where status = 'open';
create index rounds_event_order_idx on rounds (event_id, "order");

alter table events
  add constraint events_current_open_round_fk
  foreign key (current_open_round_id) references rounds(id);

create table questions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  "order" int not null,
  type text not null check (type in ('single_choice','multi_choice','text')),
  title text not null,
  explanation text,
  required boolean not null default true,
  options text[],
  max_length int,
  max_selections int
);
create index questions_round_order_idx on questions (round_id, "order");

create table participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  mode text not null check (mode in ('identified','anonymous')),
  name text,
  session_token_hash text not null,
  session_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);
create index participants_session_idx on participants (event_id, session_token_hash);

create table participant_rounds (
  event_id uuid not null references events(id) on delete cascade,
  round_id uuid not null references rounds(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting','answering','completed')),
  current_question int not null default 0,
  started_at timestamptz,
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (round_id, participant_id)
);
create index participant_rounds_round_status_idx on participant_rounds (round_id, status);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  round_id uuid not null references rounds(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  mode text not null,
  answers jsonb not null,
  submitted_at timestamptz not null default now(),
  unique (round_id, participant_id)
);
create index submissions_round_submitted_idx on submissions (round_id, submitted_at desc);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  action text not null,
  actor_type text not null check (actor_type in ('participant','admin','system')),
  actor_id text,
  round_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null
);

-- ==========================================================================
-- Tabelas publicas (RLS: leitura anonima liberada; escrita so via service_role)
-- Espelhadas explicitamente pelo servidor — nao sao views, porque o Supabase
-- Realtime so emite eventos de tabelas fisicas.
-- ==========================================================================

create table public_events (
  event_id uuid primary key references events(id) on delete cascade,
  slug text not null unique,
  title text not null,
  description text,
  projector_title text,
  status text not null,
  require_live_code boolean not null default false,
  is_daily_active boolean not null default false,
  participant_count int not null default 0,
  current_open_round_id uuid,
  current_round_title text,
  current_round_status text,
  access_challenge jsonb,
  sequence_id uuid,
  sequence_order int,
  sequence_size int,
  sequence_root_event_id uuid,
  sequence_root_slug text,
  next_event_id uuid,
  next_event_title text,
  next_event_slug text,
  updated_at timestamptz not null default now()
);

create table public_round_stats (
  round_id uuid primary key references rounds(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  status text not null,
  registered_count int not null default 0,
  answering_count int not null default 0,
  completed_count int not null default 0,
  updated_at timestamptz not null default now()
);

-- ==========================================================================
-- RLS
-- ==========================================================================

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

alter table events enable row level security;
alter table rounds enable row level security;
alter table questions enable row level security;
alter table participants enable row level security;
alter table participant_rounds enable row level security;
alter table submissions enable row level security;
alter table audit_log enable row level security;
alter table admins enable row level security;
alter table public_events enable row level security;
alter table public_round_stats enable row level security;

create policy admin_read_events on events for select using (is_admin());
create policy admin_read_rounds on rounds for select using (is_admin());
create policy admin_read_questions on questions for select using (is_admin());
create policy admin_read_participants on participants for select using (is_admin());
create policy admin_read_participant_rounds on participant_rounds for select using (is_admin());
create policy admin_read_submissions on submissions for select using (is_admin());
create policy admin_read_audit_log on audit_log for select using (is_admin());
create policy admin_read_admins on admins for select using (is_admin());

create policy public_read_public_events on public_events for select using (true);
create policy public_read_public_round_stats on public_round_stats for select using (true);

-- ==========================================================================
-- Realtime — expor as tabelas fisicas que os hooks assinam
-- ==========================================================================

alter publication supabase_realtime add table events, rounds, participant_rounds, public_events, public_round_stats;

-- ==========================================================================
-- Funcoes atomicas (equivalentes as transacoes do Firestore)
-- ==========================================================================

create or replace function open_event(p_event_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_seq_id uuid;
  v_seq_order int;
  v_pending_previous boolean;
  v_other_open boolean;
begin
  select status, sequence_id, sequence_order into v_status, v_seq_id, v_seq_order
  from events where id = p_event_id for update;

  if v_status is null then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_status not in ('draft','waiting') then
    raise exception 'EVENT_NOT_STARTABLE';
  end if;

  if v_seq_id is not null and coalesce(v_seq_order, 0) > 0 then
    select exists (
      select 1 from events
      where sequence_id = v_seq_id and coalesce(sequence_order, 0) < v_seq_order and status <> 'closed'
    ) into v_pending_previous;
    if v_pending_previous then
      raise exception 'SEQUENCE_PENDING_PREVIOUS';
    end if;
  end if;

  select exists (select 1 from events where status = 'open' and id <> p_event_id) into v_other_open;
  if v_other_open then
    raise exception 'ANOTHER_EVENT_OPEN';
  end if;

  update events set status = 'open', opened_at = now(), updated_at = now() where id = p_event_id;

  update public_events set status = 'open', updated_at = now() where event_id = p_event_id;
end;
$$;

create or replace function close_event(p_event_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_open_round boolean;
begin
  select status into v_status from events where id = p_event_id for update;
  if v_status is null then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_status <> 'open' then
    raise exception 'EVENT_NOT_OPEN';
  end if;

  select exists (select 1 from rounds where event_id = p_event_id and status = 'open') into v_open_round;
  if v_open_round then
    raise exception 'ROUND_STILL_OPEN';
  end if;

  update events set status = 'closed', closed_at = now(), updated_at = now(), current_open_round_id = null
  where id = p_event_id;

  update public_events
  set status = 'closed', current_open_round_id = null, current_round_title = null, current_round_status = null,
      updated_at = now()
  where event_id = p_event_id;
end;
$$;

create or replace function open_round(p_event_id uuid, p_round_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_event_status text;
  v_round_status text;
  v_round_title text;
  v_other_round_open boolean;
begin
  select status into v_event_status from events where id = p_event_id for update;
  if v_event_status is null then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status <> 'open' then
    raise exception 'EVENT_NOT_OPEN';
  end if;

  select status, title into v_round_status, v_round_title
  from rounds where id = p_round_id and event_id = p_event_id for update;
  if v_round_status is null then
    raise exception 'ROUND_NOT_FOUND';
  end if;
  if v_round_status = 'open' then
    raise exception 'ROUND_ALREADY_OPEN';
  end if;
  if v_round_status = 'closed' then
    raise exception 'ROUND_ALREADY_CLOSED';
  end if;

  select exists (
    select 1 from rounds where event_id = p_event_id and status = 'open' and id <> p_round_id
  ) into v_other_round_open;
  if v_other_round_open then
    raise exception 'ANOTHER_ROUND_OPEN';
  end if;

  update rounds
  set status = 'open', opened_at = now(), registered_count = 0, answering_count = 0, completed_count = 0
  where id = p_round_id;

  update events set current_open_round_id = p_round_id, updated_at = now() where id = p_event_id;

  update public_events
  set current_open_round_id = p_round_id, current_round_title = v_round_title, current_round_status = 'open',
      updated_at = now()
  where event_id = p_event_id;

  insert into public_round_stats (round_id, event_id, status, registered_count, answering_count, completed_count, updated_at)
  values (p_round_id, p_event_id, 'open', 0, 0, 0, now())
  on conflict (round_id) do update
  set status = 'open', registered_count = 0, answering_count = 0, completed_count = 0, updated_at = now();
end;
$$;

create or replace function close_round(p_round_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_event_id uuid;
  v_status text;
  v_current_open uuid;
begin
  select event_id, status into v_event_id, v_status from rounds where id = p_round_id for update;
  if v_status is null then
    raise exception 'ROUND_NOT_FOUND';
  end if;
  if v_status <> 'open' then
    raise exception 'ROUND_NOT_OPEN';
  end if;

  update rounds set status = 'closed', closed_at = now() where id = p_round_id;

  select current_open_round_id into v_current_open from events where id = v_event_id for update;
  if v_current_open = p_round_id then
    update events set current_open_round_id = null, updated_at = now() where id = v_event_id;
    update public_events
    set current_open_round_id = null, current_round_title = null, current_round_status = 'closed', updated_at = now()
    where event_id = v_event_id;
  end if;

  update public_round_stats set status = 'closed', updated_at = now() where round_id = p_round_id;
end;
$$;

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
    update events set current_open_round_id = null, updated_at = now()
    where id = v_event_id and current_open_round_id = p_round_id;
    update public_events
    set current_open_round_id = null, current_round_title = null, current_round_status = null,
        updated_at = now()
    where event_id = v_event_id and current_open_round_id = p_round_id;
  end if;
end;
$$;

-- Reseta um evento inteiro (todas as rodadas, respostas e participantes) de
-- uma vez, para o caso de precisar votar tudo de novo do zero mesmo depois
-- de encerrado. Mantém sequence_id/next_event_* e is_daily_active intactos —
-- só o conteúdo/progresso do evento reseta, não sua posição na sequência.
-- p_force = false (default) recusa se há participantes com status = 'answering'
-- (evita derrubar submits em voo). UI passa force=true na segunda confirmação.
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

-- Substitui atomicamente as perguntas de uma rodada. Recusa se a rodada
-- está aberta ou já tem submissoes — fecha a corrida antiga de DELETE +
-- INSERT em statements separados. UI usa PATCH /rounds/[roundId].
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

create or replace function advance_sequence(p_event_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_next_event_id uuid;
begin
  select status, next_event_id into v_status, v_next_event_id from events where id = p_event_id for update;
  if v_status is null then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_next_event_id is null then
    raise exception 'NO_NEXT_EVENT';
  end if;

  if v_status = 'open' then
    perform close_event(p_event_id);
  end if;

  perform open_event(v_next_event_id);

  return v_next_event_id;
end;
$$;

-- Ativa p_event_id (ou, se ele pertencer a uma sequência, o evento raiz dela)
-- como o evento fixo do dia — o alvo de /e/atual e /projector/atual — desmarcando
-- qualquer outro que estivesse ativo.
create or replace function set_daily_active_event(p_event_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_root_id uuid;
begin
  select coalesce(sequence_root_event_id, id) into v_root_id from events where id = p_event_id;
  if v_root_id is null then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  update events set is_daily_active = false, updated_at = now() where is_daily_active = true;
  update public_events set is_daily_active = false, updated_at = now() where is_daily_active = true;

  update events set is_daily_active = true, updated_at = now() where id = v_root_id;
  update public_events set is_daily_active = true, updated_at = now() where event_id = v_root_id;

  return v_root_id;
end;
$$;

create or replace function clear_daily_active_event() returns void
language plpgsql security definer set search_path = public as $$
begin
  update events set is_daily_active = false, updated_at = now() where is_daily_active = true;
  update public_events set is_daily_active = false, updated_at = now() where is_daily_active = true;
end;
$$;

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
  -- A rota web já checa, mas se falhar (race, deploy inconsistente), o RPC
  -- ainda rejeita em vez de gravar voto pós-fechamento.
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

-- CONSOLIDATED PATCHES (fonte: scripts/consolidate-schema.mjs)

-- SOURCE: supabase/patch-2026-09-04-audit-log-fk.sql
-- audit_log.event_id tinha "on delete cascade" — excluir um evento apagava
-- junto todo o histórico de auditoria dele (event_opened, round_closed,
-- event_reset, etc.), e impediria logar a própria exclusão (a linha do log
-- seria apagada pela cascade, ou a inserção falharia se feita depois do
-- delete). Troca para "on delete set null": o evento some, o registro de
-- que ele existiu e foi excluído fica.
--
-- Descobre o nome real da constraint em vez de supor um nome fixo — nomes
-- gerados automaticamente pelo Postgres não são garantidos entre ambientes.

do $$
declare v_constraint_name text;
begin
  select conname into v_constraint_name
  from pg_constraint
  where conrelid = 'audit_log'::regclass and confrelid = 'events'::regclass and contype = 'f';

  if v_constraint_name is not null then
    execute format('alter table audit_log drop constraint %I', v_constraint_name);
  end if;

  alter table audit_log add constraint audit_log_event_id_fkey
    foreign key (event_id) references events(id) on delete set null;
end $$;

-- SOURCE: supabase/patch-2026-09-04-rate-limit.sql
-- Rate limiting para os endpoints públicos que escrevem no banco (join,
-- submit, rotate-code) — hoje qualquer script pode chamá-los sem limite e
-- inflar participantes ou distorcer uma votação pública ao vivo. Sem
-- serviço externo (Upstash/Turnstile): reaproveita o Postgres já usado em
-- tudo mais no projeto.
--
-- Uma linha por (bucket, chave) em vez de uma linha por request — o
-- tamanho da tabela é limitado pelo número de chaves distintas já vistas,
-- não pelo volume de tráfego. Sem pg_cron neste projeto, então a limpeza
-- de linhas antigas é oportunista (1% de chance a cada chamada).

create table if not exists rate_limits (
  bucket text not null,
  rate_key text not null,
  window_start timestamptz not null default now(),
  count integer not null default 1,
  primary key (bucket, rate_key)
);

alter table rate_limits enable row level security;

create or replace function check_rate_limit(
  p_bucket text, p_key text, p_limit int, p_window_seconds int
) returns table (allowed boolean, retry_after_seconds int)
language plpgsql security definer set search_path = public as $$
declare
  v_now timestamptz := now();
  v_count int;
  v_window_start timestamptz;
begin
  insert into rate_limits (bucket, rate_key, window_start, count)
  values (p_bucket, p_key, v_now, 1)
  on conflict (bucket, rate_key) do update
    set count = case when rate_limits.window_start <= v_now - make_interval(secs => p_window_seconds)
                 then 1 else rate_limits.count + 1 end,
        window_start = case when rate_limits.window_start <= v_now - make_interval(secs => p_window_seconds)
                        then v_now else rate_limits.window_start end
  returning rate_limits.count, rate_limits.window_start into v_count, v_window_start;

  if random() < 0.01 then
    delete from rate_limits where window_start < v_now - interval '1 day';
  end if;

  return query select
    v_count <= p_limit,
    greatest(0, p_window_seconds - extract(epoch from (v_now - v_window_start))::int);
end;
$$;

-- SOURCE: supabase/patch-2026-09-05-join-canonical.sql
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

-- SOURCE: supabase/patch-2026-09-06-close-atomic-rpc-lockdown.sql
-- Force-close atômico + lockdown de EXECUTE das RPCs sensíveis.
-- Aplique após patch-2026-09-05-join-canonical.sql

-- ============================================================================
-- 1) Encerrar rodada em uma única transação (abandonar + fechar)
-- ============================================================================
-- Evita a janela em que o app marcava answering→waiting com a rodada ainda
-- open e um /submit ainda passava.

create or replace function close_round_atomic(
  p_round_id uuid,
  p_force boolean default false,
  p_stale_seconds int default 120
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_event_id uuid;
  v_status text;
  v_current_open uuid;
  v_active int := 0;
  v_abandoned int := 0;
  v_stale int;
begin
  v_stale := greatest(coalesce(p_stale_seconds, 120), 0);

  -- Exclusivo contra os locks compartilhados de submit/progresso. O lock é
  -- sempre o primeiro recurso adquirido, eliminando inversão com
  -- participant_rounds e definindo um corte claro para novos envios.
  perform pg_advisory_xact_lock(hashtextextended(p_round_id::text, 0));

  select event_id, status into v_event_id, v_status
  from rounds where id = p_round_id for update;
  if v_status is null then
    raise exception 'ROUND_NOT_FOUND';
  end if;
  if v_status <> 'open' then
    raise exception 'ROUND_NOT_OPEN';
  end if;

  select count(*)::int into v_active
  from participant_rounds
  where round_id = p_round_id
    and status = 'answering'
    and last_activity_at > now() - make_interval(secs => v_stale);

  if v_active > 0 and not coalesce(p_force, false) then
    raise exception 'PARTICIPANTS_STILL_ANSWERING';
  end if;

  if coalesce(p_force, false) then
    update participant_rounds
    set status = 'waiting', last_activity_at = now()
    where round_id = p_round_id and status = 'answering';
    get diagnostics v_abandoned = row_count;
  else
    -- Abandona só quem ficou parado (fantasma / desistiu).
    update participant_rounds
    set status = 'waiting', last_activity_at = now()
    where round_id = p_round_id
      and status = 'answering'
      and last_activity_at <= now() - make_interval(secs => v_stale);
    get diagnostics v_abandoned = row_count;
  end if;

  update rounds
  set status = 'closed', closed_at = now(), answering_count = 0
  where id = p_round_id;

  select current_open_round_id into v_current_open
  from events where id = v_event_id for update;
  if v_current_open = p_round_id then
    update events
    set current_open_round_id = null, updated_at = now()
    where id = v_event_id;
    update public_events
    set current_open_round_id = null,
        current_round_title = null,
        current_round_status = 'closed',
        updated_at = now()
    where event_id = v_event_id;
  end if;

  update public_round_stats
  set status = 'closed', answering_count = 0, updated_at = now()
  where round_id = p_round_id;

  return jsonb_build_object(
    'abandoned', coalesce(v_abandoned, 0),
    'forced', coalesce(p_force, false),
    'activeAtClose', v_active
  );
end;
$$;

-- ============================================================================
-- 2) REVOKE EXECUTE: só service_role (Next.js admin) chama essas RPCs
-- ============================================================================
-- Sem isso, o default do Postgres (EXECUTE para PUBLIC) pode permitir
-- anon/authenticated chamar close_round/reset_event via PostgREST.

do $$
declare
  r record;
  names text[] := array[
    'open_event',
    'close_event',
    'open_round',
    'close_round',
    'close_round_atomic',
    'reset_round',
    'reset_event',
    'advance_sequence',
    'join_event_participant',
    'submit_answers',
    'update_progress',
    'check_rate_limit',
    'update_round_content',
    'clear_daily_active_event',
    'set_daily_active_event',
    'set_daily_active'
  ];
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(names)
  loop
    execute format('revoke all on function %s from public', r.sig);
    begin
      execute format('revoke all on function %s from anon', r.sig);
    exception when undefined_object then null;
    end;
    begin
      execute format('revoke all on function %s from authenticated', r.sig);
    exception when undefined_object then null;
    end;
    begin
      execute format('grant execute on function %s to service_role', r.sig);
    exception when undefined_object then null;
    end;
  end loop;
end;
$$;

-- SOURCE: supabase/patch-2026-09-08-integrity-hardening.sql
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
