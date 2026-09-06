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
