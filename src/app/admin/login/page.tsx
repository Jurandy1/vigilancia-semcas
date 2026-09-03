"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminLogin, getAdminIdToken } from "@/lib/supabase/auth-client";
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

    if (!email.trim() || !password) {
      setError("Informe e-mail e senha para continuar.");
      return;
    }

    setLoading(true);
    try {
      await adminLogin(email, password);
      const idToken = await getAdminIdToken();
      const destination = await resolvePostLoginDestination(idToken ?? "");
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
    <div className="min-h-screen flex flex-col bg-[#f4f6f9] text-[#1a1a1a]">
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2">
        <div className="bg-[#0b3a6e] text-white p-8 sm:p-12 md:p-16 flex flex-col justify-between gap-10 min-w-0">
          <div className="bg-white rounded px-3.5 py-2.5 w-fit">
            <Image
              src="/images/logo-prefeitura-saoluis.jpg"
              alt="Prefeitura de São Luís"
              width={190}
              height={62}
              priority
              className="block w-[190px] h-auto"
            />
          </div>
          <div>
            <p className="m-0 text-[22px] sm:text-[28px] font-bold tracking-[0.1em]">SEMCAS</p>
            <p className="mt-2 mb-0 text-[15px] sm:text-lg text-white/70 leading-relaxed max-w-[26ch]">
              Secretaria Municipal da Criança e Assistência Social
            </p>
            <p className="mt-7 mb-0 text-[17px] sm:text-[21px] leading-relaxed text-white max-w-[30ch] text-pretty">
              Plataforma de participação e avaliação em tempo real.
            </p>
          </div>
          <p className="m-0 text-[12.5px] text-white/50 leading-relaxed">
            Acesso restrito a servidores autorizados.
            <br />
            Prefeitura de São Luís
          </p>
        </div>

        <div className="flex items-center justify-center p-7 sm:p-10 md:p-14 min-w-0">
          <form onSubmit={handleSubmit} className="w-full max-w-[400px]">
            <h1 className="m-0 text-2xl font-bold tracking-[-0.01em]">Entrar no sistema</h1>
            <p className="mt-2 mb-[26px] text-sm text-[#5b6b7f]">
              Use suas credenciais institucionais.
            </p>

            {error && (
              <div
                role="alert"
                className="border border-[#e3b3ad] bg-[#fdf2f1] rounded-md px-3.5 py-3 mb-[18px]"
              >
                <p className="m-0 text-[13.5px] text-[#b42318] leading-relaxed">{error}</p>
              </div>
            )}

            <label
              htmlFor="lg-email"
              className="block mb-1.5 text-[12.5px] font-semibold text-[#33415c]"
            >
              E-mail institucional
            </label>
            <input
              id="lg-email"
              type="email"
              autoComplete="username"
              placeholder="nome@saoluis.ma.gov.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 border border-[#c9d4e2] rounded-md px-3 text-[15px] bg-white outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0b3a6e] focus-visible:outline-offset-2"
              required
            />

            <label
              htmlFor="lg-senha"
              className="block mt-4 mb-1.5 text-[12.5px] font-semibold text-[#33415c]"
            >
              Senha
            </label>
            <input
              id="lg-senha"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 border border-[#c9d4e2] rounded-md px-3 text-[15px] bg-white outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0b3a6e] focus-visible:outline-offset-2"
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-[22px] h-[46px] bg-[#0b3a6e] text-white border border-[#0b3a6e] rounded-md text-[15px] font-semibold hover:bg-[#0d4a8a] disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>

            <p className="mt-[18px] mb-0 text-[12.5px] text-[#8a97a8] leading-relaxed">
              Problemas de acesso? Procure a equipe responsável pelo sistema na SEMCAS.
            </p>

            <p className="mt-[26px] mb-0 pt-[18px] border-t border-[#e2e8f0] text-[13px] text-[#5b6b7f]">
              Vai apenas responder a um evento?{" "}
              <Link href="/" className="text-[#0b3a6e] hover:underline">
                Acesse pelo link ou QR Code do evento
              </Link>
              .
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
