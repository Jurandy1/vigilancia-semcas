-- QR/link fixo permanente: em vez de um link diferente por sequência, o
-- operador marca qual evento (ou sequência, pelo evento raiz) é "o de hoje" e
-- um único link fixo (/e/atual e /projector/atual) sempre aponta pra ele.
-- Rode só isso — não precisa repetir o schema.sql inteiro.

alter table events add column if not exists is_daily_active boolean not null default false;
alter table public_events add column if not exists is_daily_active boolean not null default false;

create unique index if not exists one_daily_active_event on events ((true)) where is_daily_active = true;

-- Ativa p_event_id (ou, se ele pertencer a uma sequência, o evento raiz dela)
-- como o evento fixo do dia, desmarcando qualquer outro que estivesse ativo.
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
