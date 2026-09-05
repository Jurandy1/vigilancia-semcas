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
