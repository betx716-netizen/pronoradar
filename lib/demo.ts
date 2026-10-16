// Données fictives utilisées quand DEMO_MODE=1 : permettent de tester l'interface
// sans clé API et sans frais. Les sources et les chiffres sont inventés.
import { computeConsensus } from "./consensus";
import { buildPicks } from "./markets";
import type { Analysis, AnalysisResult, AnalyzeRequest, Fixture, Source } from "./schemas";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function src(partial: Partial<Source> & Pick<Source, "name" | "type" | "pick">): Source {
  return {
    url: `https://example.com/demo/${encodeURIComponent(partial.name.toLowerCase())}`,
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

export async function demoAnalysis(req: AnalyzeRequest, onProgress: (m: string) => void): Promise<AnalysisResult> {
  const steps = [
    "Lancement des recherches sur le web…",
    `Recherche : « pronostic ${req.home} ${req.away} »`,
    "9 résultats trouvés",
    `Recherche : « cotes ${req.home} ${req.away} »`,
    "8 résultats trouvés",
    `Recherche : « ${req.home} blessés absents »`,
    "10 résultats trouvés",
    "Synthèse des pronostics recensés…",
  ];
  for (const s of steps) {
    onProgress(s);
    await wait(300 + Math.random() * 500);
  }

  const tennis = req.sport === "tennis";
  const swap = [...(req.home + req.away)].reduce((h, c) => h + c.charCodeAt(0), 0) % 2 === 1;
  const draw = (v: number) => (tennis ? null : v);
  const analysis: Analysis = {
    match: {
      sport: req.sport,
      competition: req.competition || (tennis ? "Tournoi ATP (démo)" : "Ligue des Champions (démo)"),
      home: req.home,
      away: req.away,
      date: req.date || null,
      venue_or_surface: tennis ? "Dur intérieur" : "Stade de l'équipe à domicile",
    },
    sources: [
      src({ name: "Bookmaker A", type: "bookmaker", pick: "home", odds_home: 1.95, odds_draw: draw(3.8), odds_away: tennis ? 1.9 : 3.6, reasoning: "Cotes relevées la veille du match." }),
      src({ name: "Bookmaker B", type: "bookmaker", pick: "home", odds_home: 2.0, odds_draw: draw(3.7), odds_away: tennis ? 1.85 : 3.5, reasoning: "Cotes relevées le jour du match." }),
      src({ name: "Bourse de paris C", type: "exchange", pick: "home", odds_home: 2.04, odds_draw: draw(3.95), odds_away: tennis ? 1.96 : 3.75, reasoning: "Cotes de la bourse, sans marge." }),
      src({ name: "Modèle statistique D", type: "stats_model", pick: "home", prob_home: tennis ? 55 : 48, prob_draw: draw(27), prob_away: tennis ? 45 : 25, other_tips: [tennis ? "Victoire en 3 sets" : "Score : 2-1"], reasoning: "Modèle basé sur les buts attendus des 10 derniers matchs." }),
      src({ name: "Modèle statistique E", type: "stats_model", pick: tennis ? "away" : "home", prob_home: tennis ? 47 : 44, prob_draw: draw(28), prob_away: tennis ? 53 : 28, reasoning: "Modèle Elo." }),
      src({ name: "Pronostiqueur F", type: "tipster", pick: "home", other_tips: [tennis ? "Plus de 22,5 jeux" : "Plus de 2,5 buts"], reasoning: "Avantage du terrain et meilleure forme récente." }),
      src({ name: "Pronostiqueur G", type: "tipster", pick: tennis ? "away" : "draw", other_tips: [tennis ? "Plus de 22,5 jeux" : "Les deux équipes marquent"], reasoning: "Match fermé attendu entre deux équipes prudentes." }),
      src({ name: "Média H", type: "media", pick: "home", other_tips: [tennis ? "Victoire en 3 sets" : "Plus de 2,5 buts"], reasoning: "Le favori reste sur cinq victoires consécutives." }),
      src({ name: "Média I", type: "media", pick: "away", reasoning: "Pari sur l'outsider, en grande forme à l'extérieur." }),
    ],
    markets: tennis
      ? [{ category: "jeux", selection: "Plus de 22,5 jeux", probability: 61, expected_value: 23.4, reasoning: "Deux serveurs solides (démo)." }]
      : [
          { category: "buts", selection: "Plus de 1,5 buts", probability: 78, expected_value: 2.9, reasoning: "Deux attaques efficaces (démo)." },
          { category: "les_deux_marquent", selection: "Les deux équipes marquent : oui", probability: 62, expected_value: null, reasoning: "Défenses perméables (démo)." },
          { category: "corners", selection: "Plus de 9,5 corners", probability: 57, expected_value: 10.4, reasoning: "Jeu sur les ailes (démo)." },
          { category: "fautes", selection: "Moins de 24,5 fautes", probability: 64, expected_value: 22.1, reasoning: "Arbitre qui laisse jouer (démo)." },
          { category: "cartons", selection: "Plus de 3,5 cartons", probability: 55, expected_value: 4.1, reasoning: "Rivalité tendue (démo)." },
        ],
    secondary_trends: tennis
      ? [{ market: "Plus de 22,5 jeux", verdict: "Oui pour 2 sources sur 2", sources_count: 2 }]
      : [
          { market: "Plus de 2,5 buts", verdict: "Oui pour 2 sources sur 2", sources_count: 2 },
          { market: "Les deux équipes marquent", verdict: "Oui pour 1 source", sources_count: 1 },
        ],
    context: {
      form_home: "4 victoires, 1 nul sur les 5 derniers matchs (démo).",
      form_away: "3 victoires, 2 défaites sur les 5 derniers matchs (démo).",
      absences: ["Défenseur central (blessure, démo)", "Milieu offensif incertain (démo)"],
      head_to_head: "2 victoires chacun lors des 5 dernières confrontations (démo).",
      key_facts: ["Données fictives générées pour la démonstration."],
    },
    ai_analysis: {
      prob_home: tennis ? 54 : 47,
      prob_draw: tennis ? 0 : 26,
      prob_away: tennis ? 46 : 27,
      predicted_outcome: "home",
      score_prediction: tennis ? "2 sets à 1" : "2-1",
      confidence: "moyenne",
      key_factors: ["Avantage du terrain", "Forme récente supérieure", "Absences côté adverse"],
      risks: ["Absence d'un défenseur clé", "Outsider dangereux en contre-attaque"],
      consensus_comment:
        "La majorité des sources, bookmakers en tête, voit l'équipe à domicile favorite. Je rejoins ce consensus, avec une confiance moyenne à cause des absences.",
      summary: "Démonstration : ceci est une analyse fictive pour tester l'affichage de l'application.",
    },
  };

  if (swap) {
    // Inverse les rôles pour que tous les matchs de démo n'aient pas le même favori.
    const flip = (o: "home" | "draw" | "away" | "none") => (o === "home" ? "away" : o === "away" ? "home" : o);
    for (const s of analysis.sources) {
      [s.odds_home, s.odds_away] = [s.odds_away, s.odds_home];
      [s.prob_home, s.prob_away] = [s.prob_away, s.prob_home];
      s.pick = flip(s.pick);
    }
    const ai = analysis.ai_analysis;
    [ai.prob_home, ai.prob_away] = [ai.prob_away, ai.prob_home];
    ai.predicted_outcome = flip(ai.predicted_outcome) as "home" | "draw" | "away";
  }

  return {
    analysis,
    consensus: computeConsensus(analysis),
    consultedPages: [{ title: "Page de démonstration", url: "https://example.com/demo" }],
    usage: { geminiRequests: 0, webSearches: 0, oddsRequestsRemaining: null, apiFootballRequestsRemaining: null },
    createdAt: new Date().toISOString(),
    mode: req.mode,
    engine: "ia",
    picks: buildPicks(analysis, demoOdds(tennis, swap), "ia"),
    demo: true,
  };
}

function demoOdds(tennis: boolean, swap: boolean) {
  const [h, a] = swap ? [3.6, 1.95] : [1.95, 3.6];
  return tennis
    ? { bookmakers: 3, home: swap ? 2.0 : 1.8, draw: null, away: swap ? 1.8 : 2.0, exchange: null, totals: { point: 22.5, over: 1.85, under: 1.95 } }
    : { bookmakers: 3, home: h, draw: 3.8, away: a, exchange: null, totals: { point: 2.5, over: 1.75, under: 2.1 } };
}

export async function demoFixtures(
  sport: "football" | "tennis",
  competition: string,
  onProgress: (m: string) => void,
): Promise<Fixture[]> {
  onProgress(`Recherche du programme : ${competition}…`);
  await wait(500 + Math.random() * 800);
  const d = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const who = sport === "tennis" ? "Joueur" : "Équipe";
  return [1, 2, 3].map((n) => ({
    home: `${who} ${competition.slice(0, 3)} ${2 * n - 1}`,
    away: `${who} ${competition.slice(0, 3)} ${2 * n}`,
    competition,
    date: d,
    time: ["18:45", "21:00", "16:30"][n - 1],
    stage: sport === "tennis" ? "Quart de finale" : "Journée démo",
    odds: demoOdds(sport === "tennis", n === 2),
  }));
}
