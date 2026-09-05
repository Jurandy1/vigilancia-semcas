import postgres from 'postgres';
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
config({ path: '.env.local', quiet: true });

const sql = postgres(`postgres://postgres.gegpfdaahhpcmmctqggm:${process.env.SUPABASE_DB_PASSWORD}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`, { ssl: 'require' });

const patch = readFileSync('supabase/patch-2026-09-05-join-canonical.sql', 'utf8');

async function main() {
  if (!process.env.SUPABASE_DB_PASSWORD) {
    throw new Error('SUPABASE_DB_PASSWORD ausente em .env.local');
  }
  await sql.unsafe(patch);
  console.log('Patch canônico de join aplicado com sucesso.');

  // Confirma que a assinatura com client_token existe e exige open.
  const [{ prosrc }] = await sql`
    select pg_get_functiondef(p.oid) as prosrc
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'join_event_participant'
    order by p.oid desc
    limit 1
  `;
  const hasToken = /p_client_token/i.test(prosrc);
  const requiresOpen = /EVENT_NOT_OPEN|status\s*<>\s*'open'/i.test(prosrc);
  console.log({ hasToken, requiresOpen });
  if (!hasToken || !requiresOpen) {
    throw new Error('Função join_event_participant não ficou no estado canônico esperado.');
  }
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Erro ao aplicar patch:', err);
  try { await sql.end({ timeout: 1 }); } catch { /* ignore */ }
  process.exit(1);
});
