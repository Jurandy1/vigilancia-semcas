"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SemcasLogo } from "@/components/participant/SemcasLogo";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <SemcasLogo size="md" className="mb-6" />
      <h1 className="text-lg font-semibold mb-2">Algo deu errado</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Não foi possível carregar esta página. Tente novamente.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>Tentar novamente</Button>
        <Button variant="outline" asChild>
          <Link href="/">Início</Link>
        </Button>
      </div>
    </main>
  );
}
