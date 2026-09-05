"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SemcasBrand } from "@/components/branding/SemcasBrand";
import { ORG_TAGLINE, SECRETARIAT_NAME, ORG_SHORT, CITY_NAME } from "@/lib/branding";
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
    <div style={{ minHeight: "100vh", background: "#eef2f7", display: "flex", alignItems: "center", padding: "26px 22px" }}>
      <div style={{ margin: "0 auto", width: "100%", maxWidth: "1240px", border: "1px solid #dbe4ef", borderRadius: "10px", overflow: "hidden", background: "#fff", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", minHeight: "560px" }}>
        
        <div style={{ background: "#082F57", color: "#fff", padding: "40px 38px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "36px", minWidth: 0 }}>
          <div>
            <p style={{ margin: 0, fontSize: "10.5px", fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: "rgba(255,255,255,.6)" }}>{CITY_NAME}</p>
            <p style={{ margin: "14px 0 0", fontSize: "34px", fontWeight: 700, letterSpacing: ".12em", lineHeight: 1 }}>{ORG_SHORT}</p>
            <p style={{ margin: "14px 0 0", fontSize: "15px", lineHeight: 1.55, color: "rgba(255,255,255,.72)", maxWidth: "28ch" }}>Secretaria Municipal da Criança e Assistência Social</p>
          </div>
          <div>
            <span aria-hidden="true" style={{ display: "block", width: "44px", height: "2px", background: "#65d49b", marginBottom: "18px" }}></span>
            <p style={{ margin: 0, fontSize: "19px", lineHeight: 1.5, color: "#fff", maxWidth: "30ch", textWrap: "pretty" }}>Plataforma de participação e avaliação em tempo real.</p>
          </div>
          <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.7, color: "rgba(255,255,255,.5)" }}>Acesso restrito a servidores autorizados.<br />Sistema oficial da {CITY_NAME}.</p>
        </div>

        <div style={{ padding: "40px 38px", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
          <form onSubmit={handleSubmit} style={{ margin: "0 auto", width: "100%", maxWidth: "400px" }}>
            {/* The brand component could be used here, but we will use the raw img from mockup to be safe, or just stick to the exact styles */}
            <img src="/logo-prefeitura-saoluis.jpg" alt="Prefeitura de São Luís" style={{ height: "52px", width: "auto", display: "block", marginBottom: "28px" }} />
            
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, letterSpacing: "-.018em", color: "#11243c" }}>Entrar no sistema</h1>
            <p style={{ margin: "8px 0 26px", fontSize: "13.5px", color: "#5b6b7f" }}>Use suas credenciais institucionais.</p>

            {error && (
              <div role="alert" style={{ border: "1px solid #e3b3ad", background: "#fdf2f1", borderRadius: "8px", padding: "12px 14px", marginBottom: "18px" }}>
                <p style={{ margin: 0, fontSize: "13.5px", color: "#b42318", lineHeight: 1.6 }}>{error}</p>
              </div>
            )}

            <label htmlFor="pub-email" style={{ display: "block", marginBottom: "6px", fontSize: "12.5px", fontWeight: 600, color: "#33415c" }}>E-mail institucional</label>
            <input
              id="pub-email"
              type="email"
              autoComplete="username"
              placeholder="nome@saoluis.ma.gov.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", maxWidth: "400px", height: "44px", border: "1px solid #c9d4e2", borderRadius: "8px", padding: "0 12px", fontSize: "15px", background: "#fff", color: "#11243c", outline: "none" }}
              required
            />

            <label htmlFor="pub-senha" style={{ display: "block", margin: "16px 0 6px", fontSize: "12.5px", fontWeight: 600, color: "#33415c" }}>Senha</label>
            <input
              id="pub-senha"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", maxWidth: "400px", height: "44px", border: "1px solid #c9d4e2", borderRadius: "8px", padding: "0 12px", fontSize: "15px", background: "#fff", color: "#11243c", outline: "none" }}
              required
            />

            <button
              type="submit"
              disabled={loading}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "100%", maxWidth: "400px", height: "46px", marginTop: "22px", background: "#0B3A6E", border: "1px solid #0B3A6E", borderRadius: "8px", fontSize: "15px", fontWeight: 600, color: "#fff", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>

            <p style={{ margin: "18px 0 0", maxWidth: "400px", fontSize: "12.5px", lineHeight: 1.6, color: "#8a97a8" }}>Problemas de acesso? Procure a equipe responsável pelo sistema na {ORG_SHORT}.</p>
            <p style={{ margin: "24px 0 0", maxWidth: "400px", paddingTop: "18px", borderTop: "1px solid #e2e8f0", fontSize: "13px", color: "#5b6b7f" }}>
              Vai apenas responder a um evento?{" "}
              <Link href="/" style={{ color: "#0B3A6E", textDecoration: "none" }}>Acesse pelo link ou QR Code do evento</Link>.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
