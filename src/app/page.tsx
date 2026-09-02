import Link from "next/link";
import { SemcasHeader } from "@/components/participant/SemcasLogo";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 max-w-md mx-auto">
      <SemcasHeader
        title="Plataforma de Avaliações"
        subtitle="Secretaria Municipal de Saúde — SEMCAS"
      />
      <p className="text-sm text-muted-foreground text-center mb-8">
        Participe de avaliações e consultas em eventos presenciais escaneando o QR Code
        disponibilizado no local.
      </p>
      <Button variant="outline" asChild>
        <Link href="/admin/login">Acesso administrativo</Link>
      </Button>
    </main>
  );
}
