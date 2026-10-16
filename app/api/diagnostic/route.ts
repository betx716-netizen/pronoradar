import { describeKey, readKey } from "@/lib/env";

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

export async function GET() {
  const odds = readKey("ODDS_API_KEY");
  const football = readKey("API_FOOTBALL_KEY");
  const gemini = readKey("GEMINI_API_KEY");
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-flash-latest";
  return Response.json({
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
