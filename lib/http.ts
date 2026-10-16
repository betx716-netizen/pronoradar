import Anthropic from "@anthropic-ai/sdk";
import { AnalysisError } from "./claude";
import type { StreamEvent } from "./schemas";

export const isDemo = () => process.env.DEMO_MODE === "1";

// Si APP_PASSWORD est défini, seules les requêtes portant ce mot de passe passent :
// évite qu'un inconnu consomme votre crédit API.
export function guard(req: Request): Response | null {
  if (!isDemo() && !process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "Clé API manquante : définissez ANTHROPIC_API_KEY (ou DEMO_MODE=1 pour tester sans clé)." },
      { status: 500 },
    );
  }
  const expected = process.env.APP_PASSWORD;
  if (!expected || req.headers.get("x-app-password") === expected) return null;
  return Response.json({ error: "Mot de passe incorrect." }, { status: 401 });
}

function errorMessage(err: unknown): string {
  if (err instanceof AnalysisError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) return "Clé API Anthropic invalide ou absente (ANTHROPIC_API_KEY).";
  if (err instanceof Anthropic.RateLimitError) return "Trop de requêtes en même temps. Patientez une minute et réessayez.";
  if (err instanceof Anthropic.InternalServerError) return "Le service d'IA est momentanément indisponible. Réessayez.";
  if (err instanceof Anthropic.APIConnectionError) return "Impossible de joindre le service d'IA. Vérifiez la connexion.";
  console.error(err);
  return "Une erreur inattendue est survenue.";
}

/** Exécute une tâche longue en envoyant sa progression ligne par ligne (NDJSON). */
export function streamTask(task: (progress: (message: string) => void) => Promise<unknown>): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const send = (e: StreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        const data = await task((message) => send({ type: "progress", message }));
        send({ type: "result", data });
      } catch (err) {
        send({ type: "error", message: errorMessage(err) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
