"use client";

import type { StreamEvent } from "./schemas";
import { getToken } from "./session";

export class UnauthorizedError extends Error {}
export class PremiumError extends Error {}
export class QuotaError extends Error {}

/** fetch avec le jeton de session du compte connecté. */
export async function authFetch(url: string, init: RequestInit = {}) {
  const token = await getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers, cache: "no-store" });
}

/** Appel JSON avec gestion des erreurs courantes (connexion requise, réservé Premium). */
export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(url, init);
  const data = await res.json().catch(() => null);
  if (res.status === 401) throw new UnauthorizedError(data?.error ?? "Connecte-toi pour continuer.");
  if (res.status === 402) throw new PremiumError(data?.error ?? "Réservé aux membres Premium.");
  if (!res.ok) throw new Error(data?.error ?? `Erreur ${res.status}`);
  return data as T;
}

/** Appelle une route qui répond en NDJSON et relaie la progression. */
export async function callStreaming<T>(url: string, body: unknown, onProgress: (message: string) => void, signal?: AbortSignal): Promise<T> {
  const res = await authFetch(url, { signal, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.status === 401) throw new UnauthorizedError("Connecte-toi pour continuer.");
  if (res.status === 402) throw new PremiumError("L'analyse en direct est réservée aux membres Premium.");
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? `Erreur ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: T | undefined;

  const handle = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as StreamEvent;
    if (event.type === "progress") onProgress(event.message);
    else if (event.type === "error") throw event.code === "quota" ? new QuotaError(event.message) : new Error(event.message);
    else result = event.data as T;
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(handle);
  }
  handle(buffer);

  if (result === undefined) throw new Error("La connexion a été interrompue avant la fin. Réessaie.");
  return result;
}
