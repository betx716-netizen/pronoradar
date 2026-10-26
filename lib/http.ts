import { ApiError } from "@google/genai";
import { ApiFootballError, apiFootballSeasonBlocked, hasApiFootball } from "./apifootball";
import { AnalysisError, hasAI } from "./gemini";
import { hasGroq, hasTavily } from "./backup";
import { OddsApiError, hasOddsApi } from "./odds";
import type { ServicesStatus, StreamEvent } from "./schemas";
import { maskProviders } from "./mask";
import { isAuthorized } from "./auth";

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

// Si APP_PASSWORD est défini, seules les requêtes portant ce mot de passe passent :
// évite qu'un inconnu consomme votre crédit API.
export function guard(req: Request): Response | null {
  const s = servicesStatus();
  if (!s.demo && !s.gemini && !s.odds && !s.apiFootball) {
    return Response.json(
      { error: "Service non configuré : les clés d'accès manquent dans les réglages du serveur." },
      { status: 500 },
    );
  }
  if (isAuthorized(req)) return null;
  return Response.json({ error: "Connexion requise." }, { status: 401 });
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
