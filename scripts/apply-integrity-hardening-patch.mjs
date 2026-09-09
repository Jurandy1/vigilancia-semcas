import postgres from "postgres";
import { config } from "dotenv";
import { readFileSync } from "node:fs";

config({ path: ".env.local", quiet: true });

if (!process.env.SUPABASE_DB_PASSWORD) {
  throw new Error("SUPABASE_DB_PASSWORD ausente em .env.local");
}

const sql = postgres(
  `postgres://postgres.gegpfdaahhpcmmctqggm:${process.env.SUPABASE_DB_PASSWORD}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`,
  { ssl: "require", max: 1 }
);

try {
  const patch = readFileSync(
    "supabase/patch-2026-09-08-integrity-hardening.sql",
    "utf8"
  );
  await sql.unsafe(patch);

  const functions = await sql`
    select p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_round_content',
        'save_event_sequence_atomic',
        'submit_answers',
        'join_event_participant'
      )
    order by p.proname
  `;
  if (functions.length !== 4) {
    throw new Error("Nem todas as RPCs de integridade foram encontradas.");
  }

  const [checks] = await sql`
    select
      position(
        'FOR KEY SHARE' in upper(pg_get_functiondef(
          'public.submit_answers(uuid,uuid,uuid,text,jsonb)'::regprocedure
        ))
      ) > 0 as submit_has_round_lock,
      position(
        'PG_ADVISORY_XACT_LOCK_SHARED' in upper(pg_get_functiondef(
          'public.submit_answers(uuid,uuid,uuid,text,jsonb)'::regprocedure
        ))
      ) > 0 as submit_has_shared_gate,
      position(
        'PG_ADVISORY_XACT_LOCK' in upper(pg_get_functiondef(
          'public.close_round_atomic(uuid,boolean,integer)'::regprocedure
        ))
      ) > 0 as close_has_exclusive_gate,
      position(
        'MODE = P_MODE' in upper(pg_get_functiondef(
          'public.join_event_participant(uuid,text,text,text,timestamptz,uuid)'::regprocedure
        ))
      ) > 0 as join_updates_privacy,
      exists (
        select 1 from pg_trigger
        where tgname = 'events_sync_public_mirror' and not tgisinternal
      ) as mirror_trigger_exists,
      not has_function_privilege(
        'anon',
        'public.save_event_sequence_atomic(uuid[])',
        'EXECUTE'
      ) as sequence_denied_to_anon
  `;
  if (
    !checks.submit_has_round_lock ||
    !checks.submit_has_shared_gate ||
    !checks.close_has_exclusive_gate ||
    !checks.join_updates_privacy ||
    !checks.mirror_trigger_exists ||
    !checks.sequence_denied_to_anon
  ) {
    throw new Error(`Verificação de integridade falhou: ${JSON.stringify(checks)}`);
  }

  const [divergence] = await sql`
    select count(*)::int as count
    from events e
    left join public_events p on p.event_id = e.id
    where p.event_id is null
       or p.title is distinct from e.title
       or p.status is distinct from e.status
       or p.sequence_id is distinct from e.sequence_id
       or p.sequence_order is distinct from e.sequence_order
  `;
  if (divergence.count !== 0) {
    throw new Error(`${divergence.count} evento(s) divergentes no espelho público.`);
  }

  console.log(
    "Patch de integridade aplicado e verificado:",
    functions.map((r) => r.proname).join(", ")
  );
} finally {
  await sql.end({ timeout: 2 });
}
