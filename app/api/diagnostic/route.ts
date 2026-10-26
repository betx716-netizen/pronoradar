import { describeKey, readKey } from "@/lib/env";
import { getViewer } from "@/lib/user";

export const dynamic = "force-dynamic";

// Teste chaque clé en direct et renvoie la réponse brute du service (les clés restent masquées).
async function probe(url: string, init?: RequestInit) {
  try {
    const res = await fetch(url, { ...init, cache: "no-store" });
    const text = await res.text();
    return { status: res.status, response: text.slice(0, 400) };
  } catch (e) {
    return { status: 0, response: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET(req: Request) {
  if (!(await getViewer(req))?.admin) return Response.json({ error: "Réservé à l'administrateur." }, { status: 403 });
  const odds = readKey("ODDS_API_KEY");
  const football = readKey("API_FOOTBALL_KEY");
  const gemini = readKey("GEMINI_API_KEY");
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-flash-latest";
  const tavily = readKey("TAVILY_API_KEY");
  const groq = readKey("GROQ_API_KEY");
  return Response.json({
    "Direct mondial (Sofascore)": {
      test: await probe("https://api.sofascore.com/api/v1/sport/football/events/live", {
        headers: { "User-Agent": "Mozilla/5.0 (PronoRadar)", Accept: "application/json" },
      }),
    },
    "Recherche web de secours (Tavily)": {
      cle: describeKey("TAVILY_API_KEY"),
      test: tavily
        ? await probe("https://api.tavily.com/search", {
            method: "POST",
            headers: { Authorization: `Bearer ${tavily}`, "content-type": "application/json" },
            body: JSON.stringify({ query: "Ligue 1 prochains matchs", max_results: 1 }),
          })
        : "pas de clé",
    },
    "IA de secours (Groq)": {
      cle: describeKey("GROQ_API_KEY"),
      test: groq
        ? await probe("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${groq}` } })
        : "pas de clé",
    },
    "The Odds API": {
      cle: describeKey("ODDS_API_KEY"),
      test: odds ? await probe(`https://api.the-odds-api.com/v4/sports?apiKey=${encodeURIComponent(odds)}`) : "pas de clé",
    },
    "API-Football": {
      cle: describeKey("API_FOOTBALL_KEY"),
      test: football ? await probe("https://v3.football.api-sports.io/status", { headers: { "x-apisports-key": football } }) : "pas de clé",
    },
    Gemini: {
      cle: describeKey("GEMINI_API_KEY"),
      modele: model,
      test: gemini
        ? await probe(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": gemini },
            body: JSON.stringify({ contents: [{ parts: [{ text: "Réponds OK." }] }] }),
          })
        : "pas de clé",
    },
  });
}
