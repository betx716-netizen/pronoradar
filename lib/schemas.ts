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
  demo?: boolean;
};

// Événements envoyés au navigateur pendant l'analyse (une ligne JSON par événement).
export type StreamEvent =
  | { type: "progress"; message: string }
  | { type: "result"; data: unknown }
  | { type: "error"; message: string; code?: "quota" };
