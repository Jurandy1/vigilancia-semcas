-- Roda ANTES de reaplicar supabase/schema.sql, só se você já rodou uma
-- versão antiga dele. Remove só os objetos que o schema.sql cria — nada
-- do que o Supabase já configura por padrão no projeto.

drop function if exists submit_answers(uuid, uuid, uuid, text, jsonb) cascade;
drop function if exists update_progress(uuid, uuid, uuid, int) cascade;
drop function if exists join_event_participant(uuid, text, text, text, timestamptz) cascade;
drop function if exists advance_sequence(uuid) cascade;
drop function if exists close_round(uuid) cascade;
drop function if exists open_round(uuid, uuid) cascade;
drop function if exists close_event(uuid) cascade;
drop function if exists open_event(uuid) cascade;
drop function if exists is_admin() cascade;

drop table if exists public_round_stats cascade;
drop table if exists public_events cascade;
drop table if exists admins cascade;
drop table if exists audit_log cascade;
drop table if exists submissions cascade;
drop table if exists participant_rounds cascade;
drop table if exists participants cascade;
drop table if exists questions cascade;
drop table if exists rounds cascade;
drop table if exists events cascade;
