import type { AnalysisMode, Sport } from "./schemas";

export type League = {
  name: string;
  oddsKey: string | null; // clé The Odds API (au tennis : préfixe du circuit)
  apiFootballId: number | null; // identifiant de la ligue dans API-Football
};

export const LEAGUES: Record<Sport, League[]> = {
  football: [
    { name: "Ligue des Champions", oddsKey: "soccer_uefa_champs_league", apiFootballId: 2 },
    { name: "Ligue Europa", oddsKey: "soccer_uefa_europa_league", apiFootballId: 3 },
    { name: "Ligue Conférence", oddsKey: "soccer_uefa_europa_conference_league", apiFootballId: 848 },
    { name: "Ligue 1", oddsKey: "soccer_france_ligue_one", apiFootballId: 61 },
    { name: "Premier League", oddsKey: "soccer_epl", apiFootballId: 39 },
    { name: "LaLiga", oddsKey: "soccer_spain_la_liga", apiFootballId: 140 },
    { name: "Serie A", oddsKey: "soccer_italy_serie_a", apiFootballId: 135 },
    { name: "Bundesliga", oddsKey: "soccer_germany_bundesliga", apiFootballId: 78 },
    { name: "Liga Portugal", oddsKey: "soccer_portugal_primeira_liga", apiFootballId: 94 },
    { name: "Eredivisie", oddsKey: "soccer_netherlands_eredivisie", apiFootballId: 88 },
    { name: "Ligue 2", oddsKey: "soccer_france_ligue_two", apiFootballId: 62 },
    { name: "Championship (Angleterre)", oddsKey: "soccer_efl_champ", apiFootballId: 40 },
  ],
  tennis: [
    { name: "ATP", oddsKey: "tennis_atp", apiFootballId: null },
    { name: "WTA", oddsKey: "tennis_wta", apiFootballId: null },
  ],
};

export const findLeague = (sport: Sport, name: string) => LEAGUES[sport].find((l) => l.name === name);

export const MAX_LEAGUES = 5;

// Ce que consomme chaque match analysé sur les quotas gratuits.
export const MODES: Record<AnalysisMode, { label: string; description: string; apiFootballPerMatch: number; geminiPerMatch: number }> = {
  rapide: {
    label: "Rapide",
    description: "cotes, pronostic API-Football, forme et avis trouvés sur Google",
    apiFootballPerMatch: 1,
    geminiPerMatch: 2,
  },
  complete: {
    label: "Complète",
    description: "en plus : blessés et suspendus, recherche Google plus large",
    apiFootballPerMatch: 2,
    geminiPerMatch: 2,
  },
};
