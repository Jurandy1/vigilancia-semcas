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
begin
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
begin
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

-- ==========================================================================
-- Bootstrap: admin inicial (teste@gmail.com)
-- ==========================================================================

insert into admins (user_id, email)
values ('405e1bad-6150-4a3a-a781-93f0105f4871', 'teste@gmail.com')
on conflict (user_id) do nothing;
