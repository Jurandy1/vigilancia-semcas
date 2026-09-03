import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface AdminUser {
  uid: string;
  email: string | undefined;
}

const AUTH_CACHE_TTL_MS = 30_000;
const AUTH_CACHE_MAX_ENTRIES = 200;
const adminAuthCache = new Map<string, { user: AdminUser; expiresAt: number }>();

function tokenCacheKey(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export async function verifyAdminRequest(
  request: NextRequest
): Promise<AdminUser | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const accessToken = authHeader.slice(7);
  const cacheKey = tokenCacheKey(accessToken);
  const cached = adminAuthCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.user;
  if (cached) adminAuthCache.delete(cacheKey);
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

    const user = { uid: data.user.id, email: data.user.email };
    if (adminAuthCache.size >= AUTH_CACHE_MAX_ENTRIES) {
      const oldestKey = adminAuthCache.keys().next().value;
      if (oldestKey) adminAuthCache.delete(oldestKey);
    }
    adminAuthCache.set(cacheKey, { user, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
    return user;
  } catch {
    return null;
  }
}

export function adminUnauthorized() {
  return Response.json({ error: "Acesso não autorizado." }, { status: 401 });
}
