import { readFileSync, writeFileSync } from "node:fs";

const schemaPath = "supabase/schema.sql";
const marker = "-- CONSOLIDATED PATCHES (fonte: scripts/consolidate-schema.mjs)";
const patches = [
  "supabase/patch-2026-09-04-audit-log-fk.sql",
  "supabase/patch-2026-09-04-rate-limit.sql",
  "supabase/patch-2026-09-05-join-canonical.sql",
  "supabase/patch-2026-09-06-close-atomic-rpc-lockdown.sql",
  "supabase/patch-2026-09-08-integrity-hardening.sql",
];

const current = readFileSync(schemaPath, "utf8");
const baseline = current.split(marker)[0].trimEnd();
const consolidated = patches
  .map((path) => `\n\n-- SOURCE: ${path}\n${readFileSync(path, "utf8").trim()}`)
  .join("");

writeFileSync(schemaPath, `${baseline}\n\n${marker}${consolidated}\n`);
console.log(`schema.sql consolidado com ${patches.length} patches.`);
