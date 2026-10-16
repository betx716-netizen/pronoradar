import type { Analysis, Outcome, Source, SourceType, Sport } from "./schemas";

// Poids d'une source dans le vote global : les marchés (argent réel) pèsent
// plus que les modèles, qui pèsent plus que les avis individuels.
export const SOURCE_WEIGHTS: Record<SourceType, number> = {
  bookmaker: 3,
  exchange: 3,
  stats_model: 2,
  tipster: 1,
  media: 1,
};

export type Distribution = Record<Outcome, number>; // en %, somme = 100

export type Consensus = {
  outcomes: Outcome[];
  market: Distribution | null; // moyenne des cotes, marge retirée
  models: Distribution | null; // moyenne des modèles statistiques
  votes: Distribution; // part pondérée des votes de toutes les sources
  rawVotes: Record<Outcome, number>; // nombre brut de sources par issue
  counts: Record<SourceType, number>;
  pick: Outcome | null;
  agreement: number; // part du vote majoritaire, en %
  level: "fort" | "modéré" | "partagé" | "insuffisant";
  divergences: string[];
};

function outcomesFor(sport: Sport): Outcome[] {
  return sport === "tennis" ? ["home", "away"] : ["home", "draw", "away"];
}

function normalize(values: Partial<Record<Outcome, number>>, outcomes: Outcome[]): Distribution | null {
  const total = outcomes.reduce((s, o) => s + (values[o] ?? 0), 0);
  if (!(total > 0)) return null;
  const d: Distribution = { home: 0, draw: 0, away: 0 };
  for (const o of outcomes) d[o] = ((values[o] ?? 0) / total) * 100;
  return d;
}

// Convertit des cotes décimales en probabilités en retirant la marge du bookmaker.
function fromOdds(s: Source, outcomes: Outcome[]): Distribution | null {
  const odds: Partial<Record<Outcome, number | null>> = {
    home: s.odds_home,
    draw: s.odds_draw,
    away: s.odds_away,
  };
  if (!outcomes.every((o) => (odds[o] ?? 0) > 1)) return null;
  const implied: Partial<Record<Outcome, number>> = {};
  for (const o of outcomes) implied[o] = 1 / (odds[o] as number);
  return normalize(implied, outcomes);
}

function fromProbs(s: Source, outcomes: Outcome[]): Distribution | null {
  const probs: Partial<Record<Outcome, number | null>> = {
    home: s.prob_home,
    draw: s.prob_draw,
    away: s.prob_away,
  };
  if (!outcomes.every((o) => probs[o] != null && (probs[o] as number) >= 0)) return null;
  return normalize(probs as Partial<Record<Outcome, number>>, outcomes);
}

export function sourceDistribution(s: Source, sport: Sport): Distribution | null {
  const outcomes = outcomesFor(sport);
  return fromOdds(s, outcomes) ?? fromProbs(s, outcomes);
}

function argmax(d: Distribution, outcomes: Outcome[]): Outcome {
  return outcomes.reduce((best, o) => (d[o] > d[best] ? o : best), outcomes[0]);
}

// L'issue défendue par une source : son pronostic explicite, sinon la plus probable selon ses chiffres.
export function sourcePick(s: Source, sport: Sport): Outcome | null {
  const outcomes = outcomesFor(sport);
  if (s.pick !== "none" && outcomes.includes(s.pick)) return s.pick;
  const d = sourceDistribution(s, sport);
  return d ? argmax(d, outcomes) : null;
}

function average(dists: Distribution[], outcomes: Outcome[]): Distribution | null {
  if (dists.length === 0) return null;
  const sum: Partial<Record<Outcome, number>> = {};
  for (const o of outcomes) sum[o] = dists.reduce((s, d) => s + d[o], 0);
  return normalize(sum, outcomes);
}

export function computeConsensus(analysis: Analysis): Consensus {
  const sport = analysis.match.sport;
  const outcomes = outcomesFor(sport);
  const sources = analysis.sources;

  const counts: Record<SourceType, number> = { bookmaker: 0, exchange: 0, stats_model: 0, tipster: 0, media: 0 };
  for (const s of sources) counts[s.type]++;

  const marketDists = sources
    .filter((s) => s.type === "bookmaker" || s.type === "exchange")
    .map((s) => sourceDistribution(s, sport))
    .filter((d): d is Distribution => d !== null);
  const modelDists = sources
    .filter((s) => s.type === "stats_model")
    .map((s) => sourceDistribution(s, sport))
    .filter((d): d is Distribution => d !== null);

  const weighted: Partial<Record<Outcome, number>> = {};
  const rawVotes: Record<Outcome, number> = { home: 0, draw: 0, away: 0 };
  for (const s of sources) {
    const p = sourcePick(s, sport);
    if (!p) continue;
    weighted[p] = (weighted[p] ?? 0) + SOURCE_WEIGHTS[s.type];
    rawVotes[p]++;
  }
  const votes = normalize(weighted, outcomes) ?? { home: 0, draw: 0, away: 0 };
  const totalVotes = outcomes.reduce((s, o) => s + rawVotes[o], 0);

  const pick = totalVotes > 0 ? argmax(votes, outcomes) : null;
  const agreement = pick ? votes[pick] : 0;
  const level: Consensus["level"] =
    totalVotes < 3 ? "insuffisant" : agreement >= 75 ? "fort" : agreement >= 55 ? "modéré" : "partagé";

  const market = average(marketDists, outcomes);
  const models = average(modelDists, outcomes);

  const label = (o: Outcome) =>
    o === "home" ? analysis.match.home : o === "away" ? analysis.match.away : "le match nul";
  const divergences: string[] = [];
  if (market && pick && argmax(market, outcomes) !== pick) {
    divergences.push(
      `Les bookmakers voient ${label(argmax(market, outcomes))} favori, alors que la majorité des sources penche pour ${label(pick)}.`,
    );
  }
  if (market && models && argmax(market, outcomes) !== argmax(models, outcomes)) {
    divergences.push(
      `Les modèles statistiques (${label(argmax(models, outcomes))}) ne sont pas d'accord avec les cotes (${label(argmax(market, outcomes))}).`,
    );
  }
  const ai = analysis.ai_analysis;
  if (pick && ai.predicted_outcome !== pick) {
    divergences.push(
      `L'analyse de l'IA (${label(ai.predicted_outcome)}) va à contre-courant du consensus (${label(pick)}).`,
    );
  }
  if (market) {
    const aiDist = normalize({ home: ai.prob_home, draw: ai.prob_draw, away: ai.prob_away }, outcomes);
    if (aiDist) {
      for (const o of outcomes) {
        const gap = aiDist[o] - market[o];
        if (Math.abs(gap) >= 10) {
          divergences.push(
            `L'IA estime ${label(o)} à ${aiDist[o].toFixed(0)} %, contre ${market[o].toFixed(0)} % pour les bookmakers (écart de ${gap > 0 ? "+" : ""}${gap.toFixed(0)} points).`,
          );
        }
      }
    }
  }

  return { outcomes, market, models, votes, rawVotes, counts, pick, agreement, level, divergences };
}
