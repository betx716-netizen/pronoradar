import { emptyUsage, researchWithWeb, structure, todayInParis } from "./claude";
import { computeConsensus } from "./consensus";
import { AnalysisSchema, type AnalysisResult, type AnalyzeRequest } from "./schemas";

const researchSystem = (sourcesTarget: string) => `Tu es un analyste sportif rigoureux. Ton travail : recenser sur le web les pronostics publiés par d'autres pour un match précis, puis donner ta propre analyse.

Règles de recherche :
- Cherche des sources variées et indépendantes, en français et en anglais. Vise ${sourcesTarget} sources distinctes réparties ainsi :
  1. Cotes des bookmakers ou des bourses de paris (comparateurs de cotes, Betfair…). Relève les cotes décimales de chaque issue.
  2. Modèles statistiques (Forebet, modèles xG, Opta, sites de prédictions chiffrées). Relève leurs probabilités en %.
  3. Pronostiqueurs et médias (sites de pronostics, journaux sportifs, experts). Relève leur pronostic et leur argument.
- Recherche aussi le contexte : forme récente, blessés et suspendus, compositions probables, confrontations directes, enjeu du match. Au tennis : surface, classement, forme, fatigue, historique sur la surface.
- Ne retiens que des pronostics qui concernent bien CE match à CETTE date. Écarte les pages d'une saison ou d'une rencontre précédente.
- N'invente jamais un pronostic, une cote ou une URL. Si une information manque, dis-le.

Rédige ensuite un dossier en français avec :
1. Le match (compétition, date, lieu ou surface).
2. La liste des sources, une par ligne : nom, URL exacte, type (bookmaker / exchange / stats_model / tipster / media), issue pronostiquée, probabilités ou cotes s'il y en a, autres pronostics (score, buts, sets…), argument résumé, date de publication.
3. Le contexte (forme, absences, confrontations directes, faits marquants).
4. Ce qui ressort de l'ensemble des pronostics : où ils convergent, où ils divergent.
5. TA propre analyse : probabilités en % pour chaque issue, issue la plus probable, score ou sets probables, niveau de confiance (faible / moyenne / élevée), facteurs clés, risques, et en quoi tu rejoins ou contredis le consensus. Sois honnête sur l'incertitude.`;

const STRUCTURE_SYSTEM = `Tu convertis un dossier d'analyse sportive en JSON. Recopie fidèlement les informations du dossier, sans rien inventer.
- "home" désigne l'équipe à domicile (ou le joueur 1), "away" l'équipe à l'extérieur (ou le joueur 2), "draw" le match nul.
- Au tennis, il n'y a pas de nul : mets prob_draw, odds_draw à null pour les sources et ai_analysis.prob_draw à 0.
- Les probabilités sont en pourcentage (0 à 100). Les cotes sont décimales (ex : 1.85).
- Garde les URL exactement comme dans le dossier. Une source sans URL n'est pas retenue.
- Rédige tous les textes en français.`;

// Le mode rapide fait moins de recherches : moins cher, pour analyser beaucoup de matchs.
const MODE_SETTINGS = {
  rapide: { maxSearches: 6, effort: "medium", sourcesTarget: "5 à 8" },
  complete: { maxSearches: 15, effort: "high", sourcesTarget: "8 à 15" },
} as const;

export async function analyzeMatch(
  req: AnalyzeRequest,
  onProgress: (message: string) => void,
): Promise<AnalysisResult> {
  const usage = emptyUsage();
  const sportLabel = req.sport === "football" ? "football" : "tennis";
  const match =
    req.sport === "football" ? `${req.home} (domicile) contre ${req.away} (extérieur)` : `${req.home} contre ${req.away}`;

  const prompt = [
    `Nous sommes le ${todayInParis()}.`,
    `Match de ${sportLabel} : ${match}.`,
    req.competition ? `Compétition : ${req.competition}.` : "",
    req.date ? `Date indiquée : ${req.date}.` : "Si la date n'est pas précisée, prends la prochaine rencontre entre eux.",
    "Recense les pronostics publiés sur ce match, puis donne ton analyse.",
  ]
    .filter(Boolean)
    .join("\n");

  const settings = MODE_SETTINGS[req.mode];
  onProgress("Lancement des recherches sur le web…");
  const { dossier, consultedPages } = await researchWithWeb({
    system: researchSystem(settings.sourcesTarget),
    prompt,
    maxSearches: settings.maxSearches,
    effort: settings.effort,
    usage,
    onProgress,
  });

  onProgress("Synthèse des pronostics recensés…");
  const analysis = await structure(AnalysisSchema, STRUCTURE_SYSTEM, dossier, usage);
  analysis.match.sport = req.sport;

  return {
    analysis,
    consensus: computeConsensus(analysis),
    consultedPages,
    usage,
    createdAt: new Date().toISOString(),
    mode: req.mode,
  };
}
