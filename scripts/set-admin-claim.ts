/**
 * Script para conceder acesso de administrador a um usuário do Supabase Auth.
 * Uso: npm run set-admin -- email@exemplo.com
 */
import "./load-env";
import { getSupabaseAdmin } from "../src/lib/supabase/admin";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Uso: npm run set-admin -- email@exemplo.com");
    process.exit(1);
  }

  const supabase = getSupabaseAdmin();

  let user: { id: string; email?: string } | undefined;
  let page = 1;
  while (!user) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (user || data.users.length < 200) break;
    page += 1;
  }

  if (!user) {
    console.error(`Usuário não encontrado: ${email}`);
    process.exit(1);
  }

  const { error: insertError } = await supabase
    .from("admins")
    .upsert({ user_id: user.id, email }, { onConflict: "user_id" });
  if (insertError) throw insertError;

  console.log(`Acesso de administrador concedido para ${email} (${user.id}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
