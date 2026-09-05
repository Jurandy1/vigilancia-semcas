import { getEventBySlug } from "@/lib/data/events";
import { DAILY_ACTIVE_SLUG } from "@/lib/constants";
import { EventEntryClient } from "./EventEntryClient";

export const runtime = "nodejs";

export default async function EventPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;
  const event = await getEventBySlug(eventSlug);

  if (!event) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-lg font-semibold mb-2 text-[#11243c]">
            {eventSlug === DAILY_ACTIVE_SLUG ? "Nenhum evento na fila" : "Evento não encontrado"}
          </h1>
          <p className="text-[#5b6b7f] text-[14.5px] max-w-[36ch] mx-auto">
            {eventSlug === DAILY_ACTIVE_SLUG
              ? "Aguarde o organizador preparar a sequência do dia. Esta página libera sozinha quando houver um evento disponível."
              : "Verifique o link ou escaneie novamente o QR Code do evento."}
          </p>
        </div>
      </main>
    );
  }

  if (event.status === "closed") {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-lg font-semibold mb-2">{event.title}</h1>
          <p className="text-muted-foreground">Este evento foi encerrado.</p>
        </div>
      </main>
    );
  }

  return <EventEntryClient event={{ ...event, description: event.description ?? null }} />;
}
