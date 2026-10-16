// Rassemble tous les paris proposés pour un match : résultat et double chance (probabilités + cotes),
// nombre de buts (cotes « plus/moins » quand elles existent), puis les estimations de l'IA
// pour les marchés sans cotes gratuites (corners, fautes, cartons…).
import type { Analysis, MarketPick, OddsSummary, Outcome } from "./schemas";

const BOOKMAKER_MARGIN = 0.95; // une cote « juste » est un peu au-dessus de ce que proposent les bookmakers

const fairOdds = (probability: number) => Math.max(1.01, Math.round((100 / Math.max(probability, 1)) * BOOKMAKER_MARGIN * 100) / 100);
const round = (n: number) => Math.round(n * 10) / 10;

// Probabilités finales du résultat : celles de l'IA (déjà nourries des cotes) ou du calcul automatique.
function outcomeProbabilities(analysis: Analysis, tennis: boolean): Record<Outcome, number> {
  const ai = analysis.ai_analysis;
  const total = ai.prob_home + (tennis ? 0 : ai.prob_draw) + ai.prob_away || 1;
  return {
    home: (ai.prob_home / total) * 100,
    draw: tennis ? 0 : (ai.prob_draw / total) * 100,
    away: (ai.prob_away / total) * 100,
  };
}

export function buildPicks(analysis: Analysis, odds: OddsSummary | null | undefined, engine: "ia" | "calcul"): MarketPick[] {
  const tennis = analysis.match.sport === "tennis";
  const { home, away } = analysis.match;
  const p = outcomeProbabilities(analysis, tennis);
  const picks: MarketPick[] = [];
  const basis = (hasOdds: boolean): MarketPick["basis"] =>
    engine === "calcul" ? "calcul" : hasOdds ? "cotes + IA" : "estimation IA";

  // Résultat sec.
  const outcomes: [Outcome, string, number | null | undefined][] = tennis
    ? [
        ["home", `Victoire ${home}`, odds?.home],
        ["away", `Victoire ${away}`, odds?.away],
      ]
    : [
        ["home", `Victoire ${home}`, odds?.home],
        ["draw", "Match nul", odds?.draw],
        ["away", `Victoire ${away}`, odds?.away],
      ];
  for (const [o, label, bookOdds] of outcomes) {
    picks.push({
      category: "resultat",
      selection: label,
      probability: round(p[o]),
      odds: bookOdds ?? fairOdds(p[o]),
      oddsSource: bookOdds ? "bookmaker" : "estimée",
      basis: basis(Boolean(bookOdds)),
      reasoning: o === analysis.ai_analysis.predicted_outcome ? analysis.ai_analysis.consensus_comment : "",
    });
  }

  // Double chance (football) : la cote se déduit des deux cotes simples.
  if (!tennis) {
    const combo = (a: number | null | undefined, b: number | null | undefined) => (a && b ? Math.round((1 / (1 / a + 1 / b)) * 100) / 100 : null);
    const doubles: [string, number, number | null][] = [
      [`${home} ou nul`, p.home + p.draw, combo(odds?.home, odds?.draw)],
      [`${away} ou nul`, p.away + p.draw, combo(odds?.away, odds?.draw)],
      [`${home} ou ${away}`, p.home + p.away, combo(odds?.home, odds?.away)],
    ];
    for (const [label, prob, bookOdds] of doubles) {
      picks.push({
        category: "double_chance",
        selection: label,
        probability: round(prob),
        odds: bookOdds ?? fairOdds(prob),
        oddsSource: bookOdds ? "bookmaker" : "estimée",
        basis: basis(Boolean(bookOdds)),
        reasoning: "",
      });
    }
  }

  // Ligne de buts (ou de jeux) proposée par les bookmakers : probabilité tirée des cotes, marge retirée.
  const t = odds?.totals;
  if (t) {
    const over = (1 / t.over / (1 / t.over + 1 / t.under)) * 100;
    const unit = tennis ? "jeux" : "buts";
    picks.push(
      {
        category: tennis ? "jeux" : "buts",
        selection: `Plus de ${String(t.point).replace(".", ",")} ${unit}`,
        probability: round(over),
        odds: t.over,
        oddsSource: "bookmaker",
        basis: "cotes",
        reasoning: "Probabilité tirée des cotes des bookmakers.",
      },
      {
        category: tennis ? "jeux" : "buts",
        selection: `Moins de ${String(t.point).replace(".", ",")} ${unit}`,
        probability: round(100 - over),
        odds: t.under,
        oddsSource: "bookmaker",
        basis: "cotes",
        reasoning: "Probabilité tirée des cotes des bookmakers.",
      },
    );
  }

  // Estimations de l'IA (corners, fautes, cartons, autres lignes de buts…), sans doublon avec les cotes.
  for (const m of analysis.markets ?? []) {
    if (m.category === "resultat" || m.category === "double_chance") continue;
    if (picks.some((x) => x.selection.toLowerCase() === m.selection.toLowerCase())) continue;
    const prob = Math.min(99, Math.max(1, m.probability));
    picks.push({
      category: m.category,
      selection: m.selection,
      probability: round(prob),
      odds: fairOdds(prob),
      oddsSource: "estimée",
      basis: "estimation IA",
      reasoning: [m.expected_value !== null ? `Moyenne attendue : ${m.expected_value}.` : "", m.reasoning].filter(Boolean).join(" "),
    });
  }

  return picks;
}
