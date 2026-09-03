"use client";

import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";

export async function adminLogin(email: string, password: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(error?.message ?? "Não foi possível entrar.");
  }

  const { data: adminRow } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!adminRow) {
    await supabase.auth.signOut();
    throw new Error("Usuário sem permissão administrativa.");
  }

  return data.user;
}

export async function adminLogout() {
  await getSupabaseClient().auth.signOut();
}

export async function getAdminIdToken(): Promise<string | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.access_token ?? null;
}

export function onAdminAuthChange(callback: (user: User | null) => void) {
  const supabase = getSupabaseClient();
  supabase.auth.getUser().then(({ data }) => callback(data.user ?? null));
  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => sub.subscription.unsubscribe();
}
