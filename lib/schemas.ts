import { z } from "zod";

export const SportSchema = z.enum(["football", "tennis"]);
export type Sport = z.infer<typeof SportSchema>;

// "home" = équipe à domicile / joueur 1, "away" = équipe à l'extérieur / joueur 2.
// "draw" n'existe qu'au football.
export const OutcomeSchema = z.enum(["home", "draw", "away"]);
export type Outcome = z.infer<typeof OutcomeSchema>;

export const SourceTypeSchema = z.enum([
  "bookmaker",
  "exchange",
  "stats_model",
  "tipster",
  "media",
]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const SourceSchema = z.object({
  name: z.string().describe("Nom du site ou de l'auteur (ex : Forebet, L'Équipe, Betclic)"),
  url: z.string().describe("URL de la page où le pronostic a été trouvé, ou chaîne vide si inconnue"),
  type: SourceTypeSchema,
  pick: z
    .enum(["home", "draw", "away", "none"])
    .describe("Issue principale pronostiquée par la source ; 'none' si elle ne tranche pas"),
  prob_home: z.number().nullable().describe("Probabilité en % donnée par la source, sinon null"),
  prob_draw: z.number().nullable(),
  prob_away: z.number().nullable(),
  odds_home: z.number().nullable().describe("Cote décimale, uniquement pour bookmaker/exchange"),
  odds_draw: z.number().nullable(),
  odds_away: z.number().nullable(),
  other_tips: z
    .array(z.string())
    .describe("Autres pronostics de la source (score exact, buts, sets, jeux…)"),
  reasoning: z.string().describe("Résumé en une ou deux phrases de l'argument de la source"),
  published: z.string().nullable().describe("Date de publication si connue"),
});
export type Source = z.infer<typeof SourceSchema>;

export const MarketCategorySchema = z.enum([
  "resultat",
  "double_chance",
  "buts",
  "les_deux_marquent",
  "corners",
  "fautes",
  "cartons",
  "sets",
  "jeux",
  "rembourse",
  "mi_temps",
  "mi_temps_fin",
  "handicap",
  "score_exact",
  "buts_equipe",
  "resultat_buts",
  "resultat_btts",
  "tirs_cadres",
  "hors_jeu",
  "premier_set",
  "handicap_jeux",
  "score_sets",
  "tie_break",
  "buteur",
  "passeur",
  "buteur_ou_passeur",
]);
export type MarketCategory = z.infer<typeof MarketCategorySchema>;

// Estimation de l'IA pour un marché secondaire (buts, corners, fautes…).
export const MarketEstimateSchema = z.object({
  category: MarketCategorySchema,
  selection: z.string().describe("Pari précis, ex : 'Plus de 2,5 buts', 'Moins de 9,5 corners', 'Plus de 22,5 fautes'"),
  probability: z.number().describe("Probabilité estimée en % que ce pari soit gagnant"),
  expected_value: z.number().nullable().describe("Nombre moyen attendu (buts, corners, fautes, cartons…) si pertinent"),
  reasoning: z.string().describe("Justification courte : moyennes des équipes, style de jeu, arbitre…"),
  reliability: z
    .enum(["fiable", "moyenne", "fragile"])
    .describe("Solidité de l'estimation : fiable (données solides), moyenne, fragile (peu de données ou forte variance)"),
});
export type MarketEstimate = z.infer<typeof MarketEstimateSchema>;

// Composition probable d'une équipe : formation et joueurs ligne par ligne.
export const LineupSchema = z.object({
  formation: z.string().describe("Système de jeu, ex : '4-3-3', '4-4-2', '3-5-2'"),
  goalkeeper: z.string().describe("Gardien titulaire probable, au format « numéro nom », ex : '1 Gianluigi Donnarumma'"),
  lines: z
    .array(z.array(z.string()))
    .describe(
      "Joueurs de champ ligne par ligne, de la défense à l'attaque, de gauche à droite (ex. 4-3-3 : [[4 défenseurs], [3 milieux], [3 attaquants]]), chacun au format « numéro nom », ex : '10 Ousmane Dembélé'",
    ),
  kit: z
    .object({ shirt: z.string().describe("Couleur principale du maillot, en hexadécimal, ex : '#004170'"), detail: z.string().describe("Couleur secondaire (manches, bandes), en hexadécimal") })
    .nullable()
    .describe("Couleurs du maillot que l'équipe porte habituellement"),
  doubts: z.array(z.string()).describe("Joueurs incertains ou absents notables"),
  status: z.enum(["officielle", "probable"]).describe("officielle si le onze de départ a été annoncé par le club, sinon probable"),
  source: z.string().describe("Site où cette composition a été trouvée (ex : 'L'Équipe', 'site officiel du club'), jamais vide"),
});
export type Lineup = z.infer<typeof LineupSchema>;

export const AnalysisSchema = z.object({
  match: z.object({
    sport: SportSchema,
    competition: z.string(),
    home: z.string().describe("Équipe à domicile ou joueur 1"),
    away: z.string().describe("Équipe à l'extérieur ou joueur 2"),
    date: z.string().nullable(),
    venue_or_surface: z.string().nullable().describe("Stade (football) ou surface (tennis)"),
  }),
  sources: z.array(SourceSchema),
  secondary_trends: z
    .array(
      z.object({
        market: z.string().describe("Ex : 'Plus de 2,5 buts', 'Les deux équipes marquent', 'Match en 3 sets'"),
        verdict: z.string().describe("Ce qui ressort, ex : 'Oui pour 6 sources sur 8'"),
        sources_count: z.number(),
      }),
    )
    .describe("Tendances sur les marchés secondaires, quand plusieurs sources en parlent"),
  context: z.object({
    form_home: z.string(),
    form_away: z.string(),
    absences: z.array(z.string()).describe("Blessés, suspendus, incertains"),
    head_to_head: z.string(),
    key_facts: z.array(z.string()).describe("Statistiques et faits marquants"),
  }),
  ai_analysis: z.object({
    prob_home: z.number().describe("Probabilité en % estimée par l'IA"),
    prob_draw: z.number().describe("0 au tennis"),
    prob_away: z.number(),
    predicted_outcome: OutcomeSchema,
    score_prediction: z.string().describe("Score (football) ou sets (tennis) le plus probable"),
    confidence: z.enum(["faible", "moyenne", "élevée"]),
    key_factors: z.array(z.string()),
    risks: z.array(z.string()).describe("Ce qui pourrait faire mentir le pronostic"),
    consensus_comment: z
      .string()
      .describe("Ce qui ressort des pronostics recensés et où l'IA est d'accord ou non avec eux"),
    summary: z.string().describe("Synthèse finale en un paragraphe"),
  }),
  lineups: z
    .object({ home: LineupSchema, away: LineupSchema })
    .nullable()
    .describe("Compositions probables des deux équipes (football), null si introuvables ou au tennis"),
  markets: z
    .array(MarketEstimateSchema)
    .describe(
      "Football : nombre de buts (plus/moins 1,5, 2,5 et 3,5), les deux équipes marquent, corners (plus/moins 8,5 à 10,5), fautes (plus/moins 20,5 à 24,5), cartons (plus/moins 3,5 ou 4,5), résultat à la mi-temps (mi_temps), mi-temps/fin de match (mi_temps_fin), handicap européen ou asiatique (handicap), 2 ou 3 scores exacts les plus probables (score_exact), buts de chaque équipe (buts_equipe, ex : 'PSG plus de 1,5 buts'), résultat + plus/moins 2,5 buts (resultat_buts), résultat + les deux marquent (resultat_btts), tirs cadrés (tirs_cadres), hors-jeu (hors_jeu), les 3 buteurs les plus probables, une ligne par joueur (buteur, ex : 'Kylian Mbappé buteur'), avec sa probabilité de marquer au moins un but ; les 2 passeurs décisifs les plus probables (passeur, ex : 'Ousmane Dembélé passeur décisif') ; et les 2 joueurs les plus probables pour « buteur ou passeur décisif » (buteur_ou_passeur). Tennis : nombre de sets, nombre de jeux, vainqueur du 1er set (premier_set), handicap jeux (handicap_jeux), score exact en sets (score_sets), au moins un tie-break (tie_break). Une ligne par pari, en choisissant le côté le plus probable.",
    ),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

export const FixturesSchema = z.object({
  fixtures: z.array(
    z.object({
      home: z.string().describe("Équipe à domicile ou joueur 1"),
      away: z.string().describe("Équipe à l'extérieur ou joueur 2"),
      competition: z.string(),
      date: z.string().describe("Date au format AAAA-MM-JJ"),
      time: z.string().nullable().describe("Heure de Paris HH:MM si connue"),
      stage: z.string().nullable().describe("Journée, tour, phase…"),
    }),
  ),
});

// Résumé des cotes d'un match (moyenne des bookmakers, marge incluse).
export const OddsSummarySchema = z.object({
  bookmakers: z.number(),
  home: z.number(),
  draw: z.number().nullable(),
  away: z.number(),
  exchange: z
    .object({ name: z.string(), home: z.number(), draw: z.number().nullable(), away: z.number() })
    .nullable(),
  // Ligne de buts (ou de jeux au tennis) la plus proposée, avec les cotes moyennes plus / moins.
  totals: z.object({ point: z.number(), over: z.number(), under: z.number() }).nullable().optional(),
});
export type OddsSummary = z.infer<typeof OddsSummarySchema>;

// Un match à analyser, avec les identifiants des API qui le connaissent.
export const FixtureSchema = FixturesSchema.shape.fixtures.element.extend({
  odds: OddsSummarySchema.nullable().optional(),
  apiFootballId: z.number().nullable().optional(),
});
export type Fixture = z.infer<typeof FixtureSchema>;

export const AnalysisModeSchema = z.enum(["rapide", "complete"]);
export type AnalysisMode = z.infer<typeof AnalysisModeSchema>;

export const AnalyzeRequestSchema = z.object({
  sport: SportSchema,
  mode: AnalysisModeSchema.optional().default("complete"),
  home: z.string().trim().min(2).max(80),
  away: z.string().trim().min(2).max(80),
  competition: z.string().trim().max(80).optional().default(""),
  date: z.string().trim().max(40).optional().default(""),
  odds: OddsSummarySchema.nullable().optional(),
  apiFootballId: z.number().nullable().optional(),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

export const FixturesRequestSchema = z.object({
  sport: SportSchema,
  competition: z.string().trim().min(2).max(80),
});

// Consommation des quotas gratuits : affichée pour surveiller les limites.
export type Usage = {
  geminiRequests: number;
  webSearches: number;
  oddsRequestsRemaining: number | null;
  apiFootballRequestsRemaining: number | null;
};

export type ConsultedPage = { title: string; url: string };

export type AnalysisResult = {
  analysis: Analysis;
  consensus: import("./consensus").Consensus;
  consultedPages: ConsultedPage[];
  usage: Usage;
  createdAt: string;
  mode?: AnalysisMode;
  picks?: MarketPick[]; // tous les paris proposés pour ce match, prêts pour le coupon
  engine?: "ia" | "calcul"; // "calcul" : sans Gemini, à partir des cotes et d'API-Football
  notice?: string; // explique pourquoi l'analyse a été calculée sans IA (quota Gemini atteint…)
  demo?: boolean;
};

// Un pari proposé, avec sa probabilité et la cote (bookmaker si connue, sinon cote juste estimée).
export type MarketPick = {
  category: MarketCategory;
  selection: string;
  probability: number;
  odds: number;
  oddsSource: "bookmaker" | "estimée";
  basis: "cotes" | "cotes + IA" | "estimation IA" | "calcul";
  reasoning: string;
  reliability?: "fiable" | "moyenne" | "fragile";
};

// Services configurés sur le serveur (clés présentes).
export type ServicesStatus = { gemini: boolean; odds: boolean; apiFootball: boolean; demo: boolean; backupAI?: boolean; backupSearch?: boolean };

// Événements envoyés au navigateur pendant l'analyse (une ligne JSON par événement).
export type StreamEvent =
  | { type: "progress"; message: string }
  | { type: "result"; data: unknown }
  | { type: "error"; message: string; code?: "quota" };
