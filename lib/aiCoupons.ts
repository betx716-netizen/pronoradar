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

const SYSTEM = (size: number | null) => `Tu es un parieur professionnel prudent. À partir des analyses de matchs fournies, compose CINQ coupons combinés.
TOUS les coupons doivent être FIABLES : chaque sélection doit être un pari solide, jamais un pari improbable choisi seulement pour sa cote.
Ce qui change d'un coupon à l'autre, c'est uniquement la cote totale visée :
- "x2" : cote totale autour de 2. Les sélections les plus sûres (75 % ou plus si possible). Mise 3 à 5 %.
- "x5" : cote totale autour de 5. Mise 2 à 3 %.
- "x10" : cote totale autour de 10. Mise 1 à 2 %.
- "x20" : cote totale autour de 20. Mise 0,5 à 1,5 %.
- "x50" : cote totale autour de 50. Mise 0,5 à 1 %.

Pour faire monter la cote sans perdre en fiabilité, tu as deux leviers, à combiner :
1. Ajouter des matchs, chacun avec un pari solide.
2. Sur un match, prendre un pari mieux coté mais toujours très probable (par exemple « victoire » plutôt que « double chance », ou « plus de 1,5 buts » combiné au résultat) quand l'analyse le justifie clairement.

Règles :
- Chaque sélection doit avoir au moins 60 % de probabilité (au moins 68 % pour "x2"). Jamais de score exact, de marché « fragile » ni de pari sous 60 %.
- ${size ? `Au plus ${size} sélection(s) par coupon. Si la cote visée ne peut pas être atteinte avec des paris fiables dans cette limite, arrête-toi avant et dis-le.` : "Choisis le nombre de sélections nécessaire pour approcher la cote visée, sans dépasser 30."}
- Au plus UNE sélection par match dans un même coupon. Un même match peut figurer dans plusieurs coupons.
- Utilise UNIQUEMENT les identifiants de paris fournis (pick_id exact), n'invente rien.
- Écarte les matchs dont l'analyse signale une confiance faible ou des risques forts.
- Préfère les cotes de bookmaker aux cotes estimées.
- Si la cote visée ne peut pas être atteinte avec des paris fiables, propose le coupon le plus proche possible et explique-le dans le commentaire ; ne baisse jamais l'exigence de fiabilité.
- Dans le commentaire, rappelle la probabilité réelle du coupon : plus il y a de sélections, plus elle baisse.
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
