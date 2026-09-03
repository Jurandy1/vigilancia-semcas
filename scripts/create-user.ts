import "./load-env";
import { getSupabaseAdmin } from "../src/lib/supabase/admin";

async function main() {
  const supabase = getSupabaseAdmin();
  const email = "teste@gmail.com";
  const password = "123456789";

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (error) {
    if (error.message.includes("already exists") || error.message.includes("User already registered") || error.status === 422) {
      console.log("User already exists, proceeding.");
    } else {
      console.error(error);
      process.exit(1);
    }
  } else {
    console.log("User created:", data.user.id);
  }
}

main().catch(console.error);
