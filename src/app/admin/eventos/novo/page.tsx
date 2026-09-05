"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { onAdminAuthChange, getAdminIdToken } from "@/lib/supabase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { slugify } from "@/lib/utils/format";
import { DAILY_ACTIVE_SLUG } from "@/lib/constants";
import { AdminShell } from "@/components/admin/AdminShell";
import { cn } from "@/lib/utils";

interface CreatedEvent {
  eventId: string;
  slug: string;
  title: string;
}

interface AvailableEvent {
  id: string;
  title: string;
  slug: string;
  status: string;
  sequenceId: string | null;
  sequenceOrder: number | null;
  sequenceRootSlug: string | null;
}

function EventCreatedView({ created }: { created: CreatedEvent }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [eventUrl, setEventUrl] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/e/${DAILY_ACTIVE_SLUG}`;
    setEventUrl(url);
    QRCode.toDataURL(url, { width: 260, margin: 2 }).then(setQrDataUrl);
  }, []);

  async function copyLink() {
    await navigator.clipboard.writeText(eventUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AdminShell eventId={created.eventId} eventTitle={created.title} eventSlug={created.slug}>
      <section className="max-w-[720px]">
        <h1 className="m-0 text-[26px] font-bold tracking-[-0.01em]">Evento criado</h1>
        <p className="mt-1.5 mb-0 text-sm text-[#5b6b7f]">{created.title}</p>

        <div className="mt-6 bg-white border border-[#dde4ee] rounded-lg p-[22px]">
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="QR Code fixo do sistema" className="w-52 h-52 mx-auto mb-4" />
          )}
          <p className="m-0 text-[12.5px] font-semibold text-[#33415c]">Link único de participação</p>
          <p className="mt-1 mb-0 text-[12.5px] text-[#8a97a8] leading-snug">
            O mesmo QR serve para todos os eventos. A ordem do dia é definida em
            &quot;Organizar sequência&quot; — o link acompanha o evento em andamento.
          </p>
          <div className="flex items-center gap-2 mt-2 mb-4">
            <code className="flex-1 text-xs bg-[#f7f9fc] border border-[#dde4ee] rounded-md px-3 py-2 truncate">
              {eventUrl}
            </code>
            <button
              type="button"
              onClick={copyLink}
              className="h-9 px-3 text-[13px] font-semibold text-[#0b3a6e] border border-[#c9d4e2] rounded-md"
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link
              href={`/admin/eventos/${created.eventId}/rodadas/nova`}
              className="inline-flex items-center h-10 px-4 text-sm font-semibold bg-[#0b3a6e] text-white rounded-md no-underline"
            >
              Criar primeira rodada
            </Link>
            <Link
              href={`/admin/eventos/${created.eventId}`}
              className="inline-flex items-center h-10 px-4 text-sm font-semibold text-[#0b3a6e] border border-[#c9d4e2] rounded-md no-underline"
            >
              Abrir painel do evento
            </Link>
            <Link
              href={`/print/${DAILY_ACTIVE_SLUG}`}
              target="_blank"
              className="inline-flex items-center h-10 px-4 text-sm font-semibold text-[#0b3a6e] border border-[#c9d4e2] rounded-md no-underline"
            >
              Imprimir A4
            </Link>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}

export default function NovoEventoPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slugOverride, setSlugOverride] = useState("");
  const [isTest, setIsTest] = useState(false);
  const [requireLiveCode, setRequireLiveCode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreatedEvent | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [attachToEventId, setAttachToEventId] = useState("");
  const [availableEvents, setAvailableEvents] = useState<AvailableEvent[]>([]);

  useEffect(() => {
    const unsub = onAdminAuthChange(async (user) => {
      if (!user) {
        router.replace("/admin/login");
        return;
      }
      setAuthReady(true);
      const token = await getAdminIdToken();
      if (!token) return;
      const res = await adminFetch("/api/admin/events", token);
      if (!res.ok) return;
      const data = await res.json();
      setAvailableEvents(
        ((data.events ?? []) as AvailableEvent[]).filter(
          (event) => event.status === "draft" || event.status === "waiting"
        )
      );
    });
    return unsub;
  }, [router]);

  const previewSlug = (slugOverride || slugify(title) || "meu-evento").toLowerCase();

  async function createEvent() {
    setError("");
    setLoading(true);
    try {
      const token = await getAdminIdToken();
      if (!token) throw new Error("Não autenticado.");
      const res = await adminFetch("/api/admin/events", token, {
        method: "POST",
        body: JSON.stringify({
          title,
          slug: previewSlug,
          description: description || null,
          projectorTitle: null,
          isTest,
          requireLiveCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar evento.");
        return;
      }

      if (attachToEventId) {
        const anchor = availableEvents.find((event) => event.id === attachToEventId);
        const existingSequence = anchor?.sequenceId
          ? availableEvents
              .filter((event) => event.sequenceId === anchor.sequenceId)
              .sort((a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0))
              .map((event) => event.id)
          : [attachToEventId];
        const sequenceRes = await adminFetch("/api/admin/events/sequence", token, {
          method: "POST",
          body: JSON.stringify({ eventIds: [...existingSequence, data.eventId] }),
        });
        const sequenceData = await sequenceRes.json();
        if (!sequenceRes.ok) {
          setError(
            `O evento foi criado, mas não foi vinculado à sequência: ${sequenceData.error ?? "erro desconhecido"}`
          );
          return;
        }
      }
      setCreated({
        eventId: data.eventId,
        slug: data.slug,
        title,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar evento.");
    } finally {
      setLoading(false);
    }
  }

  function next() {
    setError("");
    if (step === 1 && title.trim().length < 3) {
      setError("Informe o nome do evento (mínimo 3 caracteres).");
      return;
    }
    if (step === 4) {
      void createEvent();
      return;
    }
    setStep((s) => Math.min(4, s + 1));
  }

  function back() {
    if (step === 1) {
      router.push("/admin/eventos");
      return;
    }
    setStep((s) => Math.max(1, s - 1));
  }

  if (created) return <EventCreatedView created={created} />;

  const steps = [
    { n: 1, label: "Informações" },
    { n: 2, label: "Participação" },
    { n: 3, label: "Acesso" },
    { n: 4, label: "Confirmar" },
  ];

  return (
    <AdminShell screenLabel="Criar evento">
      <section aria-label="Criar evento" className="max-w-[720px]">
        <h1 className="m-0 text-[26px] font-bold tracking-[-0.01em]">Criar evento</h1>
        <p className="mt-1.5 mb-0 text-sm text-[#5b6b7f]">
          Quatro etapas curtas. As rodadas podem ser criadas depois.
        </p>

        <ol className="flex gap-2 list-none m-[22px_0_20px] p-0 flex-wrap">
          {steps.map((st) => (
            <li
              key={st.n}
              className={cn(
                "h-9 px-3 inline-flex items-center gap-2 rounded-md text-[13px] font-semibold border",
                step === st.n
                  ? "bg-[#eef3f9] border-[#0b3a6e] text-[#0b3a6e]"
                  : step > st.n
                    ? "bg-white border-[#c3e4d1] text-[#1a7f4b]"
                    : "bg-white border-[#dde4ee] text-[#8a97a8]"
              )}
            >
              <span className="tabular-nums">{st.n}</span> {st.label}
            </li>
          ))}
        </ol>

        <div className="bg-white border border-[#dde4ee] rounded-lg p-[22px]">
          {step === 1 && (
            <>
              <h2 className="m-0 mb-1 text-base font-semibold">Informações</h2>
              <p className="m-0 mb-[18px] text-[13px] text-[#8a97a8]">
                Como o evento será identificado.
              </p>
              <label className="block mb-1.5 text-[12.5px] font-semibold text-[#33415c]">
                Nome do evento
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Avaliação do Encontro de Monitoramento"
                className="w-full h-[42px] border border-[#c9d4e2] rounded-md px-3 text-sm"
              />
              <label className="block mt-4 mb-1.5 text-[12.5px] font-semibold text-[#33415c]">
                Descrição <span className="font-normal text-[#8a97a8]">(opcional)</span>
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-[#c9d4e2] rounded-md px-3 py-2.5 text-sm resize-y"
              />
              <label className="mt-4 flex items-center gap-2 text-sm text-[#33415c]">
                <input
                  type="checkbox"
                  checked={isTest}
                  onChange={(e) => setIsTest(e.target.checked)}
                  className="w-[18px] h-[18px] accent-[#0b3a6e]"
                />
                Evento de teste
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="m-0 mb-1 text-base font-semibold">Participação</h2>
              <p className="m-0 mb-[18px] text-[13px] text-[#8a97a8]">
                Como as pessoas se apresentam ao responder.
              </p>
              <div className="flex flex-col gap-2.5">
                <div className="border border-[#0b3a6e] bg-[#eef3f9] rounded-md p-3.5">
                  <p className="m-0 text-sm font-semibold">Permitir identificada e anônima</p>
                  <p className="mt-1.5 mb-0 text-[13px] text-[#5b6b7f]">
                    O participante escolhe na entrada. Comportamento padrão do sistema.
                  </p>
                </div>
                <div className="border border-[#dde4ee] rounded-md p-3.5 opacity-60">
                  <p className="m-0 text-sm font-semibold text-[#33415c]">Somente identificada</p>
                  <p className="mt-1.5 mb-0 text-[13px] text-[#5b6b7f]">
                    Exige nome completo de todos. (em breve)
                  </p>
                </div>
                <div className="border border-[#dde4ee] rounded-md p-3.5 opacity-60">
                  <p className="m-0 text-sm font-semibold text-[#33415c]">Somente anônima</p>
                  <p className="mt-1.5 mb-0 text-[13px] text-[#5b6b7f]">
                    Nenhum nome é coletado. (em breve)
                  </p>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="m-0 mb-1 text-base font-semibold">Acesso</h2>
              <p className="m-0 mb-[18px] text-[13px] text-[#8a97a8]">
                O link e o QR Code são gerados a partir do endereço do evento.
              </p>
              <label className="block mb-1.5 text-[12.5px] font-semibold text-[#33415c]">
                Endereço do evento
              </label>
              <div className="flex items-center border border-[#c9d4e2] rounded-md overflow-hidden">
                <span className="px-2.5 h-[42px] inline-flex items-center bg-[#f7f9fc] border-r border-[#dde4ee] text-[13px] text-[#8a97a8] whitespace-nowrap">
                  /e/
                </span>
                <input
                  value={slugOverride || slugify(title)}
                  onChange={(e) => setSlugOverride(slugify(e.target.value))}
                  placeholder="monitoramento-2026"
                  className="flex-1 min-w-0 h-[42px] border-0 px-3 text-sm outline-none"
                />
              </div>
              <p className="mt-[18px] mb-0 text-[12.5px] text-[#8a97a8] leading-relaxed">
                Os participantes entram pelo QR Code ou pelo link.
              </p>
              <label className="mt-4 flex items-center gap-2 text-sm text-[#33415c]">
                <input
                  type="checkbox"
                  checked={requireLiveCode}
                  onChange={(e) => setRequireLiveCode(e.target.checked)}
                  className="w-[18px] h-[18px] accent-[#0b3a6e]"
                />
                Exigir código temporário no projetor
              </label>
              <div className="mt-5 border-t border-[#eef1f5] pt-5">
                <label className="block mb-1.5 text-[12.5px] font-semibold text-[#33415c]">
                  Compartilhar QR Code com outro evento <span className="font-normal text-[#8a97a8]">(opcional)</span>
                </label>
                <select
                  value={attachToEventId}
                  onChange={(e) => setAttachToEventId(e.target.value)}
                  className="h-[42px] w-full rounded-md border border-[#c9d4e2] bg-white px-3 text-sm text-[#33415c]"
                >
                  <option value="">Usar um QR Code próprio</option>
                  {availableEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      Anexar depois de “{event.title}”{event.sequenceId ? " (sequência existente)" : ""}
                    </option>
                  ))}
                </select>
                <p className="mb-0 mt-2 text-xs leading-relaxed text-[#8a97a8]">
                  O novo evento será o próximo da sequência e usará o mesmo QR Code do primeiro.
                </p>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="m-0 mb-1 text-base font-semibold">Confirmar</h2>
              <p className="m-0 mb-[18px] text-[13px] text-[#8a97a8]">Revise antes de criar.</p>
              <div className="border border-[#dde4ee] rounded-md p-4 space-y-2 text-[13px] text-[#5b6b7f]">
                <p className="m-0">
                  <strong className="text-[#33415c]">Nome:</strong> {title}
                </p>
                <p className="m-0">
                  <strong className="text-[#33415c]">Link:</strong> /e/{previewSlug}
                </p>
                <p className="m-0">
                  Status inicial: <strong className="text-[#33415c]">Aguardando</strong>, sem
                  rodadas.
                </p>
                {attachToEventId && (
                  <p className="m-0">
                    QR Code compartilhado com: <strong className="text-[#33415c]">{availableEvents.find((event) => event.id === attachToEventId)?.title}</strong>
                  </p>
                )}
                {isTest && (
                  <p className="m-0">
                    Selo: <strong className="text-[#8a5a00]">Evento de teste</strong>
                  </p>
                )}
              </div>
            </>
          )}

          {error && (
            <div className="mt-4 text-sm text-[#b42318] bg-[#fdf2f1] border border-[#e3b3ad] rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex justify-between gap-2.5 mt-[22px] pt-[18px] border-t border-[#eef1f5] flex-wrap">
            <button
              type="button"
              onClick={back}
              className="h-10 px-4 text-sm font-semibold text-[#33415c] border border-[#c9d4e2] rounded-md hover:bg-[#f4f6f9]"
            >
              {step === 1 ? "Cancelar" : "Voltar"}
            </button>
            <button
              type="button"
              onClick={next}
              disabled={loading || !authReady}
              className="h-10 px-[18px] text-sm font-semibold bg-[#0b3a6e] text-white rounded-md hover:bg-[#0d4a8a] disabled:opacity-60"
            >
              {loading ? "Criando..." : step === 4 ? "Criar evento" : "Continuar"}
            </button>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
