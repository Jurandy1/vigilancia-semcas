import { NextRequest } from "next/server";
import { getAdminAppCheck } from "@/lib/firebase/admin";

const APP_CHECK_HEADER = "X-Firebase-AppCheck";

export async function verifyAppCheck(request: NextRequest): Promise<boolean> {
  if (
    process.env.SKIP_APP_CHECK === "true" ||
    process.env.USE_DEV_MOCK === "true"
  ) {
    return true;
  }

  const token = request.headers.get(APP_CHECK_HEADER);
  if (!token) return false;

  try {
    await getAdminAppCheck().verifyToken(token);
    return true;
  } catch {
    return false;
  }
}

export function appCheckUnauthorized() {
  return Response.json(
    { error: "Não foi possível concluir esta operação. Tente novamente." },
    { status: 403 }
  );
}
