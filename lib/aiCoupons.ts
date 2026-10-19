// Coupons composés directement par l'IA : à partir de toutes les analyses récentes, elle choisit elle-même
// les sélections de cinq coupons (Value, Sûr, Équilibré, Audacieux, Grosse cote).
import { z } from "zod";
import { AnalysisError, aiAvailable, emptyUsage, structure, todayInParis } from "./gemini";

export const AI_PROFILES = ["value", "sur", "equilibre", "audacieux", "jackpot"] as const;
export type AiProfile = (typeof AI_PROFILES)[number];

export const AiCouponsRequestSchema = z.object({
  size: z.number().int().min(1).max(10).nullable().describe("Nombre de sélections par coupon, null = au choix de l'IA"),
  matches: z
    .array(
      z.object({
        match: z.string().max(120),
        competition: z.string().max(80),
        date: z.string().nullable(),
        confidence: z.string().max(20).nullable(),
        summary: z.string().max(600),
        risks: z.array(z.string().max(200)).max(5),
        picks: z.array(z.string().max(220)).max(14).describe("« id | pari | marché | cote | probabilité | source de la cote | fiabilité »"),
      }),
    )
    .min(1)
    .max(40),
});
export type AiCouponsRequest = z.infer<typeof AiCouponsRequestSchema>;

export const AiCouponsSchema = z.object({
  coupons: z.array(
    z.object({
      profile: z.enum(AI_PROFILES),
      legs: z.array(z.object({ pick_id: z.string().describe("Identifiant exact du pari choisi"), reason: z.string().describe("Pourquoi ce pari, en une phrase") })),
      comment: z.string().describe("Avis sur le coupon en une ou deux phrases"),
      stake_percent: z.number().describe("Mise conseillée en % de la bankroll"),
    }),
  ),
});
export type AiCoupons = z.infer<typeof AiCouponsSchema>;

const SYSTEM = (size: number | null) => `Tu es un parieur professionnel. À partir des analyses de matchs fournies, compose CINQ coupons combinés, un par profil :
- "value" : uniquement des paris dont la probabilité dépasse nettement celle de la cote du bookmaker (cote bookmaker de préférence). Mise 1 à 3 %.
- "sur" : les sélections les plus probables (≥ 70 % si possible), petite cote totale. Mise 2 à 5 %.
- "equilibre" : bon compromis probabilité / cote (environ 55 à 70 % par sélection). Mise 1 à 3 %.
- "audacieux" : cotes plus élevées, probabilité 40 à 60 % par sélection. Mise 0,5 à 2 %.
- "jackpot" (grosse cote) : paris à forte cote (≥ 2,5) comme score exact, mi-temps/fin, combinés résultat + buts. Mise 0,5 à 1 %.

Règles :
- ${size ? `Exactement ${size} sélection(s) par coupon (moins seulement s'il n'y a pas assez de matchs ou de paris valables).` : "Choisis toi-même le nombre de sélections de chaque coupon, entre 2 et 6, en restant raisonnable : plus il y a de sélections, plus le risque grimpe."}
- Au plus UNE sélection par match dans un même coupon.
- Utilise UNIQUEMENT les identifiants de paris fournis (pick_id exact), n'invente rien.
- Évite les matchs dont l'analyse signale des risques forts ou une confiance faible, sauf pour la grosse cote.
- Préfère les cotes de bookmaker aux cotes estimées, et méfie-toi des marchés « fragile ».
- Évite de mettre dans un même coupon des sélections exposées au même risque.
- Si aucun pari ne convient à un profil (souvent "value"), renvoie ce coupon avec une liste vide et explique pourquoi dans le commentaire.
Réponds en français, phrases courtes. Ne promets jamais de gain.`;

export async function buildAiCoupons(req: AiCouponsRequest, onProgress: (m: string) => void): Promise<AiCoupons> {
  if (!aiAvailable()) throw new AnalysisError("L'IA est indisponible pour le moment (quota atteint). Utilisez le générateur manuel.", "quota");
  onProgress(`L'IA compose les coupons à partir de ${req.matches.length} match${req.matches.length > 1 ? "s" : ""}…`);
  const text = [
    `Nous sommes le ${todayInParis()}.`,
    ...req.matches.map((m) =>
      [
        `\n### ${m.match} (${m.competition}${m.date ? `, ${m.date}` : ""}) — confiance de l'analyse : ${m.confidence ?? "inconnue"}`,
        `Résumé : ${m.summary}`,
        m.risks.length ? `Risques : ${m.risks.join(" ; ")}` : "",
        `Paris possibles :\n${m.picks.map((p) => `  ${p}`).join("\n")}`,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ].join("\n");
  return structure(AiCouponsSchema, SYSTEM(req.size), text, emptyUsage(), onProgress);
}
