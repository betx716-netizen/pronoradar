// Analyse sans IA : quand la clé Gemini manque, on tire la synthèse des seuls chiffres
// (cotes des bookmakers et modèle API-Football), avec des phrases préparées.
import type { ApiFootballInsight } from "./apifootball";
import { apiSources } from "./apiSources";
import { computeConsensus, type Distribution } from "./consensus";
import type { Analysis, AnalyzeRequest, Outcome } from "./schemas";

// Poids des cotes face au modèle API-Football dans les probabilités finales.
const MARKET_WEIGHT = 0.6;

const FORM_LETTERS: Record<string, string> = { W: "V", D: "N", L: "D" };
const frenchForm = (form: string | null) =>
  form ? `${[...form.slice(-5)].map((c) => FORM_LETTERS[c] ?? c).join(" ")} (V = victoire, N = nul, D = défaite)` : "Non disponible";

function confidence(top: number, tennis: boolean): Analysis["ai_analysis"]["confidence"] {
  const [high, medium] = tennis ? [70, 58] : [60, 45];
  return top >= high ? "élevée" : top >= medium ? "moyenne" : "faible";
}

export function analysisWithoutAI(req: AnalyzeRequest, insight: ApiFootballInsight | null): Analysis {
  const tennis = req.sport === "tennis";
  const outcomes: Outcome[] = tennis ? ["home", "away"] : ["home", "draw", "away"];
  const label = (o: Outcome) => (o === "home" ? req.home : o === "away" ? req.away : "le match nul");

  const analysis: Analysis = {
    match: {
      sport: req.sport,
      competition: req.competition,
      home: req.home,
      away: req.away,
      date: req.date || null,
      venue_or_surface: null,
    },
    sources: apiSources(req, insight),
    markets: [],
    secondary_trends: insight?.underOver
      ? [{ market: `Nombre de buts (${insight.underOver})`, verdict: "Tendance du modèle API-Football", sources_count: 1 }]
      : [],
    context: {
      form_home: frenchForm(insight?.formHome ?? null),
      form_away: frenchForm(insight?.formAway ?? null),
      absences: insight?.injuries ?? [],
      head_to_head: insight?.h2h.length ? insight.h2h.join(" · ") : "Non disponible",
      key_facts: insight?.advice ? [`Conseil API-Football : ${insight.advice}`] : [],
    },
    ai_analysis: {
      prob_home: 0,
      prob_draw: 0,
      prob_away: 0,
      predicted_outcome: "home",
      score_prediction: "Non estimé sans IA",
      confidence: "faible",
      key_factors: [],
      risks: [],
      consensus_comment: "",
      summary: "",
    },
  };

  // Probabilités : mélange des cotes (marge retirée) et du modèle, ou l'un des deux s'il manque.
  const { market, models } = computeConsensus(analysis);
  const blend: Distribution = { home: 0, draw: 0, away: 0 };
  for (const o of outcomes) {
    blend[o] = market && models ? MARKET_WEIGHT * market[o] + (1 - MARKET_WEIGHT) * models[o] : (market ?? models)![o];
  }
  const pick = outcomes.reduce((best, o) => (blend[o] > blend[best] ? o : best), outcomes[0]);
  const marketPick = market && outcomes.reduce((best, o) => (market[o] > market[best] ? o : best), outcomes[0]);
  const modelPick = models && outcomes.reduce((best, o) => (models[o] > models[best] ? o : best), outcomes[0]);

  const comments: string[] = [];
  if (market && marketPick) comments.push(`Les bookmakers voient ${label(marketPick)} favori (${market[marketPick].toFixed(0)} %).`);
  if (models && modelPick) {
    comments.push(
      marketPick && modelPick !== marketPick
        ? `Le modèle API-Football n'est pas d'accord : il penche pour ${label(modelPick)} (${models[modelPick].toFixed(0)} %).`
        : `Le modèle API-Football va dans le même sens (${models[modelPick].toFixed(0)} %).`,
    );
  }

  const factors: string[] = [];
  if (market) factors.push(`Cotes : ${outcomes.map((o) => `${label(o)} ${market[o].toFixed(0)} %`).join(", ")}`);
  if (insight?.formHome) factors.push(`Forme de ${req.home} : ${frenchForm(insight.formHome)}`);
  if (insight?.formAway) factors.push(`Forme de ${req.away} : ${frenchForm(insight.formAway)}`);
  if (insight?.advice) factors.push(`Conseil API-Football : ${insight.advice}`);

  const risks = ["Calcul fait uniquement à partir des chiffres : les actualités (blessures de dernière minute, enjeu, météo) ne sont pas lues."];
  if (insight?.injuries.length) risks.push(`${insight.injuries.length} joueur(s) blessé(s) ou suspendu(s) signalé(s).`);
  if (market && models && marketPick !== modelPick) risks.push("Les cotes et le modèle statistique ne désignent pas le même favori.");

  analysis.ai_analysis = {
    prob_home: Math.round(blend.home),
    prob_draw: Math.round(blend.draw),
    prob_away: Math.round(blend.away),
    predicted_outcome: pick,
    score_prediction: "Non estimé sans IA",
    confidence: confidence(blend[pick], tennis),
    key_factors: factors,
    risks,
    consensus_comment: comments.join(" "),
    summary: `D'après ${[market && "les cotes des bookmakers", models && "le modèle API-Football"].filter(Boolean).join(" et ")}, ${label(pick)} est l'issue la plus probable (${blend[pick].toFixed(0)} %). Ajoutez la clé Gemini pour obtenir aussi l'avis des pronostiqueurs trouvé sur Internet et une analyse rédigée.`,
  };
  return analysis;
}
