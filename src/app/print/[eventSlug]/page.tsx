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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return <PrintPoster event={event} appUrl={appUrl} />;
}
