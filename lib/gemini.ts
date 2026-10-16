import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { ConsultedPage, Usage } from "./schemas";

// "gemini-flash-latest" suit automatiquement le dernier modèle Flash ; GEMINI_MODEL permet d'en imposer un.
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 15_000;

let client: GoogleGenAI | null = null;
function getClient() {
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export class AnalysisError extends Error {
  constructor(
    message: string,
    readonly code?: "quota",
  ) {
    super(message);
  }
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
        if (attempt < MAX_RETRIES) {
          onProgress("Limite de requêtes Gemini atteinte, nouvelle tentative dans 15 s…");
          await wait(RETRY_DELAY_MS);
          continue;
        }
        throw new AnalysisError("Quota gratuit de Gemini atteint. Réessayez plus tard (la limite se remet à zéro chaque jour).", "quota");
      }
      if (err instanceof ApiError && (err.status === 400 || err.status === 403) && /api key/i.test(err.message)) {
        throw new AnalysisError("Clé Gemini invalide (GEMINI_API_KEY).");
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
