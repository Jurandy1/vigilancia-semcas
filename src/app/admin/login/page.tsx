"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SemcasHeader } from "@/components/participant/SemcasLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { adminLogin } from "@/lib/firebase/auth-client";
import { resolvePostLoginDestination } from "@/lib/admin/post-login-destination";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await adminLogin(email, password);
      const idToken = await user.getIdToken();
      const destination = await resolvePostLoginDestination(idToken);
      router.push(destination);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível realizar o login."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <SemcasHeader title="Acesso administrativo" subtitle="SEMCAS" />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <Alert variant="destructive">{error}</Alert>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "ENTRAR"}
          </Button>
        </form>
      </div>
    </main>
  );
}
