"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

// "Ao vivo" foi unificada com "Visão geral" em /admin/eventos/[eventId] — este
// redirecionamento evita quebrar links salvos/favoritados para a URL antiga.
export default function AoVivoRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  useEffect(() => {
    router.replace(`/admin/eventos/${eventId}`);
  }, [eventId, router]);

  return null;
}
