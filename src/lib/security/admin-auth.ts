import { NextRequest } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";

export interface AdminUser {
  uid: string;
  email: string | undefined;
}

export async function verifyAdminRequest(
  request: NextRequest
): Promise<AdminUser | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const idToken = authHeader.slice(7);

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    if (!decoded.admin) return null;
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

export function adminUnauthorized() {
  return Response.json({ error: "Acesso não autorizado." }, { status: 401 });
}
