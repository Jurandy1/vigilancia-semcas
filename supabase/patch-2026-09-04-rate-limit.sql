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
