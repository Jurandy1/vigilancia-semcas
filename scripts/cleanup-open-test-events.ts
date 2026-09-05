import "./load-env";
import { getSupabaseAdmin } from "../src/lib/supabase/admin";

async function main() {
  const s = getSupabaseAdmin();
  const { data: open } = await s.from("events").select("id,slug,status,is_test,title").eq("status", "open");
  console.log("open:", JSON.stringify(open, null, 2));

  const { data: tests } = await s
    .from("events")
    .select("id,slug,status,is_test")
    .or("is_test.eq.true,slug.ilike.load-http-%,slug.ilike.probe-%")
    .limit(100);
  console.log("cleanup candidates:", JSON.stringify(tests, null, 2));

  if (tests?.length) {
    for (const ev of tests) {
      await s.from("events").delete().eq("id", ev.id);
    }
    console.log(`deleted ${tests.length} test events`);
  }

  // Se ainda houver evento open não-teste, fecha temporariamente? Não — só reporta.
  const { data: stillOpen } = await s.from("events").select("id,slug,is_test").eq("status", "open");
  console.log("still open:", JSON.stringify(stillOpen, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
