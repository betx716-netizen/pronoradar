import { apiFootballRemaining, fetchInsight, hasApiFootball, type ApiFootballInsight } from "./apifootball";
import { computeConsensus } from "./consensus";
import { emptyUsage, researchWithGoogle, structure, todayInParis } from "./gemini";
import { AnalysisSchema, type AnalysisResult, type AnalyzeRequest, type Source } from "./schemas";

const researchSystem = (sourcesTarget: string) => `Tu es un analyste sportif rigoureux. Ton travail : recenser sur le web les pronostics publiés par d'autres pour un match précis, puis donner ta propre analyse.

Règles de recherche :
- Cherche des pronostiqueurs, des médias sportifs et des sites de prédictions chiffrées (Forebet, modèles xG…), en français et en anglais. Vise ${sourcesTarget} sources distinctes.
- Pour chaque source, relève : son nom, l'issue qu'elle pronostique, ses probabilités en % s'il y en a, ses autres pronostics (score, buts, sets…) et son argument.
- Recherche aussi le contexte : forme récente, blessés et suspendus, compositions probables, enjeu du match. Au tennis : surface, classement, forme, fatigue.
- Ne retiens que des pronostics qui concernent bien CE match à CETTE date.
- N'invente jamais un pronostic ou une source. Si une information manque, dis-le.
- Les cotes des bookmakers et les statistiques fournies dans la demande sont fiables : sers-t'en, inutile de les rechercher.

Rédige ensuite un dossier en français avec :
1. Les sources trouvées sur le web, une par ligne (nom, type : tipster / media / stats_model, issue pronostiquée, probabilités, autres pronostics, argument, date).
2. Le contexte (forme, absences, confrontations directes, faits marquants).
3. Ce qui ressort de l'ensemble des pronostics, cotes comprises : où ils convergent, où ils divergent.
4. TA propre analyse : probabilités en % pour chaque issue, issue la plus probable, score ou sets probables, niveau de confiance (faible / moyenne / élevée), facteurs clés, risques, et en quoi tu rejoins ou contredis le consensus. Sois honnête sur l'incertitude.`;

const STRUCTURE_SYSTEM = `Tu convertis un dossier d'analyse sportive en JSON. Recopie fidèlement les informations du dossier, sans rien inventer.
- "home" désigne l'équipe à domicile (ou le joueur 1), "away" l'équipe à l'extérieur (ou le joueur 2), "draw" le match nul.
- Au tennis, il n'y a pas de nul : mets prob_draw et odds_draw à null pour les sources, et ai_analysis.prob_draw à 0.
- Les probabilités sont en pourcentage (0 à 100).
- Dans "sources", mets uniquement les sources trouvées sur le web (pas les cotes ni API-Football, déjà comptées). Leurs cotes sont à null. Si l'URL d'une source n'est pas connue, mets une chaîne vide.
- Rédige tous les textes en français.`;

const MODE_SETTINGS = {
  rapide: { sourcesTarget: "4 à 6", injuries: false },
  complete: { sourcesTarget: "8 à 12", injuries: true },
} as const;

function emptySource(partial: Partial<Source> & Pick<Source, "name" | "type" | "pick">): Source {
  return {
    url: "",
    prob_home: null,
    prob_draw: null,
    prob_away: null,
    odds_home: null,
    odds_draw: null,
    odds_away: null,
    other_tips: [],
    reasoning: "",
    published: null,
    ...partial,
  };
}

// Sources « fiables » venues des API, ajoutées telles quelles à la liste des pronostics.
function apiSources(req: AnalyzeRequest, insight: ApiFootballInsight | null): Source[] {
  const sources: Source[] = [];
  const tennis = req.sport === "tennis";
  const o = req.odds;
  if (o) {
    sources.push(
      emptySource({
        name: `Moyenne de ${o.bookmakers} bookmakers`,
        type: "bookmaker",
        pick: "none",
        url: "https://the-odds-api.com",
        odds_home: o.home,
        odds_draw: tennis ? null : o.draw,
        odds_away: o.away,
        reasoning: "Cotes relevées par The Odds API au moment de la recherche des matchs.",
      }),
    );
    if (o.exchange) {
      sources.push(
        emptySource({
          name: o.exchange.name,
          type: "exchange",
          pick: "none",
          url: "https://the-odds-api.com",
          odds_home: o.exchange.home,
          odds_draw: tennis ? null : o.exchange.draw,
          odds_away: o.exchange.away,
          reasoning: "Bourse de paris : cotes fixées par les parieurs eux-mêmes, sans marge du bookmaker.",
        }),
      );
    }
  }
  if (insight) {
    const tips = [insight.advice, insight.underOver ? `Buts : ${insight.underOver}` : null].filter((t): t is string => Boolean(t));
    sources.push(
      emptySource({
        name: "API-Football (modèle statistique)",
        type: "stats_model",
        pick: "none",
        url: "https://www.api-football.com",
        prob_home: insight.percent.home,
        prob_draw: insight.percent.draw,
        prob_away: insight.percent.away,
        other_tips: tips,
        reasoning: insight.winner ? `Vainqueur prédit : ${insight.winner}.` : "Pas de vainqueur net prédit.",
      }),
    );
  }
  return sources;
}

// Les données des API, présentées à Gemini comme des faits établis.
function knownFacts(req: AnalyzeRequest, insight: ApiFootballInsight | null): string {
  const lines: string[] = [];
  const o = req.odds;
  if (o) {
    lines.push(
      `Cotes moyennes de ${o.bookmakers} bookmakers : ${req.home} ${o.home}${o.draw ? ` / nul ${o.draw}` : ""} / ${req.away} ${o.away}.`,
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

  if (req.odds) onProgress(`Cotes de ${req.odds.bookmakers} bookmakers récupérées.`);

  let insight: ApiFootballInsight | null = null;
  if (req.sport === "football" && req.apiFootballId && hasApiFootball()) {
    onProgress("Statistiques API-Football…");
    try {
      insight = await fetchInsight(req.apiFootballId, settings.injuries);
    } catch (e) {
      onProgress(e instanceof Error ? e.message : String(e));
    }
    usage.apiFootballRequestsRemaining = apiFootballRemaining();
  }

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

  onProgress("Recherche des pronostics sur Google (Gemini)…");
  const { text, consultedPages } = await researchWithGoogle({
    system: researchSystem(settings.sourcesTarget),
    prompt,
    usage,
    onProgress,
  });

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
  };
}
