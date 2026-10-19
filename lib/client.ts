"use client";

import type { StreamEvent } from "./schemas";
import { maskProviders } from "./mask";

export class UnauthorizedError extends Error {}
export class QuotaError extends Error {}

const PASSWORD_KEY = "pronoradar:password";
const HISTORY_KEY = "pronoradar:history";
const FAVORITES_KEY = "pronoradar:favorites";

export function loadFavorites(sport: string, fallback: string[]): string[] {
  try {
    const all = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "{}") as Record<string, string[]>;
    return all[sport]?.length ? all[sport] : fallback;
  } catch {
    return fallback;
  }
}

export function saveFavorites(sport: string, leagues: string[]) {
  try {
    const all = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "{}") as Record<string, string[]>;
    localStorage.setItem(FAVORITES_KEY, JSON.stringify({ ...all, [sport]: leagues }));
  } catch {}
}

export function getPassword(): string {
  try {
    return localStorage.getItem(PASSWORD_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setPassword(value: string) {
  try {
    localStorage.setItem(PASSWORD_KEY, value);
  } catch {}
}

export function loadHistory<T>(): T[] {
  try {
    // Les analyses enregistrées avant le masquage des noms de services sont masquées à la lecture.
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]", (k, v) => (typeof v === "string" && k !== "url" ? maskProviders(v) : v)) as T[];
  } catch {
    return [];
  }
}

export function saveHistory<T>(items: T[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {}
}

/** Appelle une route qui répond en NDJSON et relaie la progression. */
export async function callStreaming<T>(
  url: string,
  body: unknown,
  onProgress: (message: string) => void,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(url, {
    signal,
    method: "POST",
    headers: { "Content-Type": "application/json", "x-app-password": getPassword() },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new UnauthorizedError("Mot de passe requis.");
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

  if (result === undefined) throw new Error("La connexion a été interrompue avant la fin. Réessayez.");
  return result;
}
