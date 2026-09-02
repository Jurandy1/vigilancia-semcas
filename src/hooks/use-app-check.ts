"use client";

import { useEffect } from "react";
import { initializeAppCheck, ReCaptchaV3Provider, getToken } from "firebase/app-check";
import { getFirebaseApp } from "@/lib/firebase/client";

let appCheckInitialized = false;
let appCheckInstance: ReturnType<typeof initializeAppCheck> | null = null;

export function useAppCheck() {
  useEffect(() => {
    if (appCheckInitialized) return;
    if (typeof window === "undefined") return;

    const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY;
    if (!siteKey) return;

    if (process.env.NODE_ENV === "development") {
      const debugToken = process.env.NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN;
      if (debugToken) {
        // @ts-expect-error debug token for development
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
      }
    }

    try {
      appCheckInstance = initializeAppCheck(getFirebaseApp(), {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
      appCheckInitialized = true;
    } catch {
      appCheckInitialized = true;
    }
  }, []);
}

export async function getAppCheckToken(): Promise<string | null> {
  if (!appCheckInstance) return null;
  try {
    const result = await getToken(appCheckInstance, false);
    return result.token;
  } catch {
    return null;
  }
}
