// Les services utilisés en coulisse ne sont jamais nommés à l'écran : on les remplace par ce qu'ils font.
const RULES: [RegExp, string][] = [
  [/,?\s*modèle\s+gemini[\w.-]*/gi, ""],
  [/\s*\(GEMINI_API_KEY\)/g, ""],
  [/Recherche des pronostics sur Google \(Gemini\)/g, "Recherche des pronostics sur le web"],
  [/([Rr])echerche(s?) Google/g, "$1echerche$2 web"],
  [/sur Google/g, "sur le web"],
  [/(par|de) Gemini/g, "$1 l'IA"],
  [/Gemini/g, "IA"],
  [/The Odds API/g, "notre service de cotes"],
  [/API-Football \(modèle statistique\)/g, "Modèle statistique"],
  [/API-Football/g, "modèle statistique"],
  [/Supabase/g, "sauvegarde en ligne"],
  [/Google/g, "web"],
];

export const maskProviders = (text: string) => RULES.reduce((t, [re, to]) => t.replace(re, to), text);

/** Réponse JSON dont tous les textes (hors adresses web) passent par le masquage des noms de services. */
export const maskedJson = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data, (k, v) => (typeof v === "string" && k !== "url" ? maskProviders(v) : v)), {
    ...init,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
