// Services de secours, gratuits, utilisés quand le quota de l'IA principale est épuisé :
// - Groq (https://console.groq.com) : modèle de langage, environ 1 000 requêtes par jour gratuites ;
// - Tavily (https://tavily.com) : recherche web, 1 000 recherches par mois gratuites.
import { readKey } from "./env";
import type { ConsultedPage } from "./schemas";

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const PAUSE_MS = 30 * 60_000;
const paused = { groq: 0, tavily: 0 };

export const hasGroq = () => Boolean(readKey("GROQ_API_KEY"));
export const hasTavily = () => Boolean(readKey("TAVILY_API_KEY"));
export const groqAvailable = () => hasGroq() && Date.now() >= paused.groq;
export const tavilyAvailable = () => hasTavily() && Date.now() >= paused.tavily;

export class BackupQuotaError extends Error {}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Une réponse du modèle de secours ; `json` impose une réponse JSON. */
export async function groqChat(system: string, prompt: string, onProgress: (m: string) => void, json = false): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${readKey("GROQ_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.3,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (res.status === 429) {
      const retry = Number(res.headers.get("retry-after"));
      // Limite par minute : courte attente. Limite du jour : on met le service de côté un moment.
      if (attempt < 2 && Number.isFinite(retry) && retry <= 20) {
        onProgress(`Limite de requêtes de l'IA de secours atteinte, nouvelle tentative dans ${Math.ceil(retry)} s…`);
        await wait(retry * 1000 + 500);
        continue;
      }
      paused.groq = Date.now() + PAUSE_MS;
      throw new BackupQuotaError("Quota de l'IA de secours atteint.");
    }
    if (res.status >= 500 && attempt < 2) {
      await wait(3000);
      continue;
    }
    if (!res.ok) throw new Error(`IA de secours : erreur ${res.status} ${await res.text().catch(() => "")}`);
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) throw new Error("IA de secours : réponse vide.");
    return text;
  }
}

type TavilyResult = { title?: string; url?: string; content?: string };

/** Quelques recherches web ; renvoie un résumé des résultats à donner au modèle, et les pages trouvées. */
export async function webSearch(queries: string[], onProgress: (m: string) => void) {
  const pages = new Map<string, ConsultedPage>();
  const snippets: string[] = [];
  for (const query of queries) {
    onProgress(`Recherche web : « ${query} »`);
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${readKey("TAVILY_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, max_results: 6, search_depth: "basic", topic: "general" }),
    });
    if (res.status === 429 || res.status === 432 || res.status === 433) {
      paused.tavily = Date.now() + PAUSE_MS;
      break;
    }
    if (!res.ok) continue;
    const results: TavilyResult[] = (await res.json().catch(() => null))?.results ?? [];
    for (const r of results) {
      if (!r.url || pages.has(r.url)) continue;
      pages.set(r.url, { title: r.title ?? r.url, url: r.url });
      snippets.push(`- ${r.title ?? ""} (${r.url}) : ${(r.content ?? "").replace(/\s+/g, " ").slice(0, 700)}`);
    }
  }
  return { snippets, pages: [...pages.values()], searches: queries.length };
}
