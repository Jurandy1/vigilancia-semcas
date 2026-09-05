/**
 * Suite automatizada sem interação:
 * 1) typecheck (opcional via SKIP_TYPECHECK)
 * 2) probe de regressão (cookie + rate-limit + submit)
 * 3) load-test HTTP completo nas rotas públicas
 *
 * Uso:
 *   LOAD_TEST_BASE_URL=http://localhost:3000 npm run test:automated
 *   LOAD_TEST_BASE_URL=https://vigilancia-semcas.vercel.app npm run test:automated
 */
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const BASE_URL = (process.env.LOAD_TEST_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const ROOT = process.cwd();

function run(command: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  return new Promise<number>((resolvePromise) => {
    console.log(`\n>>> ${command} ${args.join(" ")}`);
    const child = spawn(command, args, {
      cwd: ROOT,
      env: { ...process.env, ...env, LOAD_TEST_BASE_URL: BASE_URL },
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("exit", (code) => resolvePromise(code ?? 1));
  });
}

async function waitForBaseUrl(timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/admin/login`);
      if (res.ok || res.status < 500) {
        console.log(`Base URL OK: ${BASE_URL} (HTTP ${res.status})`);
        return;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Servidor não respondeu em ${BASE_URL}`);
}

async function main() {
  console.log(`Suite automatizada → ${BASE_URL}`);
  await waitForBaseUrl();

  if (process.env.SKIP_TYPECHECK !== "1") {
    const typecheck = await run("npx", ["tsc", "--noEmit"]);
    if (typecheck !== 0) {
      console.error("Typecheck falhou.");
      process.exit(typecheck);
    }
  }

  const cleanup = await run("npx", ["tsx", resolve("scripts/cleanup-open-test-events.ts")]);
  if (cleanup !== 0) {
    console.error("Cleanup de eventos de teste falhou.");
    process.exit(cleanup);
  }

  const probe = await run("npx", ["tsx", resolve("scripts/probe-system-bugs.ts")]);
  if (probe !== 0) {
    console.error("Probe reprovado.");
    process.exit(probe);
  }

  const load = await run("npx", ["tsx", resolve("scripts/load-test-http.ts")]);
  if (load !== 0) {
    console.error("Load test HTTP reprovado.");
    process.exit(load);
  }

  console.log("\nSuite automatizada APROVADA.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
