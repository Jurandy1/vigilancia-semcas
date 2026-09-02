"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminIdToken } from "@/lib/firebase/auth-client";
import { adminFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { slugify } from "@/lib/utils/format";
import { AdminShell } from "@/components/admin/AdminShell";

export default function NovoEventoPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [isTest, setIsTest] = useState(false);
  const [requireLiveCode, setRequireLiveCode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const token = await getAdminIdToken();
      if (!token) throw new Error("Não autenticado.");

      const res = await adminFetch("/api/admin/events", token, {
        method: "POST",
        body: JSON.stringify({
          title,
          slug: slug || slugify(title),
          description: description || null,
          isTest,
          requireLiveCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar evento.");
        return;
      }

      router.push(`/admin/eventos/${data.eventId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar evento.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Novo evento</h1>
      </div>

      <div className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slug) setSlug(slugify(e.target.value));
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug (URL)</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="monitoramento-2026"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isTest} onChange={(e) => setIsTest(e.target.checked)} />
            Evento de teste
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={requireLiveCode}
              onChange={(e) => setRequireLiveCode(e.target.checked)}
            />
            Exigir código temporário para entrar
          </label>

          {error && <Alert variant="destructive">{error}</Alert>}

          <Button type="submit" disabled={loading}>
            {loading ? "Salvando..." : "Criar evento"}
          </Button>
        </form>
      </div>
    </AdminShell>
  );
}
