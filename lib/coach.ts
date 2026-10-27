// « Coach de coupon » : Gemini relit le coupon proposé par le calcul, comme un parieur expérimenté,
// et dit quelles sélections garder, lesquelles retirer et pourquoi.
import { z } from "zod";
import { AnalysisError, aiAvailable, emptyUsage, structure, todayInParis } from "./gemini";

export type CoachStyle = "prudent" | "agressif";

export const CoachLegSchema = z.object({
  match: z.string().max(120),
  competition: z.string().max(80),
  date: z.string().nullable(),
  selection: z.string().max(120),
  category: z.string().max(40),
  odds: z.number(),
  probability: z.number(),
  oddsSource: z.string().max(20),
  confidence: z.string().max(20).nullable(),
  summary: z.string().max(1500),
  risks: z.array(z.string().max(300)).max(8),
  alternatives: z.array(z.string().max(160)).max(8).describe("Autres paris possibles sur ce match : 'sélection @ cote (probabilité %)'"),
});

export const CoachRequestSchema = z.object({
  style: z.enum(["prudent", "agressif"]),
  profile: z.string().max(40),
  legs: z.array(CoachLegSchema).min(1).max(12),
});
export type CoachRequest = z.infer<typeof CoachRequestSchema>;

export const CoachReviewSchema = z.object({
  verdict: z.enum(["solide", "jouable", "a_eviter"]),
  headline: z.string().describe("Avis en une phrase"),
  weakest_link: z.string().describe("La sélection la plus fragile du coupon et pourquoi"),
  legs: z.array(
    z.object({
      match: z.string().describe("Recopie exacte du nom du match"),
      keep: z.boolean(),
      reason: z.string().describe("Pourquoi garder ou retirer, en une phrase"),
      replacement: z.string().nullable().describe("Pari de remplacement pris dans les alternatives fournies, ou null"),
    }),
  ),
  correlations: z.array(z.string()).describe("Sélections qui dépendent l'une de l'autre ou risques communs (même soirée, mêmes conditions…)"),
  advice: z.string().describe("Conseil final : jouer, réduire, remplacer, ou ne pas jouer"),
  suggested_stake_percent: z.number().describe("Mise conseillée en % de la bankroll (0 à 5)"),
});
export type CoachReview = z.infer<typeof CoachReviewSchema>;

const STYLES: Record<CoachStyle, string> = {
  prudent: `Style PRUDENT : ta priorité est de ne garder que le solide.
- Retire toute sélection douteuse, même si le coupon devient très court. Un coupon de 2 sélections solides vaut mieux que 5 moyennes.
- Si rien n'est vraiment solide, conclus franchement « ne pas jouer aujourd'hui » (verdict a_eviter).
- Mise conseillée entre 0 et 3 % de la bankroll.`,
  agressif: `Style AGRESSIF : tu cherches le meilleur rapport gain / risque et tu proposes toujours un coupon jouable.
- Garde les sélections à bonne cote si leur probabilité tient la route ; remplace plutôt que retirer quand une meilleure alternative existe.
- Tu acceptes plus de risque, mais tu signales clairement le maillon faible.
- Mise conseillée entre 0,5 et 5 % de la bankroll ; ne mets jamais 0.`,
};

const SYSTEM = (style: CoachStyle) => `Tu es un parieur professionnel qui relit le coupon combiné d'un ami avant qu'il le joue. Tu es direct et honnête.

Ta méthode :
1. Pour chaque sélection, vérifie que la probabilité annoncée est crédible au vu de la cote et du résumé d'analyse. Une cote de bookmaker est un prix de marché : méfie-toi si la probabilité annoncée s'en écarte beaucoup.
2. Repère les pièges : favori à l'extérieur, match sans enjeu, derby, rotation probable, risques listés par l'analyse, marchés fragiles (corners, cartons, score exact).
3. Repère les sélections liées entre elles ou exposées au même risque.
4. Rappelle-toi que chaque sélection ajoutée multiplie le risque : la probabilité du coupon est le produit des probabilités.
5. Décide pour chaque sélection : garder ou retirer, et propose un remplacement uniquement parmi les alternatives fournies.

${STYLES[style]}

Réponds en français, phrases courtes, sans jargon. Ne promets jamais de gain. Ne parle jamais de mise, de montant ni de bankroll.`;

export async function reviewCoupon(req: CoachRequest, onProgress: (m: string) => void): Promise<CoachReview> {
  if (!aiAvailable()) throw new AnalysisError("Gemini est indisponible (clé absente ou quota atteint). Réessayez plus tard.");
  const total = req.legs.reduce((t, l) => t * l.odds, 1);
  const prob = req.legs.reduce((t, l) => t * (l.probability / 100), 1) * 100;
  const text = [
    `Nous sommes le ${todayInParis()}. Profil choisi : ${req.profile}.`,
    `Coupon de ${req.legs.length} sélection(s), cote totale ${total.toFixed(2)}, probabilité estimée ${prob.toFixed(1)} %.`,
    ...req.legs.map((l, i) =>
      [
        `\n### Sélection ${i + 1} — ${l.match} (${l.competition}${l.date ? `, ${l.date}` : ""})`,
        `Pari : ${l.selection} [${l.category}] @ ${l.odds.toFixed(2)} (cote ${l.oddsSource}), probabilité ${l.probability.toFixed(0)} %, confiance de l'analyse : ${l.confidence ?? "inconnue"}.`,
        `Résumé de l'analyse : ${l.summary}`,
        l.risks.length ? `Risques relevés : ${l.risks.join(" ; ")}` : "",
        l.alternatives.length ? `Alternatives sur ce match : ${l.alternatives.join(" | ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ].join("\n");
  onProgress("Le coach relit votre coupon…");
  return structure(CoachReviewSchema, SYSTEM(req.style), text, emptyUsage(), onProgress);
}

export function demoReview(req: CoachRequest): CoachReview {
  return {
    verdict: req.style === "prudent" ? "jouable" : "solide",
    headline: "Coupon correct, mais une sélection fragile (démo).",
    weakest_link: `${req.legs[0].match} : ${req.legs[0].selection}, probabilité optimiste (démo).`,
    legs: req.legs.map((l, i) => ({ match: l.match, keep: i !== 0 || req.style === "agressif", reason: "Explication du coach (démo).", replacement: null })),
    correlations: [],
    advice: req.style === "prudent" ? "Retirez la première sélection (démo)." : "Jouable tel quel (démo).",
    suggested_stake_percent: req.style === "prudent" ? 1 : 2.5,
  };
}
