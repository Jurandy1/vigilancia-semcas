import postgres from "postgres";
import { config } from "dotenv";
import { readFileSync } from "node:fs";

config({ path: ".env.local", quiet: true });

const sql = postgres(
  `postgres://postgres.gegpfdaahhpcmmctqggm:${process.env.SUPABASE_DB_PASSWORD}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`,
  { ssl: "require" }
);

const patch = readFileSync("supabase/patch-2026-09-06-close-atomic-rpc-lockdown.sql", "utf8");

async function main() {
  if (!process.env.SUPABASE_DB_PASSWORD) {
    throw new Error("SUPABASE_DB_PASSWORD ausente em .env.local");
  }
  await sql.unsafe(patch);
  console.log("Patch close-atomic + rpc-lockdown aplicado.");

  const [{ exists }] = await sql`
    select exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'close_round_atomic'
    ) as exists
  `;
  if (!exists) throw new Error("close_round_atomic não encontrada após o patch.");

  const privs = await sql`
    select grantee, privilege_type
    from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name = 'close_round_atomic'
    order by grantee, privilege_type
  `;
  console.log("Privileges close_round_atomic:", privs);

  const publicExec = privs.some(
    (p) =>
      (p.grantee === "PUBLIC" || p.grantee === "anon" || p.grantee === "authenticated") &&
      p.privilege_type === "EXECUTE"
  );
  if (publicExec) {
    throw new Error("close_round_atomic ainda executável por PUBLIC/anon/authenticated.");
  }

  process.exit(0);
}

main().catch(async (err) => {
  console.error("Erro ao aplicar patch:", err);
  try {
    await sql.end({ timeout: 1 });
  } catch {
    /* ignore */
  }
  process.exit(1);
});
