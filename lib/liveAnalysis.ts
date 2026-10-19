// Analyse d'un match EN COURS : à partir du score, de la minute, des statistiques et des faits marquants du match,
// l'IA estime la suite (résultat final, prochain but) et propose des paris en direct.
import { z } from "zod";
import { fetchMatchDetail } from "./espn";
import { AnalysisError, aiAvailable, emptyUsage, structure, todayInParis } from "./gemini";

export const LiveAnalysisRequestSchema = z.object({
  slug: z.string().max(40),
  id: z.string().max(20),
  competition: z.string().max(80),
  home: z.string().max(80),
  away: z.string().max(80),
  homeScore: z.number().nullable(),
  awayScore: z.number().nullable(),
  clock: z.string().max(20),
  prior: z.string().max(1500).nullable().describe("Résumé de l'analyse d'avant-match, si elle existe"),
});
export type LiveAnalysisRequest = z.infer<typeof LiveAnalysisRequestSchema>;

export const LiveAnalysisSchema = z.object({
  summary: z.string().describe("Ce qui se passe dans ce match, en deux ou trois phrases"),
  momentum: z.enum(["home", "away", "equilibre"]).describe("Équipe qui domine en ce moment"),
  prob_home: z.number().describe("Probabilité en % que l'équipe à domicile gagne à la fin"),
  prob_draw: z.number(),
  prob_away: z.number(),
  next_goal_home: z.number().describe("Probabilité en % que le prochain but soit marqué par l'équipe à domicile"),
  next_goal_away: z.number(),
  no_more_goal: z.number().describe("Probabilité en % qu'il n'y ait plus de but"),
  expected_final_score: z.string().describe("Score final le plus probable, ex : '2-1'"),
  bets: z
    .array(z.object({ bet: z.string(), probability: z.number(), reasoning: z.string() }))
    .describe("2 à 4 paris en direct intéressants (résultat final, plus/moins de buts restants, prochain but…)"),
  warning: z.string().describe("Ce qui pourrait tout changer (carton rouge, fatigue, changements…)"),
});
export type LiveAnalysis = z.infer<typeof LiveAnalysisSchema>;

const SYSTEM = `Tu es un analyste de paris en direct, prudent et rigoureux. On te donne l'état d'un match de football EN COURS.
- Pars du score et du temps restant : plus le match avance, plus le score actuel pèse. Une équipe menée de deux buts à la 80e gagne très rarement.
- Sers-toi des statistiques (possession, tirs, tirs cadrés, corners) pour juger qui domine vraiment, pas seulement du score.
- Tiens compte des cartons rouges et des faits marquants.
- Les probabilités de résultat final font 100 au total ; celles du prochain but (domicile, extérieur, plus de but) aussi.
- Propose des paris en direct qui ont de la valeur, avec leur probabilité. N'invente aucun fait absent des données.
Réponds en français, phrases courtes. Ne promets jamais de gain.`;

export async function analyzeLive(req: LiveAnalysisRequest, onProgress: (m: string) => void): Promise<LiveAnalysis> {
  if (!aiAvailable()) throw new AnalysisError("L'IA est indisponible pour le moment (quota atteint). Réessayez plus tard.", "quota");
  onProgress("Récupération des statistiques du match…");
  const detail = await fetchMatchDetail(req.slug, req.id).catch(() => ({ stats: [], events: [] }));
  const text = [
    `Nous sommes le ${todayInParis()}. Match EN COURS (${req.competition}) : ${req.home} (domicile) contre ${req.away} (extérieur).`,
    `Score : ${req.home} ${req.homeScore ?? 0} - ${req.awayScore ?? 0} ${req.away}. Minute : ${req.clock}.`,
    detail.stats.length ? `Statistiques du match :\n- ${detail.stats.join("\n- ")}` : "Statistiques du match indisponibles.",
    detail.events.length ? `Faits marquants :\n- ${detail.events.join("\n- ")}` : "",
    req.prior ? `Analyse d'avant-match : ${req.prior}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  onProgress("L'IA analyse le match en direct…");
  return structure(LiveAnalysisSchema, SYSTEM, text, emptyUsage(), onProgress);
}

export function demoLiveAnalysis(req: LiveAnalysisRequest): LiveAnalysis {
  return {
    summary: `${req.home} contrôle le ballon mais manque de précision ; ${req.away} est dangereux en contre (démo).`,
    momentum: "home",
    prob_home: 48,
    prob_draw: 30,
    prob_away: 22,
    next_goal_home: 52,
    next_goal_away: 28,
    no_more_goal: 20,
    expected_final_score: `${(req.homeScore ?? 0) + 1}-${req.awayScore ?? 0}`,
    bets: [
      { bet: `Prochain but : ${req.home}`, probability: 52, reasoning: "Plus de tirs cadrés et pression constante (démo)." },
      { bet: "Plus de 0,5 but restant", probability: 80, reasoning: "Rythme élevé des deux côtés (démo)." },
    ],
    warning: "Un carton rouge ou une blessure changerait tout (démo).",
  };
}
