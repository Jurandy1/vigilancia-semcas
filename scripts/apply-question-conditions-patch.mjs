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
  await sql.unsafe(
    readFileSync("supabase/patch-2026-09-08-question-conditions.sql", "utf8")
  );

  const [columns] = await sql`
    select count(*)::int as count
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'questions'
      and column_name in ('show_if_question_order', 'show_if_value')
  `;
  if (columns.count !== 2) {
    throw new Error("As colunas de condição não foram criadas.");
  }

  const configured = await sql`
    select q."order", q.show_if_question_order, q.show_if_value
    from questions q
    join rounds r on r.id = q.round_id
    join events e on e.id = r.event_id
    where e.status = 'open' and r.status = 'open'
      and q.show_if_question_order is not null
    order by q."order"
  `;
  console.log("Condições aplicadas:", JSON.stringify(configured));
} finally {
  await sql.end({ timeout: 2 });
}
