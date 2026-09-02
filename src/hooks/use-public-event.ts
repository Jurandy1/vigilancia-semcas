"use client";

import { useEffect, useState } from "react";
import type { PublicEvent } from "@/types/event";
import { useParticipantStore } from "@/stores/participant-store";

const IS_MOCK =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_USE_DEV_MOCK === "true";

export function usePublicEvent(eventId: string | null, eventSlug?: string | null) {
  const [publicEvent, setPublicEvent] = useState<PublicEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const setConnectionState = useParticipantStore((s) => s.setConnectionState);

  useEffect(() => {
    if (!eventId && !eventSlug) {
      setLoading(false);
      return;
    }

    if (IS_MOCK && eventSlug) {
      setConnectionState("connecting");

      async function poll() {
        try {
          const res = await fetch(`/api/dev/public-event/${eventSlug}`);
          const data = await res.json();
          if (data.publicEvent) {
            setPublicEvent(data.publicEvent);
            setConnectionState("connected");
          }
        } catch {
          setConnectionState("error");
        } finally {
          setLoading(false);
        }
      }

      poll();
      const interval = setInterval(poll, 5000);
      return () => clearInterval(interval);
    }

    if (!eventId) {
      setLoading(false);
      return;
    }

    const resolvedEventId = eventId;
    setConnectionState("connecting");

    let unsubscribe: (() => void) | undefined;

    async function subscribe() {
      const { doc, onSnapshot } = await import("firebase/firestore");
      const { getFirestoreDb } = await import("@/lib/firebase/client");
      const db = getFirestoreDb();
      const ref = doc(db, "publicEvents", resolvedEventId);

      unsubscribe = onSnapshot(
        ref,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setPublicEvent({
              id: snapshot.id,
              slug: data.slug,
              title: data.title,
              description: data.description ?? null,
              status: data.status,
              requireLiveCode: data.requireLiveCode,
              currentOpenRoundId: data.currentOpenRoundId ?? null,
              currentRoundTitle: data.currentRoundTitle ?? null,
              currentRoundStatus: data.currentRoundStatus ?? null,
              accessChallenge: data.accessChallenge
                ? {
                    code: data.accessChallenge.code,
                    expiresAt:
                      data.accessChallenge.expiresAt?.toDate?.()?.toISOString?.() ??
                      data.accessChallenge.expiresAt,
                    rotationSeconds: data.accessChallenge.rotationSeconds ?? 60,
                  }
                : null,
              updatedAt:
                data.updatedAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
            });
          }
          setLoading(false);
          setConnectionState("connected");
        },
        () => {
          setConnectionState("error");
          setLoading(false);
        }
      );
    }

    subscribe();

    return () => {
      unsubscribe?.();
    };
  }, [eventId, eventSlug, setConnectionState]);

  return { publicEvent, loading };
}
