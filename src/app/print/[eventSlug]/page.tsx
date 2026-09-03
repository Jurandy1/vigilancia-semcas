import { headers } from "next/headers";
import { getEventBySlug } from "@/lib/data/events";
import { PrintPoster } from "./PrintPoster";

export const runtime = "nodejs";

export default async function PrintPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;
  const event = await getEventBySlug(eventSlug);

  if (!event) {
    return (
      <main className="p-12 text-center">
        <p>Evento não encontrado.</p>
      </main>
    );
  }

  // Nunca confiar só no fallback fixo: se NEXT_PUBLIC_APP_URL não estiver
  // configurada no ambiente de produção, isso imprimiria "localhost" no
  // pôster real. Preferimos sempre o host da requisição atual.
  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  const appUrl = host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return <PrintPoster event={event} appUrl={appUrl} />;
}
