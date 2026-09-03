"use client";

export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);

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

export async function reliableApiFetch(
  url: string,
  options: RequestInit = {},
  config: { retries?: number; timeoutMs?: number } = {}
): Promise<Response> {
  const retries = config.retries ?? 2;
  const timeoutMs = config.timeoutMs ?? 12_000;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await apiFetch(url, { ...options, signal: controller.signal });
      if (response.status < 500 || attempt === retries) return response;
      lastError = new Error(`Servidor indisponível (${response.status}).`);
    } catch (error) {
      lastError = error;
      if (attempt === retries) throw error;
    } finally {
      window.clearTimeout(timeout);
    }
    await new Promise((resolve) => window.setTimeout(resolve, 700 * 2 ** attempt + Math.random() * 250));
  }
  throw lastError instanceof Error ? lastError : new Error("Não foi possível concluir a requisição.");
}
