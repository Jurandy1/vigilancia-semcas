"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { SemcasHeader } from "@/components/participant/SemcasLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { useAppCheck } from "@/hooks/use-app-check";
import { apiFetch } from "@/lib/api-client";
import { useParticipantStore } from "@/stores/participant-store";
import { formatAccessCode } from "@/lib/utils/format";

export default function AccessCodePage() {
  useAppCheck();
  const router = useRouter();
  const params = useParams();
  const eventSlug = params.eventSlug as string;
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setParticipant } = useParticipantStore();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await apiFetch(`/api/events/${eventSlug}/join`, {
        method: "POST",
        body: JSON.stringify({
          mode: "anonymous",
          accessCode: code.replace(/\s/g, ""),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Código inválido.");
        return;
      }

      setParticipant(data.participantId, data.mode, data.name);
      router.push(`/e/${eventSlug}/participar?mode=anonymous&verified=1`);
    } catch {
      setError("Não foi possível validar o código. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-6 max-w-md mx-auto">
      <SemcasHeader title="Código de acesso" />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="code">Informe o código exibido no projetor</Label>
          <Input
            id="code"
            inputMode="numeric"
            placeholder="000 000"
            value={formatAccessCode(code)}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="text-center text-2xl tracking-widest font-mono"
            autoComplete="off"
            autoFocus
          />
        </div>

        {error && <Alert variant="destructive">{error}</Alert>}

        <Button type="submit" size="xl" disabled={loading || code.length < 6}>
          {loading ? "Verificando..." : "CONTINUAR"}
        </Button>
      </form>
    </main>
  );
}
