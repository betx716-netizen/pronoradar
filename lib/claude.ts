import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { ConsultedPage, Usage } from "./schemas";

export const MODEL = "claude-opus-5-5";

// Tarifs Claude Opus 5.5 (USD) — servent uniquement à afficher une estimation.
const PRICE_INPUT_PER_MTOK = 4;
const PRICE_OUTPUT_PER_MTOK = 20;
const PRICE_CACHE_READ_PER_MTOK = 0.2;
const PRICE_PER_WEB_SEARCH = 0.01;

const MAX_CONTINUATIONS = 6;

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic();
  return client;
}

export class AnalysisError extends Error {}

export function emptyUsage(): Usage {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, webSearches: 0, estimatedCostUsd: 0 };
}

function addUsage(total: Usage, u: Anthropic.Beta.BetaUsage | Anthropic.Usage) {
  total.inputTokens += u.input_tokens;
  total.outputTokens += u.output_tokens;
  total.cacheReadTokens += u.cache_read_input_tokens ?? 0;
  total.webSearches += u.server_tool_use?.web_search_requests ?? 0;
  total.estimatedCostUsd =
    (total.inputTokens * PRICE_INPUT_PER_MTOK +
      total.outputTokens * PRICE_OUTPUT_PER_MTOK +
      total.cacheReadTokens * PRICE_CACHE_READ_PER_MTOK) /
      1_000_000 +
    total.webSearches * PRICE_PER_WEB_SEARCH;
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

type ResearchOptions = {
  system: string;
  prompt: string;
  maxSearches: number;
  effort: "low" | "medium" | "high";
  usage: Usage;
  onProgress: (message: string) => void;
};

/**
 * Laisse Claude chercher sur le web jusqu'à ce qu'il ait fini, en relayant chaque
 * recherche au navigateur. Renvoie le dossier rédigé et la liste des pages consultées.
 */
export async function researchWithWeb(opts: ResearchOptions) {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: opts.prompt }];
  const pages = new Map<string, ConsultedPage>();
  const texts: string[] = [];

  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const stream = getClient().beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: opts.effort },
      system: opts.system,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: opts.maxSearches }],
      messages,
    });

    stream.on("contentBlock", (block) => {
      if (block.type === "server_tool_use" && block.name === "web_search") {
        const query = (block.input as { query?: string }).query;
        if (query) opts.onProgress(`Recherche : « ${query} »`);
      } else if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) pages.set(r.url, { title: r.title, url: r.url });
        opts.onProgress(`${block.content.length} résultats trouvés`);
      }
    });

    const response = await stream.finalMessage();
    addUsage(opts.usage, response.usage);

    if (response.stop_reason === "refusal") {
      throw new AnalysisError("La demande a été refusée par le modèle. Reformulez le match et réessayez.");
    }
    for (const block of response.content) {
      if (block.type === "text") texts.push(block.text);
    }
    if (response.stop_reason === "pause_turn") {
      // Recherche longue : on renvoie le tour en pause pour que Claude continue.
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    if (response.stop_reason === "max_tokens") {
      throw new AnalysisError("La réponse a été coupée (trop longue). Réessayez.");
    }
    break;
  }

  const dossier = texts.join("").trim();
  if (!dossier) throw new AnalysisError("Aucun résultat exploitable n'a été trouvé.");
  return { dossier, consultedPages: [...pages.values()] };
}

/** Transforme un texte libre en JSON conforme au schéma (sorties structurées). */
export async function structure<T extends z.ZodType>(
  schema: T,
  instructions: string,
  text: string,
  usage: Usage,
): Promise<z.infer<T>> {
  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 32000,
    output_config: { effort: "low", format: zodOutputFormat(schema) },
    system: instructions,
    messages: [{ role: "user", content: text }],
  });
  addUsage(usage, response.usage);
  if (response.stop_reason === "refusal") {
    throw new AnalysisError("La mise en forme a été refusée par le modèle. Réessayez.");
  }
  if (!response.parsed_output) {
    throw new AnalysisError("Impossible de mettre en forme les résultats. Réessayez.");
  }
  return response.parsed_output as z.infer<T>;
}
