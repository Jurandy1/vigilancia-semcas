"use client";

import { getAppCheckToken } from "@/hooks/use-app-check";

export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);

  const appCheckToken = await getAppCheckToken();
  if (appCheckToken) {
    headers.set("X-Firebase-AppCheck", appCheckToken);
  }

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, { ...options, headers, credentials: "include" });
}

export async function adminFetch(
  url: string,
  idToken: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${idToken}`);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...options, headers });
}
