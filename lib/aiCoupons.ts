// Coupons composés directement par l'IA : à partir de toutes les analyses récentes, elle choisit elle-même
// les sélections de cinq coupons (Value, Sûr, Équilibré, Audacieux, Grosse cote).
import { z } from "zod";
import { AnalysisError, aiAvailable, emptyUsage, structure, todayInParis } from "./gemini";

export const AI_PROFILES = ["x2", "x5", "x10", "x20", "x50"] as const;
export type AiProfile = (typeof AI_PROFILES)[number];

export const AiCouponsRequestSchema = z.object({
  size: z.number().int().min(1).max(30).nullable().describe("Nombre maximum de sélections par coupon, null = au choix de l'IA"),
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
    .max(60),
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

const SYSTEM = (size: number | null) => `Tu es un parieur professionnel. Ton but est de GAGNER sur la durée, pas seulement de jouer des favoris.
À partir des analyses de matchs fournies, compose CINQ coupons combinés, du plus sûr au plus coté :
- "x2" : cote totale autour de 2. Mise 3 à 5 %.
- "x5" : cote totale autour de 5. Mise 2 à 3 %.
- "x10" : cote totale autour de 10. Mise 1 à 2 %.
- "x20" : cote totale autour de 20. Mise 0,5 à 1,5 %.
- "x50" : cote totale autour de 50. Mise 0,5 à 1 %.

Ta philosophie :
- Une petite cote ne garantit rien. Un favori à 1,25 perd une fois sur quatre et rapporte très peu : il ne vaut que si sa probabilité réelle dépasse nettement 80 %.
- Cherche la VALEUR : les paris dont la probabilité de l'analyse dépasse celle de la cote du bookmaker (probabilité × cote > 1). Ce sont souvent des outsiders sous-estimés, des matchs nuls probables, des « plus de 2,5 buts » ou « les deux marquent » entre attaques efficaces, un handicap +1 sur une équipe solide.
- Ne mets pas un favori simplement parce qu'il est favori : vérifie sa forme, ses absences, la motivation, le calendrier.
- Mieux vaut peu de sélections bien choisies à 1,60-2,50 qu'une pile de favoris à 1,20.

Règles :
- Chaque sélection : cote d'au moins 1,40 et probabilité d'au moins 50 % (60 % pour "x2"). Pas de score exact ni de marché « fragile ».
- Pas plus de deux favoris à moins de 1,60 dans un même coupon.
- ${size ? `Au plus ${size} sélection(s) par coupon.` : "Choisis le nombre de sélections nécessaire pour approcher la cote visée, en privilégiant 2 à 6 sélections."}
- Au plus UNE sélection par match dans un même coupon. Un même match peut figurer dans plusieurs coupons.
- Utilise UNIQUEMENT les identifiants de paris fournis (pick_id exact), n'invente rien.
- Écarte les matchs dont l'analyse signale une confiance faible ou des risques forts.
- Préfère les cotes de bookmaker aux cotes estimées.
- Si la cote visée ne peut pas être atteinte avec des paris qui respectent ces règles, propose le coupon le plus proche et explique-le.
- Pour chaque sélection, la raison doit dire pourquoi ce pari a de la valeur, pas seulement qu'il est probable.
- Dans le commentaire, rappelle la probabilité réelle du coupon.
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
