import { getEventBySlug } from "@/lib/data/events";
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
      <main className="min-h-screen flex items-center justify-center p-6">
        <p className="text-muted-foreground">Evento não encontrado.</p>
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
