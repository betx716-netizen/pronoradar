import { readKey } from "./env";
import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { ConsultedPage, Usage } from "./schemas";
import { BackupQuotaError, groqAvailable, groqChat, hasGroq, tavilyAvailable, webSearch } from "./backup";

// "gemini-flash-latest" suit automatiquement le dernier modèle Flash ; GEMINI_MODEL permet d'en imposer un.
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const MAX_RETRIES = 2;
const MAX_RETRY_DELAY_MS = 20_000;
const QUOTA_PAUSE_MS = 30 * 60_000;

export const hasGemini = () => Boolean(readKey("GEMINI_API_KEY"));

// Après un quota épuisé, on ne réessaie plus Gemini pendant un moment : inutile de faire attendre chaque match.
// Deux quotas distincts chez Google : la recherche Google intégrée s'épuise bien avant Gemini lui-même.
const pausedUntil = { search: 0, plain: 0 };
export const geminiAvailable = () => hasGemini() && Date.now() >= pausedUntil.plain;

// Recherche Google intégrée : chaque modèle a son propre quota gratuit, souvent minuscule sur le tout dernier.
// On essaie donc plusieurs modèles dans l'ordre ; GEMINI_SEARCH_MODELS (séparés par des virgules) permet d'imposer la liste.
export const SEARCH_MODELS = [
  ...new Set(
    (process.env.GEMINI_SEARCH_MODELS || `${MODEL},gemini-2.5-flash,gemini-2.5-flash-lite,gemini-2.0-flash`)
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean),
  ),
];
const searchPausedUntil: Record<string, number> = {};
const searchModelsLeft = () => SEARCH_MODELS.filter((m) => Date.now() >= (searchPausedUntil[m] ?? 0));
export const googleSearchAvailable = () => geminiAvailable() && Date.now() >= pausedUntil.search && searchModelsLeft().length > 0;

// Avec les services de secours : une IA (principale ou de secours) et une recherche web (intégrée ou de secours).
export const hasAI = () => hasGemini() || hasGroq();
export const aiAvailable = () => geminiAvailable() || groqAvailable();
export const webSearchAvailable = () => googleSearchAvailable() || (tavilyAvailable() && aiAvailable());

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
    // Vrai quand seule la recherche Google est épuisée : Gemini reste utilisable sans le web.
    readonly searchOnly = false,
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
    limit === "0" ? "aucune requête gratuite pour ce service" : limit !== undefined && `limite de ${limit} requêtes ${perDay ? "par jour" : "par minute"}`,
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

/** Prochaine remise à zéro des quotas Gemini : minuit heure du Pacifique (+ 5 min de marge). */
function nextQuotaReset() {
  const now = new Date();
  const la = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const toMidnight = (24 - la.getHours()) * 3600_000 - la.getMinutes() * 60_000 - la.getSeconds() * 1000;
  return now.getTime() + toMidnight + 5 * 60_000;
}

// Le palier gratuit limite le nombre de requêtes par minute : on patiente puis on réessaie.
async function withRetry<T>(fn: () => Promise<T>, onProgress: (m: string) => void, kind: "search" | "plain" = "plain"): Promise<T> {
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
        // Quota du jour (ou recherche non incluse dans l'offre gratuite) : inutile de réessayer avant demain.
        // Quota du jour épuisé : pause jusqu'à la remise à zéro (minuit en Californie, 8 h UTC en hiver), pas 12 h au hasard.
        pausedUntil[kind] = hardLimit ? nextQuotaReset() : Date.now() + QUOTA_PAUSE_MS;
        console.error("Quota Gemini :", err.message);
        throw new AnalysisError(
          kind === "search" ? `Gemini : quota gratuit de recherche Google atteint${detail}.` : `Gemini : quota gratuit atteint${detail}.`,
          "quota",
          true,
          kind === "search",
        );
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
async function geminiResearch(opts: {
  system: string;
  prompt: string;
  usage: Usage;
  onProgress: (message: string) => void;
}) {
  let response: Awaited<ReturnType<ReturnType<typeof getClient>["models"]["generateContent"]>> | null = null;
  let lastError: unknown = null;
  for (const model of searchModelsLeft()) {
    try {
      response = await withRetry(
        () =>
          getClient().models.generateContent({
            model,
            contents: opts.prompt,
            config: { systemInstruction: opts.system, tools: [{ googleSearch: {} }] },
          }),
        opts.onProgress,
        "search",
      );
      break;
    } catch (e) {
      lastError = e;
      const quota = e instanceof AnalysisError && e.searchOnly;
      const missing = e instanceof ApiError && (e.status === 404 || (e.status === 400 && /not (found|supported)|google_search|tool/i.test(e.message)));
      if (!quota && !missing) throw e;
      // Ce modèle n'a plus de recherche (ou ne la propose pas) : on le met de côté et on essaie le suivant.
      searchPausedUntil[model] = quota ? nextQuotaReset() : Date.now() + 24 * 3600_000;
      pausedUntil.search = 0;
      console.error(`Recherche Google indisponible avec ${model} :`, e instanceof Error ? e.message : e);
      if (searchModelsLeft().length) opts.onProgress("Recherche Google : essai avec un autre modèle…");
    }
  }
  if (!response) {
    if (lastError instanceof AnalysisError) throw lastError;
    throw new AnalysisError("Recherche Google indisponible pour le moment (quota atteint).", "quota", false, true);
  }
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
async function geminiStructure<T extends z.ZodType>(
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

/** Gemini sans recherche web : quand le quota de recherche Google est épuisé, il raisonne sur les données fournies. */
async function geminiWrite(opts: { system: string; prompt: string; usage: Usage; onProgress: (message: string) => void }) {
  const response = await withRetry(
    () => getClient().models.generateContent({ model: MODEL, contents: opts.prompt, config: { systemInstruction: opts.system } }),
    opts.onProgress,
  );
  opts.usage.geminiRequests++;
  const text = response.text?.trim();
  if (!text) throw new AnalysisError("Aucun résultat exploitable n'a été trouvé.");
  return { text, consultedPages: [] as ConsultedPage[] };
}

// ——— Points d'entrée, avec bascule automatique sur les services de secours ———

type WriteOpts = { system: string; prompt: string; usage: Usage; onProgress: (message: string) => void };

const backupQuota = () => new AnalysisError("IA : quota gratuit atteint, y compris pour l'IA de secours. Réessayez plus tard.", "quota", true);
const canFallBack = (e: unknown) => e instanceof AnalysisError && e.geminiUnavailable && groqAvailable();

async function groqWrite(opts: WriteOpts) {
  try {
    const text = await groqChat(opts.system, opts.prompt, opts.onProgress);
    opts.usage.geminiRequests++;
    return { text, consultedPages: [] as ConsultedPage[] };
  } catch (e) {
    if (e instanceof BackupQuotaError) throw backupQuota();
    throw e;
  }
}

/** Rédaction sans recherche web : IA principale, sinon IA de secours. */
export async function writeWithoutSearch(opts: WriteOpts) {
  if (geminiAvailable()) {
    try {
      return await geminiWrite(opts);
    } catch (e) {
      if (!canFallBack(e)) throw e;
      opts.onProgress("Bascule sur l'IA de secours…");
    }
  }
  if (groqAvailable()) return groqWrite(opts);
  throw backupQuota();
}

/**
 * Recherche sur le web puis rédaction d'un dossier : recherche intégrée de l'IA principale,
 * sinon recherche web de secours dont les résultats sont confiés à l'IA disponible.
 */
export async function researchWithGoogle(opts: WriteOpts & { queries?: string[] }) {
  if (googleSearchAvailable()) {
    try {
      return await geminiResearch(opts);
    } catch (e) {
      const recoverable = e instanceof AnalysisError && (e.searchOnly || e.geminiUnavailable);
      if (!recoverable || !tavilyAvailable() || !aiAvailable()) throw e;
      opts.onProgress("Bascule sur la recherche web de secours…");
    }
  }
  if (!tavilyAvailable() || !aiAvailable()) {
    throw new AnalysisError("Recherche web indisponible pour le moment (quota atteint).", "quota", false, true);
  }
  const queries = opts.queries?.length ? opts.queries : [opts.prompt.replace(/\s+/g, " ").slice(0, 160)];
  const { snippets, pages, searches } = await webSearch(queries.slice(0, 2), opts.onProgress);
  opts.usage.webSearches += searches;
  // Recherche de secours vide (quota épuisé, aucun résultat) : ce n'est pas une analyse vérifiée.
  if (snippets.length === 0) {
    throw new AnalysisError("Recherche web de secours sans résultat pour le moment.", "quota", false, true);
  }
  const written = await writeWithoutSearch({
    ...opts,
    system: `${opts.system}\n\nTu n'as pas d'accès direct au web : appuie-toi UNIQUEMENT sur les résultats de recherche fournis, cite leurs sources par leur nom, et n'invente rien.`,
    prompt: `${opts.prompt}\n\nRésultats de recherche web :\n${snippets.join("\n") || "(aucun résultat)"}`,
  });
  return { text: written.text, consultedPages: pages };
}

/** Transforme un texte en JSON conforme au schéma : IA principale, sinon IA de secours (vérifié par zod). */
export async function structure<T extends z.ZodType>(
  schema: T,
  instructions: string,
  text: string,
  usage: Usage,
  onProgress: (message: string) => void,
): Promise<z.infer<T>> {
  if (geminiAvailable()) {
    try {
      return await geminiStructure(schema, instructions, text, usage, onProgress);
    } catch (e) {
      if (!canFallBack(e)) throw e;
      onProgress("Bascule sur l'IA de secours…");
    }
  }
  if (!groqAvailable()) throw backupQuota();
  const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema, { target: "draft-7" });
  const system = `${instructions}\n\nRéponds UNIQUEMENT avec un objet JSON valide conforme à ce schéma JSON (mêmes noms de champs, tous les champs obligatoires présents) :\n${JSON.stringify(jsonSchema)}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: string;
    try {
      raw = await groqChat(system, text, onProgress, true);
    } catch (e) {
      if (e instanceof BackupQuotaError) throw backupQuota();
      throw e;
    }
    usage.geminiRequests++;
    try {
      const parsed = schema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    } catch {
      // JSON invalide : nouvelle tentative.
    }
  }
  throw new AnalysisError("Impossible de mettre en forme les résultats. Réessayez.");
}
