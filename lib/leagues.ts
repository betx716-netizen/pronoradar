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
    { name: "Jupiler Pro League (Belgique)", oddsKey: "soccer_belgium_first_div", apiFootballId: 144 },
    { name: "Süper Lig (Turquie)", oddsKey: "soccer_turkey_super_league", apiFootballId: 203 },
    { name: "Premiership (Écosse)", oddsKey: "soccer_spl", apiFootballId: 179 },
    { name: "Super League (Suisse)", oddsKey: "soccer_switzerland_superleague", apiFootballId: 207 },
    { name: "Bundesliga (Autriche)", oddsKey: "soccer_austria_bundesliga", apiFootballId: 218 },
    { name: "Super League (Grèce)", oddsKey: "soccer_greece_super_league", apiFootballId: 197 },
    { name: "Superliga (Danemark)", oddsKey: "soccer_denmark_superliga", apiFootballId: 119 },
    { name: "Ekstraklasa (Pologne)", oddsKey: "soccer_poland_ekstraklasa", apiFootballId: 106 },
    { name: "Allsvenskan (Suède)", oddsKey: "soccer_sweden_allsvenskan", apiFootballId: 113 },
    { name: "Eliteserien (Norvège)", oddsKey: "soccer_norway_eliteserien", apiFootballId: 103 },
    { name: "Ligue 2", oddsKey: "soccer_france_ligue_two", apiFootballId: 62 },
    { name: "Championship (Angleterre)", oddsKey: "soccer_efl_champ", apiFootballId: 40 },
    { name: "LaLiga 2", oddsKey: "soccer_spain_segunda_division", apiFootballId: 141 },
    { name: "Serie B", oddsKey: "soccer_italy_serie_b", apiFootballId: 136 },
    { name: "2. Bundesliga", oddsKey: "soccer_germany_bundesliga2", apiFootballId: 79 },
    // Coupes nationales
    { name: "Coupe d'Allemagne", oddsKey: "soccer_germany_dfb_pokal", apiFootballId: 81 },
    { name: "Coupe de France", oddsKey: "soccer_france_coupe_de_france", apiFootballId: 66 },
    { name: "Coupe d'Italie", oddsKey: "soccer_italy_coppa_italia", apiFootballId: 137 },
    { name: "Coupe du Roi (Espagne)", oddsKey: "soccer_spain_copa_del_rey", apiFootballId: 143 },
    { name: "FA Cup (Angleterre)", oddsKey: "soccer_fa_cup", apiFootballId: 45 },
    { name: "Coupe de la Ligue anglaise", oddsKey: "soccer_england_efl_cup", apiFootballId: 48 },
    { name: "Coupe du Portugal", oddsKey: null, apiFootballId: 96 },
    { name: "Coupe des Pays-Bas", oddsKey: null, apiFootballId: 90 },
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
    description: "cotes, modèle statistique, forme et avis trouvés sur le web",
    apiFootballPerMatch: 1,
    geminiPerMatch: 2,
  },
  complete: {
    label: "Complète",
    description: "en plus : blessés et suspendus, recherche web plus large",
    apiFootballPerMatch: 2,
    geminiPerMatch: 2,
  },
};
