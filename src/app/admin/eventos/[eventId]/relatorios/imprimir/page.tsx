"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/firebase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";

interface RoundReport {
  round: { id: string; title: string };
  summary: { totalParticipants: number; totalSubmissions: number; participationRate: string };
  questions: Array<{
    id: string;
    title: string;
    type: string;
    options?: Array<{ option: string; count: number; percent: string }>;
    answers?: Array<{ displayName: string; value: string }>;
  }>;
}

export default function EventReportPrintPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const [eventTitle, setEventTitle] = useState("");
  const [reports, setReports] = useState<RoundReport[] | null>(null);

  useEffect(() => {
    const unsub = onAdminAuthChange((user) => {
      if (!user) router.replace("/admin/login");
    });
    return unsub;
  }, [router]);

  useEffect(() => {
    async function load() {
      const token = await getAdminIdToken();
      if (!token) return;

      const dashRes = await adminFetch(`/api/admin/events/${eventId}/dashboard`, token);
      const dash = await dashRes.json();
      setEventTitle(dash.event?.title ?? "");

      const rounds = (dash.rounds ?? []) as Array<{ id: string; title: string }>;
      const loaded = await Promise.all(
        rounds.map(async (r) => {
          const res = await adminFetch(
            `/api/admin/events/${eventId}/rounds/${r.id}/report`,
            token
          );
          return (await res.json()) as RoundReport;
        })
      );
      setReports(loaded);
    }
    load();
  }, [eventId]);

  if (!reports) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white p-10 print:p-6 max-w-3xl mx-auto">
      <header className="text-center mb-10 print:mb-6">
        <Image
          src="/images/logo-prefeitura-saoluis.jpg"
          alt="Prefeitura de São Luís"
          width={220}
          height={71}
          className="mx-auto mb-4"
          priority
        />
        <h1 className="text-xl font-bold">{eventTitle}</h1>
        <p className="text-sm text-gray-500 mt-1">Relatório consolidado do evento</p>
      </header>

      {reports.map((r) => (
        <section key={r.round.id} className="mb-10 break-inside-avoid">
          <h2 className="text-base font-semibold border-b border-gray-300 pb-2 mb-4">
            {r.round.title}
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            {r.summary.totalSubmissions} respostas de {r.summary.totalParticipants} participantes
            ({r.summary.participationRate})
          </p>

          {r.questions.map((q, i) => (
            <div key={q.id} className="mb-6">
              <p className="text-sm font-medium mb-2">
                {i + 1}. {q.title}
              </p>

              {q.type === "single_choice" && q.options && (
                <table className="w-full text-sm border border-gray-200">
                  <tbody>
                    {q.options.map((opt) => (
                      <tr key={opt.option} className="border-b border-gray-100">
                        <td className="p-1.5">{opt.option}</td>
                        <td className="p-1.5 text-right w-16">{opt.count}</td>
                        <td className="p-1.5 text-right w-16">{opt.percent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {q.type === "text" && q.answers && (
                <div className="space-y-2">
                  {q.answers.map((a, j) => (
                    <div key={j} className="text-sm border-b border-gray-100 pb-2">
                      <span className="font-medium">{a.displayName}: </span>
                      <span className="text-gray-600">&ldquo;{a.value}&rdquo;</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      ))}

      <button
        className="no-print mt-4 px-6 py-2 border border-gray-300 rounded-md text-sm"
        onClick={() => window.print()}
      >
        Imprimir / Salvar como PDF
      </button>
    </main>
  );
}
