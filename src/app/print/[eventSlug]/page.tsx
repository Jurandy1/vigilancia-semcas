import { headers } from "next/headers";
import { PrintPoster } from "./PrintPoster";

export const runtime = "nodejs";

/**
 * Qualquer /print/<slug> imprime o mesmo cartaz com o QR fixo (/e/atual).
 * O parâmetro eventSlug existe só para não quebrar links antigos do admin.
 */
export default async function PrintPage() {
  // Nunca confiar só no fallback fixo: se NEXT_PUBLIC_APP_URL não estiver
  // configurada no ambiente de produção, isso imprimiria "localhost" no
  // pôster real. Preferimos sempre o host da requisição atual.
  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  const appUrl = host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return <PrintPoster appUrl={appUrl} />;
}
