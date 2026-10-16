import { readKey } from "./env";
import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { ConsultedPage, Usage } from "./schemas";

// "gemini-flash-latest" suit automatiquement le dernier modèle Flash ; GEMINI_MODEL permet d'en imposer un.
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const MAX_RETRIES = 2;
const MAX_RETRY_DELAY_MS = 20_000;
const QUOTA_PAUSE_MS = 30 * 60_000;

export const hasGemini = () => Boolean(readKey("GEMINI_API_KEY"));

// Après un quota épuisé, on ne réessaie plus Gemini pendant un moment : inutile de faire attendre chaque match.
let pausedUntil = 0;
export const geminiAvailable = () => hasGemini() && Date.now() >= pausedUntil;

let client: GoogleGenAI | null = null;
function getClient() {
  client ??= new GoogleGenAI({ apiKey: readKey("GEMINI_API_KEY") });
  return client;
}

export class AnalysisError extends Error {
  constructor(
    message: string,
    readonly code?: "quota",
    // Vrai quand l'erreur vient de Gemini lui-même (quota, clé) : on peut alors se rabattre sur le calcul.
    readonly geminiUnavailable = false,
  ) {
    super(message);
  }
}

// Extrait du message de Google la limite atteinte (ex. « limit: 20, model: gemini-3-flash ») et le délai conseillé.
function quotaDetails(message: string) {
  const limit = message.match(/limit:\s*(\d+)/)?.[1];
  const model = message.match(/model:\s*([\w.-]+)/)?.[1];
  const perDay = /PerDay|per day/i.test(message);
  const retrySeconds = Number(message.match(/retry in ([\d.]+)s/i)?.[1] ?? NaN);
  const parts = [
    limit !== undefined && `limite de ${limit} requêtes ${perDay ? "par jour" : "par minute"}`,
    model && `modèle ${model}`,
  ].filter(Boolean);
  return { detail: parts.length ? ` (${parts.join(", ")})` : "", hardLimit: perDay || limit === "0", retrySeconds };
}

export function emptyUsage(): Usage {
  return { geminiRequests: 0, webSearches: 0, oddsRequestsRemaining: null, apiFootballRequestsRemaining: null };
}

export function todayInParis() {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Le palier gratuit limite le nombre de requêtes par minute : on patiente puis on réessaie.
async function withRetry<T>(fn: () => Promise<T>, onProgress: (m: string) => void): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        const { detail, hardLimit, retrySeconds } = quotaDetails(err.message);
        // Limite par minute : on patiente et on réessaie. Limite par jour (ou nulle) : inutile d'attendre.
        if (!hardLimit && attempt < MAX_RETRIES) {
          const delay = Math.min(Number.isFinite(retrySeconds) ? retrySeconds * 1000 + 1000 : 15_000, MAX_RETRY_DELAY_MS);
          onProgress(`Limite de requêtes Gemini par minute atteinte, nouvelle tentative dans ${Math.round(delay / 1000)} s…`);
          await wait(delay);
          continue;
        }
        pausedUntil = Date.now() + QUOTA_PAUSE_MS;
        console.error("Quota Gemini :", err.message);
        throw new AnalysisError(`Gemini : quota gratuit atteint${detail}.`, "quota", true);
      }
      if (err instanceof ApiError && (err.status === 400 || err.status === 403) && /api key|permission/i.test(err.message)) {
        throw new AnalysisError("Gemini : clé invalide ou non autorisée (GEMINI_API_KEY).", undefined, true);
      }
      if (err instanceof ApiError && err.status >= 500 && attempt < MAX_RETRIES) {
        await wait(3000);
        continue;
      }
      throw err;
    }
  }
}

/**
 * Laisse Gemini chercher sur Google puis rédiger un dossier.
 * Renvoie le texte, les pages consultées et les requêtes Google effectuées.
 */
export async function researchWithGoogle(opts: {
  system: string;
  prompt: string;
  usage: Usage;
  onProgress: (message: string) => void;
}) {
  const response = await withRetry(
    () =>
      getClient().models.generateContent({
        model: MODEL,
        contents: opts.prompt,
        config: { systemInstruction: opts.system, tools: [{ googleSearch: {} }] },
      }),
    opts.onProgress,
  );
  opts.usage.geminiRequests++;

  const meta = response.candidates?.[0]?.groundingMetadata;
  const queries = meta?.webSearchQueries ?? [];
  opts.usage.webSearches += queries.length;
  for (const q of queries) opts.onProgress(`Recherche Google : « ${q} »`);

  const pages = new Map<string, ConsultedPage>();
  for (const chunk of meta?.groundingChunks ?? []) {
    if (chunk.web?.uri) pages.set(chunk.web.uri, { title: chunk.web.title ?? chunk.web.uri, url: chunk.web.uri });
  }

  const text = response.text?.trim();
  if (!text) {
    const reason = response.candidates?.[0]?.finishReason;
    throw new AnalysisError(
      reason === "SAFETY" ? "La recherche a été bloquée par les filtres de Gemini. Réessayez." : "Aucun résultat exploitable n'a été trouvé.",
    );
  }
  return { text, consultedPages: [...pages.values()] };
}

/** Transforme un texte libre en JSON conforme au schéma (sortie structurée de Gemini, vérifiée par zod). */
export async function structure<T extends z.ZodType>(
  schema: T,
  instructions: string,
  text: string,
  usage: Usage,
  onProgress: (message: string) => void,
): Promise<z.infer<T>> {
  const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema, { target: "draft-7" });
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await withRetry(
      () =>
        getClient().models.generateContent({
          model: MODEL,
          contents: text,
          config: { systemInstruction: instructions, responseMimeType: "application/json", responseJsonSchema: jsonSchema },
        }),
      onProgress,
    );
    usage.geminiRequests++;
    try {
      const parsed = schema.safeParse(JSON.parse(response.text ?? ""));
      if (parsed.success) return parsed.data;
    } catch {
      // JSON invalide : on refait une tentative.
    }
  }
  throw new AnalysisError("Impossible de mettre en forme les résultats. Réessayez.");
}
