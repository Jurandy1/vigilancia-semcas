"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { SemcasHeader } from "@/components/participant/SemcasLogo";
import { Button } from "@/components/ui/button";

export default function ConcluidoPage() {
  const router = useRouter();
  const params = useParams();
  const eventSlug = params.eventSlug as string;

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace(`/e/${eventSlug}/aguarde`);
    }, 2000);
    return () => clearTimeout(timer);
  }, [eventSlug, router]);

  return (
    <main className="min-h-screen p-6 max-w-md mx-auto flex flex-col items-center justify-center text-center">
      <SemcasHeader />
      <div className="text-4xl text-accent mb-4">✓</div>
      <h2 className="text-lg font-semibold mb-2">Resposta enviada</h2>
      <p className="text-sm text-muted-foreground mb-8">
        Obrigado pela sua participação.
      </p>
      <Button variant="outline" onClick={() => router.replace(`/e/${eventSlug}/aguarde`)}>
        Continuar
      </Button>
    </main>
  );
}
