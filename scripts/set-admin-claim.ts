/**
 * Script para definir custom claim admin em um usuário Firebase Auth.
 * Uso: npm run set-admin -- email@exemplo.com
 */
import "./load-env";
import { getAdminAuth } from "../src/lib/firebase/admin";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Uso: npm run set-admin -- email@exemplo.com");
    process.exit(1);
  }

  const auth = getAdminAuth();
  const user = await auth.getUserByEmail(email);
  await auth.setCustomUserClaims(user.uid, { admin: true });
  console.log(`Custom claim admin: true definido para ${email}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
