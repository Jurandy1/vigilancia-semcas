import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface AdminUser {
  uid: string;
  email: string | undefined;
}

export async function verifyAdminRequest(
  request: NextRequest
): Promise<AdminUser | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const accessToken = authHeader.slice(7);
  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data.user) return null;

    const { data: adminRow } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (!adminRow) return null;

    return { uid: data.user.id, email: data.user.email };
  } catch {
    return null;
  }
}

export function adminUnauthorized() {
  return Response.json({ error: "Acesso não autorizado." }, { status: 401 });
}
