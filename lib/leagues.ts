import type { AnalysisMode, Sport } from "./schemas";

export const LEAGUES: Record<Sport, string[]> = {
  football: [
    "Ligue des Champions",
    "Ligue Europa",
    "Ligue Conférence",
    "Ligue 1",
    "Premier League",
    "LaLiga",
    "Serie A",
    "Bundesliga",
    "Liga Portugal",
    "Eredivisie",
    "Ligue 2",
    "Championship (Angleterre)",
  ],
  tennis: ["ATP", "WTA", "ATP Challenger"],
};

export const MAX_LEAGUES = 5;

// Fourchettes de coût par match, en dollars : estimations à affiner avec les coûts réels affichés.
export const MODES: Record<AnalysisMode, { label: string; description: string; costMin: number; costMax: number }> = {
  rapide: {
    label: "Rapide",
    description: "≈ 6 recherches par match, 5 à 8 sources",
    costMin: 0.1,
    costMax: 0.35,
  },
  complete: {
    label: "Complète",
    description: "jusqu'à 15 recherches par match, 8 à 15 sources",
    costMin: 0.3,
    costMax: 1,
  },
};

export function estimateCost(mode: AnalysisMode, matches: number) {
  const { costMin, costMax } = MODES[mode];
  return { min: costMin * matches, max: costMax * matches };
}
