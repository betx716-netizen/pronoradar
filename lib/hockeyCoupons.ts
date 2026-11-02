// Coupons hockey (NHL) à très grosse cote : 100 à 3 000. Construits surtout avec les buteurs en forme et les
// paris « les deux équipes marquent dans chaque période », qui font monter la cote vite. Ce sont des paris plaisir :
// la chance réelle est affichée telle quelle (souvent moins de 1 %).
import { z } from "zod";
import { CATEGORY_LABELS } from "./coupon";
import type { DailyCoupon, DailyLeg, DayResult } from "./dailyCoupons";
import { AnalysisError, aiAvailable, emptyUsage, structure, todayInParis } from "./gemini";
import type { MarketPick } from "./schemas";

export const HOCKEY_PROFILES = [
  { id: "hockey_100", title: "Hockey · Grosse cote", subtitle: "Cote 100 à 500", min: 100, max: 500 },
  { id: "hockey_1000", title: "Hockey · Jackpot", subtitle: "Cote 500 à 3 000", min: 500, max: 3000 },
] as const;

const matchName = (d: DayResult) => `${d.result.analysis.match.home} – ${d.result.analysis.match.away}`;

// Paris retenus : ceux qui font monter la cote sans être absurdes (un buteur à 25-45 %, les deux équipes dans chaque période…).
function candidates(d: DayResult): MarketPick[] {
  const picks = (d.result.picks ?? []).filter((p) => p.odds >= 1.5 && p.probability >= 15);
  const weight = (p: MarketPick) => (["buteur", "buteur_ou_passeur", "btts_periodes", "marque_chaque_periode"].includes(p.category) ? 1.15 : 1);
  return picks.sort((a, b) => b.probability * b.odds * weight(b) - a.probability * a.odds * weight(a)).slice(0, 14);
}

const total = (legs: DailyLeg[]) => Math.round(legs.reduce((t, l) => t * l.pick.odds, 1) * 100) / 100;
const chance = (legs: DailyLeg[]) => Math.round(legs.reduce((t, l) => t * (l.pick.probability / 100), 1) * 10000) / 100;

// Pas deux fois le même pari, ni deux fois le même joueur dans un coupon ; au plus 3 paris par match.
function allowed(leg: DailyLeg, legs: DailyLeg[]) {
  const same = legs.filter((l) => l.matchId === leg.matchId);
  if (same.length >= 3) return false;
  const who = (s: string) => s.toLowerCase().replace(/\s+(buteur|marque ou fait une passe|passeur).*$/, "").trim();
  return !legs.some((l) => l.pick.selection === leg.pick.selection || (l.pick.category.startsWith("buteur") && leg.pick.category.startsWith("buteur") && who(l.pick.selection) === who(leg.pick.selection)));
}

function finish(profile: (typeof HOCKEY_PROFILES)[number], legs: DailyLeg[], comment: string): DailyCoupon {
  return {
    profile: profile.id as DailyCoupon["profile"],
    title: profile.title,
    subtitle: `Cote ${total(legs).toFixed(2)}`,
    legs,
    comment,
    stakePercent: 0,
    totalOdds: total(legs),
    probability: chance(legs),
  };
}

/** Sans IA : on empile les meilleurs paris (buteurs d'abord) jusqu'à entrer dans la fourchette de cote. */
function computed(day: DayResult[]): DailyCoupon[] {
  const pool: DailyLeg[] = day.flatMap((d) =>
    candidates(d).map((p) => ({ match: matchName(d), competition: d.result.analysis.match.competition, date: d.result.analysis.match.date, pick: p, matchId: d.id, reason: p.reasoning || "" })),
  );
  return HOCKEY_PROFILES.map((profile) => {
    const legs: DailyLeg[] = [];
    for (const leg of pool) {
      if (total(legs) >= profile.min) break;
      if (!allowed(leg, legs)) continue;
      if (total([...legs, leg]) > profile.max) continue;
      legs.push(leg);
    }
    return finish(profile, legs, "Coupon frisson calculé à partir des buteurs et des buts par période. Pari plaisir : très petite mise.");
  }).filter((c) => c.legs.length > 1 && c.totalOdds >= c.legs.length);
}

const Schema = z.object({
  coupons: z.array(
    z.object({
      profile: z.enum(["hockey_100", "hockey_1000"]),
      legs: z.array(z.object({ pick_id: z.string(), reason: z.string() })),
      comment: z.string(),
    }),
  ),
});

const SYSTEM = `Tu es un parieur expert de la NHL. Tu composes des coupons à TRÈS GROSSE COTE, assumés comme des paris plaisir.
Deux coupons :
- "hockey_100" : cote totale entre 100 et 500.
- "hockey_1000" : cote totale entre 500 et 3 000.
Méthode :
- Construis surtout avec les BUTEURS EN FORME (ceux qui ont marqué récemment, 1re ligne et power play, gardien adverse faible ou fatigué) et avec « les deux équipes marquent dans chaque période » ou « [équipe] marque dans chaque période ». Complète si besoin par un vainqueur ou des buts par période.
- Chaque sélection doit rester crédible : un buteur qui a vraiment une bonne chance de marquer, pas un nom au hasard.
- Au plus 3 sélections par match, jamais deux fois le même joueur, rien de contradictoire.
- Utilise UNIQUEMENT les identifiants de paris fournis (pick_id exact), n'invente rien.
- Raisons courtes et concrètes (forme récente, power play, gardien adverse).
- Commentaire : affirmatif, mais dis en une phrase que c'est un pari plaisir à très faible chance. Ne parle jamais de mise ni d'argent.
Réponds en français.`;

/** Les coupons hockey du jour : composés par l'IA, sinon calculés. */
export async function composeHockeyCoupons(day: DayResult[], onProgress: (m: string) => void = () => {}): Promise<DailyCoupon[]> {
  if (day.length === 0) return [];
  const index = new Map<string, DailyLeg>();
  const text = [
    `Nous sommes le ${todayInParis()}. Matchs NHL analysés :`,
    ...day.map((d, i) => {
      const lines = candidates(d).map((p, j) => {
        const id = `h${i}p${j}`;
        index.set(id, { match: matchName(d), competition: d.result.analysis.match.competition, date: d.result.analysis.match.date, pick: p, matchId: d.id, reason: "" });
        return `  ${id} | ${p.selection} | ${CATEGORY_LABELS[p.category]} | ${p.odds.toFixed(2)} | ${p.probability.toFixed(0)} %`;
      });
      return `\n### ${matchName(d)}\n${(d.result.analysis.ai_analysis.summary ?? "").slice(0, 400)}\nParis :\n${lines.join("\n")}`;
    }),
  ].join("\n");
  try {
    if (!aiAvailable()) throw new AnalysisError("IA indisponible");
    onProgress("Composition des coupons hockey à grosse cote…");
    const res = await structure(Schema, SYSTEM, text, emptyUsage(), onProgress);
    const out = HOCKEY_PROFILES.map((profile) => {
      const c = res.coupons.find((x) => x.profile === profile.id);
      const legs: DailyLeg[] = [];
      for (const l of c?.legs ?? []) {
        const leg = index.get(l.pick_id.trim());
        if (leg && allowed(leg, legs)) legs.push({ ...leg, reason: l.reason });
      }
      return finish(profile, legs, c?.comment ?? "");
    }).filter((c) => c.legs.length > 1 && c.totalOdds >= 50);
    if (out.length) return out;
  } catch (e) {
    onProgress(`Coupons hockey calculés sans IA : ${e instanceof Error ? e.message : String(e)}`);
  }
  return computed(day);
}
