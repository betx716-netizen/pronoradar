import { apiFootballRemaining, fetchInsight, hasApiFootball, type ApiFootballInsight } from "./apifootball";
import { computeConsensus } from "./consensus";
import { apiSources } from "./apiSources";
import { analysisWithoutAI } from "./calculated";
import { buildPicks } from "./markets";
import {
  AnalysisError,
  emptyUsage,
  aiAvailable,
  hasAI,
  webSearchAvailable,
  researchWithGoogle,
  structure,
  todayInParis,
  writeWithoutSearch,
} from "./gemini";
import { AnalysisSchema, type AnalysisResult, type AnalyzeRequest } from "./schemas";

// Façon de raisonner imposée à Gemini : partir du marché, ne s'en écarter qu'avec une raison précise, chercher les pièges.
const PHILOSOPHY = `Méthode de raisonnement (obligatoire) :
- Pars des cotes des bookmakers : c'est l'avis de milliers de parieurs et le meilleur point de départ. Convertis-les en probabilités.
- Ne t'en écarte que pour une raison précise et vérifiable (blessé ou suspendu important confirmé, rotation annoncée, match sans enjeu, fatigue, météo) et de 8 points au plus. Justifie chaque écart.
- Un favori n'est pas une certitude : un favori à 1,40 perd environ une fois sur quatre. Ne surestime pas les favoris ; repère au contraire les outsiders et les nuls sous-cotés quand les faits le justifient.
- Cherche les signaux d'alerte et liste-les dans les risques : match sans enjeu ou retour déjà joué, derby, entraîneur menacé, calendrier chargé (coupe d'Europe juste avant ou après), changement d'entraîneur récent, terrain ou météo difficile, équipe qui fait tourner.
- Pour chaque marché secondaire, indique sa fiabilité : "fiable" (données solides et cohérentes), "moyenne", ou "fragile" (peu de données, forte variance comme les corners, cartons ou scores exacts).
- Sois honnête : si le match est imprévisible, dis-le et mets une confiance faible.`;

const researchSystem = (sourcesTarget: string) => `Tu es un analyste sportif rigoureux. Ton travail : recenser sur le web les pronostics publiés par d'autres pour un match précis, puis donner ta propre analyse.

Règles de recherche :
- Cherche des pronostiqueurs, des médias sportifs et des sites de prédictions chiffrées (Forebet, modèles xG…), en français et en anglais. Vise ${sourcesTarget} sources distinctes.
- Pour chaque source, relève : son nom, l'issue qu'elle pronostique, ses probabilités en % s'il y en a, ses autres pronostics (score, buts, sets…) et son argument.
- Recherche aussi le contexte : forme récente, blessés et suspendus, compositions : cherche d'abord la composition OFFICIELLE (onze de départ annoncé par les clubs, environ une heure avant le match) ; si elle n'est pas encore publiée, reprends la composition probable publiée par un média fiable (L'Équipe, Foot Mercato, Sofascore, RotoWire, presse locale…) en notant sa source. N'invente JAMAIS une composition toi-même : si tu n'en trouves aucune publiée, dis-le. Cherche aussi l'enjeu du match. Au tennis : surface, classement, forme, fatigue.
- Ne retiens que des pronostics qui concernent bien CE match à CETTE date.
- N'invente jamais un pronostic ou une source. Si une information manque, dis-le.
- Les cotes des bookmakers et les statistiques fournies dans la demande sont fiables : sers-t'en, inutile de les rechercher.

${PHILOSOPHY}

Rédige ensuite un dossier en français avec :
1. Les sources trouvées sur le web, une par ligne (nom, type : tipster / media / stats_model, issue pronostiquée, probabilités, autres pronostics, argument, date).
2. Le contexte (forme, absences, confrontations directes, faits marquants) et, au football, la composition probable de chaque équipe : système (ex. 4-3-3), gardien, puis les joueurs de champ ligne par ligne, de la défense à l'attaque, avec le numéro de maillot de chaque joueur (« 10 Ousmane Dembélé »), et les couleurs habituelles du maillot de chaque équipe.
3. Ce qui ressort de l'ensemble des pronostics, cotes comprises : où ils convergent, où ils divergent.
4. TA propre analyse : probabilités en % pour chaque issue, issue la plus probable, score ou sets probables, niveau de confiance (faible / moyenne / élevée), facteurs clés, risques, et en quoi tu rejoins ou contredis le consensus. Sois honnête sur l'incertitude.
5. Les marchés secondaires, chacun avec une probabilité en % et la moyenne attendue : nombre de buts (plus/moins 1,5, 2,5 et 3,5), les deux équipes marquent, corners (ligne la plus pertinente entre 8,5 et 10,5), fautes (entre 20,5 et 24,5), cartons (3,5 ou 4,5). Ajoute aussi : résultat à la mi-temps, mi-temps/fin de match, handicap (-1 ou +1), les 2 ou 3 scores exacts les plus probables, le nombre de buts de chaque équipe, les combinés résultat + plus/moins 2,5 buts et résultat + les deux marquent, les tirs cadrés et les hors-jeu. Au tennis : nombre de sets et de jeux, vainqueur du 1er set, handicap jeux, score exact en sets et tie-break oui/non. Appuie-toi sur les moyennes de la saison des deux équipes (buts, corners, fautes, cartons), le style de jeu et l'arbitre si connu.`;

const STRUCTURE_SYSTEM = `Tu convertis un dossier d'analyse sportive en JSON. Recopie fidèlement les informations du dossier, sans rien inventer.
- "home" désigne l'équipe à domicile (ou le joueur 1), "away" l'équipe à l'extérieur (ou le joueur 2), "draw" le match nul.
- Au tennis, il n'y a pas de nul : mets prob_draw et odds_draw à null pour les sources, et ai_analysis.prob_draw à 0.
- Les probabilités sont en pourcentage (0 à 100).
- Dans "sources", mets uniquement les sources trouvées sur le web (pas les cotes ni API-Football, déjà comptées). Leurs cotes sont à null. Si l'URL d'une source n'est pas connue, mets une chaîne vide.
- Dans "markets", recopie les marchés secondaires du dossier (buts, les deux marquent, corners, fautes, cartons, mi-temps, mi-temps/fin, handicap, score exact, buts par équipe, combinés résultat + buts ou + les deux marquent, tirs cadrés, hors-jeu, sets, jeux, 1er set, handicap jeux, score en sets, tie-break), un pari par ligne avec la catégorie correspondante et sa fiabilité (fiable, moyenne ou fragile) avec sa probabilité.
- Dans "lineups", recopie les compositions du dossier avec leur statut (officielle ou probable) et leur source. Mets null si le dossier n'en cite aucune publiée par une source, ou au tennis : n'en reconstitue jamais une toi-même. Le nombre de joueurs par ligne doit correspondre au système (4-3-3 : 4, 3, 3). Chaque joueur au format « numéro nom ». Dans "kit", les couleurs du maillot en hexadécimal (null si inconnues).
- Rédige tous les textes en français.`;

// Utilisé quand la recherche Google n'est plus disponible : Gemini analyse sans pouvoir citer de pronostiqueurs.
const NO_SEARCH_SYSTEM: string = `Tu es un analyste sportif rigoureux. Tu n'as PAS accès au web pour cette analyse.
Appuie-toi sur les données fournies (cotes, statistiques) et sur tes connaissances générales des équipes ou des joueurs.
N'invente aucune source, aucun pronostiqueur, aucune blessure récente : la liste des sources doit rester vide.
Rédige en français : contexte connu, ce que disent les cotes, puis TA propre analyse (probabilités en % pour chaque issue,
issue la plus probable, score ou sets probables, confiance faible / moyenne / élevée, facteurs clés, risques).
Précise que l'actualité récente (blessures, compositions) n'a pas pu être vérifiée. Ne donne AUCUNE composition d'équipe : sans accès au web, elle serait inventée.
${PHILOSOPHY}
Donne aussi les marchés secondaires, chacun avec une probabilité en % et la moyenne attendue : nombre de buts (plus/moins 1,5, 2,5 et 3,5), les deux équipes marquent, corners (ligne la plus pertinente entre 8,5 et 10,5), fautes (entre 20,5 et 24,5), cartons (3,5 ou 4,5). Ajoute aussi : résultat à la mi-temps, mi-temps/fin de match, handicap (-1 ou +1), les 2 ou 3 scores exacts les plus probables, le nombre de buts de chaque équipe, les combinés résultat + plus/moins 2,5 buts et résultat + les deux marquent, les tirs cadrés et les hors-jeu. Au tennis : nombre de sets et de jeux, vainqueur du 1er set, handicap jeux, score exact en sets et tie-break oui/non. Appuie-toi sur les moyennes de la saison des deux équipes (buts, corners, fautes, cartons), le style de jeu et l'arbitre si connu.`;

const MODE_SETTINGS = {
  rapide: { sourcesTarget: "4 à 6", injuries: false },
  complete: { sourcesTarget: "8 à 12", injuries: true },
} as const;

// Les données des API, présentées à Gemini comme des faits établis.
function knownFacts(req: AnalyzeRequest, insight: ApiFootballInsight | null): string {
  const lines: string[] = [];
  const o = req.odds;
  if (o) {
    lines.push(
      `Cotes moyennes (${o.bookmakers} bookmaker${o.bookmakers > 1 ? "s" : ""}) : ${req.home} ${o.home}${o.draw ? ` / nul ${o.draw}` : ""} / ${req.away} ${o.away}.`,
    );
  }
  if (insight) {
    lines.push(
      `Modèle API-Football : ${req.home} ${insight.percent.home} %, nul ${insight.percent.draw} %, ${req.away} ${insight.percent.away} %. Conseil : ${insight.advice ?? "aucun"}.`,
    );
    if (insight.formHome) lines.push(`Forme de ${req.home} en championnat : ${insight.formHome} (W = victoire, D = nul, L = défaite).`);
    if (insight.formAway) lines.push(`Forme de ${req.away} en championnat : ${insight.formAway}.`);
    if (insight.h2h.length) lines.push(`Dernières confrontations : ${insight.h2h.join(" ; ")}.`);
    if (insight.injuries.length) lines.push(`Blessés et suspendus : ${insight.injuries.join(" ; ")}.`);
  }
  return lines.length ? `Données déjà connues (fiables) :\n- ${lines.join("\n- ")}` : "";
}

export async function analyzeMatch(req: AnalyzeRequest, onProgress: (message: string) => void): Promise<AnalysisResult> {
  const usage = emptyUsage();
  const settings = MODE_SETTINGS[req.mode];

  if (req.odds) onProgress(`Cotes récupérées (${req.odds.bookmakers} bookmaker${req.odds.bookmakers > 1 ? "s" : ""}).`);

  let insight: ApiFootballInsight | null = null;
  if (req.sport === "football" && req.apiFootballId && hasApiFootball()) {
    onProgress("Récupération des statistiques…");
    try {
      insight = await fetchInsight(req.apiFootballId, settings.injuries);
    } catch (e) {
      onProgress(e instanceof Error ? e.message : String(e));
    }
    usage.apiFootballRequestsRemaining = apiFootballRemaining();
  }

  const hasData = Boolean(req.odds || insight);
  const calculated = (notice?: string): AnalysisResult => {
    onProgress("Calcul de l'analyse à partir des cotes et des statistiques…");
    const analysis = analysisWithoutAI(req, insight);
    return {
      analysis,
      consensus: computeConsensus(analysis, "le calcul automatique", false),
      consultedPages: [],
      usage,
      createdAt: new Date().toISOString(),
      mode: req.mode,
      engine: "calcul",
      picks: buildPicks(analysis, req.odds, "calcul"),
      notice,
    };
  };

  // Sans Gemini (pas de clé, ou quota épuisé il y a peu) : analyse calculée à partir des seules données chiffrées.
  if (!aiAvailable()) {
    if (hasData) return calculated(hasAI() ? "Quota Gemini atteint récemment : analyse calculée sans IA." : undefined);
    throw new AnalysisError(
      hasAI()
        ? "Gemini : quota gratuit atteint. Réessayez plus tard, ou choisissez un match trouvé à l'étape 1 (analyse calculée)."
        : "Sans clé Gemini, l'analyse repose sur les cotes et API-Football : choisissez un match trouvé à l'étape 1.",
      hasAI() ? "quota" : undefined,
    );
  }

  try {
    return await analyzeWithGemini(req, insight, usage, onProgress, settings.sourcesTarget);
  } catch (e) {
    // Quota ou clé Gemini en défaut : on continue avec les autres sources plutôt que d'échouer.
    if (e instanceof AnalysisError && e.geminiUnavailable && hasData) {
      onProgress(`${e.message} Passage en analyse calculée.`);
      return calculated(`${e.message} L'analyse a été calculée à partir des cotes et des statistiques.`);
    }
    throw e;
  }
}

async function analyzeWithGemini(
  req: AnalyzeRequest,
  insight: ApiFootballInsight | null,
  usage: AnalysisResult["usage"],
  onProgress: (message: string) => void,
  sourcesTarget: string,
): Promise<AnalysisResult> {

  const match =
    req.sport === "football" ? `${req.home} (domicile) contre ${req.away} (extérieur)` : `${req.home} contre ${req.away}`;
  const prompt = [
    `Nous sommes le ${todayInParis()}.`,
    `Match de ${req.sport} : ${match}.`,
    req.competition ? `Compétition : ${req.competition}.` : "",
    req.date ? `Date : ${req.date}.` : "Si la date n'est pas précisée, prends la prochaine rencontre entre eux.",
    knownFacts(req, insight),
    "Recense les pronostics publiés sur ce match, puis donne ton analyse.",
  ]
    .filter(Boolean)
    .join("\n");

  let notice: string | undefined;
  const withoutSearch = async (reason: string) => {
    notice = `${reason} Analyse rédigée par Gemini à partir des cotes et de ses connaissances, sans recherche web : l'actualité récente n'a pas été vérifiée.`;
    onProgress(`${reason} Analyse par Gemini à partir des cotes et de ses connaissances, sans recherche web.`);
    return writeWithoutSearch({ system: NO_SEARCH_SYSTEM, prompt, usage, onProgress });
  };
  let research: { text: string; consultedPages: AnalysisResult["consultedPages"] };
  if (!webSearchAvailable()) {
    research = await withoutSearch("Quota de recherche Google atteint récemment.");
  } else {
    try {
      onProgress("Recherche des pronostics sur Google (Gemini)…");
      research = await researchWithGoogle({
        system: researchSystem(sourcesTarget),
        prompt,
        usage,
        onProgress,
        queries: [`${req.home} ${req.away} pronostic`, `${req.home} vs ${req.away} prediction`, `${req.home} ${req.away} compositions officielles probables`],
      });
    } catch (e) {
      if (!(e instanceof AnalysisError && e.searchOnly)) throw e;
      research = await withoutSearch(e.message);
    }
  }
  const { text, consultedPages } = research;

  onProgress("Synthèse des pronostics recensés…");
  const analysis = await structure(AnalysisSchema, STRUCTURE_SYSTEM, `${prompt}\n\n${text}`, usage, onProgress);
  analysis.match.sport = req.sport;
  analysis.match.home = req.home;
  analysis.match.away = req.away;
  analysis.sources = [
    ...apiSources(req, insight),
    ...analysis.sources.filter((s) => s.type !== "bookmaker" && s.type !== "exchange"),
  ];

  return {
    analysis,
    consensus: computeConsensus(analysis),
    consultedPages,
    usage,
    createdAt: new Date().toISOString(),
    mode: req.mode,
    engine: "ia",
    picks: buildPicks(analysis, req.odds, "ia"),
    notice,
  };
}
