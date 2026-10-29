import { ApiError } from "@google/genai";
import { ApiFootballError, apiFootballSeasonBlocked, hasApiFootball } from "./apifootball";
import { AnalysisError, hasAI } from "./gemini";
import { hasGroq, hasTavily } from "./backup";
import { OddsApiError, hasOddsApi } from "./odds";
import type { ServicesStatus, StreamEvent } from "./schemas";
import { maskProviders } from "./mask";
import { getMaintenance, maintenanceResponse } from "./maintenance";
import { getViewer, premiumRequired, unauthorized } from "./user";

export const isDemo = () => process.env.DEMO_MODE === "1";

export const servicesStatus = (): ServicesStatus => ({
  gemini: hasAI(),
  odds: hasOddsApi(),
  apiFootball: hasApiFootball(),
  demo: isDemo(),
  statsLimited: apiFootballSeasonBlocked(),
  backupAI: hasGroq(),
  backupSearch: hasTavily(),
});

/** Services non configurés : refuse tout de suite. */
function notConfigured(): Response | null {
  const s = servicesStatus();
  if (!s.demo && !s.gemini && !s.odds && !s.apiFootball) {
    return Response.json(
      { error: "Service non configuré : les clés d'accès manquent dans les réglages du serveur." },
      { status: 500 },
    );
  }
  return null;
}

/** Actions qui consomment l'IA et les API (analyses, coupons, coach, direct) : réservées aux membres Premium. */
export async function guard(req: Request): Promise<Response | null> {
  const nc = notConfigured();
  if (nc) return nc;
  const viewer = await getViewer(req);
  if (!viewer) return unauthorized();
  const m = await getMaintenance();
  if (m.on && !viewer.admin) return maintenanceResponse(m.message);
  if (!viewer.premium) return premiumRequired();
  return null;
}

/** Lecture ouverte à tous (programme des matchs, mis en cache 2 heures). */
export async function guardOpen(req: Request): Promise<Response | null> {
  const nc = notConfigured();
  if (nc) return nc;
  // Pendant les travaux, seuls les administrateurs peuvent lancer des analyses ou charger les programmes.
  const m = await getMaintenance();
  if (m.on && !(await getViewer(req).catch(() => null))?.admin) return maintenanceResponse(m.message);
  return null;
}

function errorEvent(err: unknown): StreamEvent {
  if (err instanceof AnalysisError) return { type: "error", message: err.message, code: err.code };
  if (err instanceof OddsApiError || err instanceof ApiFootballError) return { type: "error", message: err.message };
  if (err instanceof ApiError && err.status >= 500) {
    return { type: "error", message: "Gemini est momentanément indisponible. Réessayez." };
  }
  console.error(err);
  return { type: "error", message: "Une erreur inattendue est survenue." };
}

/** Exécute une tâche longue en envoyant sa progression ligne par ligne (NDJSON). */
export function streamTask(task: (progress: (message: string) => void) => Promise<unknown>): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      // Tout ce qui part vers le navigateur passe par le masquage des noms de services (hors adresses web).
      const send = (e: StreamEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(e, (k, v) => (typeof v === "string" && k !== "url" ? maskProviders(v) : v)) + "\n"));
      try {
        const data = await task((message) => send({ type: "progress", message }));
        send({ type: "result", data });
      } catch (err) {
        send(errorEvent(err));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
