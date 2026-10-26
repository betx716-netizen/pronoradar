// Coupons du jour : l'IA les compose à partir de toutes les analyses de la journée.
// Si l'IA est indisponible, le générateur automatique (lib/coupon.ts) prend le relais.
import { AI_PROFILES, buildAiCoupons, type AiCouponsRequest, type AiProfile } from "./aiCoupons";
import { CATEGORY_LABELS, buildCoupon, type CouponLeg } from "./coupon";
import type { AnalysisResult, MarketCategory, MarketPick } from "./schemas";

export type DailyLeg = CouponLeg & { reason: string; matchId: string };

export type DailyCoupon = {
  profile: AiProfile;
  title: string;
  subtitle: string;
  legs: DailyLeg[];
  comment: string;
  stakePercent: number;
  totalOdds: number;
  probability: number;
};

export const COUPON_META: Record<AiProfile, { title: string; subtitle: string }> = {
  x2: { title: "Le sûr", subtitle: "Cote ≈ 2" },
  x5: { title: "L'équilibré", subtitle: "Cote ≈ 5" },
  x10: { title: "L'ambitieux", subtitle: "Cote ≈ 10" },
  x20: { title: "Le coup", subtitle: "Cote ≈ 20" },
  x50: { title: "La grosse cote", subtitle: "Cote ≈ 50" },
  multi: { title: "Le grand combiné", subtitle: "10 à 15 sélections sûres" },
};

export type DayResult = { id: string; result: AnalysisResult };

const matchName = (r: AnalysisResult) => `${r.analysis.match.home} – ${r.analysis.match.away}`;

// Paris envoyés à l'IA pour chaque match : ceux qui ont le plus de valeur, puis les plus probables,
// et quelques paris très sûrs pour le grand combiné.
function candidates(r: AnalysisResult): MarketPick[] {
  const ok = (r.picks ?? []).filter((p) => p.odds >= 1.3 && p.probability >= 45 && p.reliability !== "fragile");
  const byValue = [...ok].sort((a, b) => b.probability * b.odds - a.probability * a.odds).slice(0, 8);
  const byProb = [...ok].sort((a, b) => b.probability - a.probability).slice(0, 6);
  const safe = (r.picks ?? [])
    .filter((p) => p.odds >= 1.04 && p.odds < 1.45 && p.probability >= 78 && p.reliability !== "fragile")
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 3);
  return [...new Set([...byValue, ...byProb, ...safe])].slice(0, 14);
}

function finish(profile: AiProfile, legs: DailyLeg[], comment: string, stakePercent: number): DailyCoupon {
  return {
    profile,
    ...COUPON_META[profile],
    legs,
    comment,
    stakePercent,
    totalOdds: Math.round(legs.reduce((t, l) => t * l.pick.odds, 1) * 100) / 100,
    probability: Math.round(legs.reduce((t, l) => t * (l.pick.probability / 100), 1) * 1000) / 10,
  };
}

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as MarketCategory[];
const DEFAULT_STAKE: Record<AiProfile, number> = { x2: 4, x5: 2.5, x10: 1.5, x20: 1, x50: 0.5, multi: 1.5 };

/** Générateur sans IA : mêmes profils, sélections choisies par le calcul de valeur. */
export function computedCoupons(day: DayResult[]): DailyCoupon[] {
  const idOf = new Map(day.map((d) => [matchName(d.result), d.id]));
  return AI_PROFILES.map((profile) => {
    const c = buildCoupon(
      day.map((d) => d.result),
      { profile, size: profile === "multi" ? 15 : 8, categories: ALL_CATEGORIES },
    );
    const legs = c.legs.map((l) => ({ ...l, matchId: idOf.get(l.match) ?? "", reason: l.pick.reasoning || "Sélection choisie pour sa probabilité et sa cote." }));
    return finish(profile, legs, "Coupon calculé à partir des cotes et des probabilités des analyses.", DEFAULT_STAKE[profile]);
  }).filter((c) => c.legs.length > 0);
}

/** Les six coupons du jour, composés par l'IA (ou calculés si elle est indisponible). */
export async function composeDailyCoupons(day: DayResult[], onProgress: (m: string) => void = () => {}): Promise<DailyCoupon[]> {
  if (day.length === 0) return [];
  const index = new Map<string, DailyLeg>();
  const body: AiCouponsRequest = {
    size: null,
    matches: day.slice(0, 60).map(({ id, result: r }, i) => {
      const ai = r.analysis.ai_analysis;
      return {
        match: matchName(r),
        competition: r.analysis.match.competition,
        date: r.analysis.match.date,
        confidence: ai.confidence ?? null,
        summary: (ai.summary ?? "").slice(0, 600),
        risks: (ai.risks ?? []).slice(0, 5).map((x) => x.slice(0, 200)),
        picks: candidates(r).map((p, j) => {
          const pickId = `m${i}p${j}`;
          index.set(pickId, { match: matchName(r), competition: r.analysis.match.competition, date: r.analysis.match.date, pick: p, matchId: id, reason: "" });
          return [pickId, p.selection, CATEGORY_LABELS[p.category], p.odds.toFixed(2), `${p.probability.toFixed(0)} %`, p.oddsSource, p.reliability ?? "?"]
            .join(" | ")
            .slice(0, 220);
        }),
      };
    }),
  };

  try {
    const res = await buildAiCoupons(body, onProgress);
    const coupons = AI_PROFILES.map((profile) => {
      const c = res.coupons.find((x) => x.profile === profile);
      const seen = new Set<string>();
      const legs = (c?.legs ?? []).flatMap((l) => {
        const leg = index.get(l.pick_id.trim());
        // Une seule sélection par match, et seulement des paris existants. Hors grand combiné, rien sous 1,35.
        if (!leg || seen.has(leg.match)) return [];
        if (profile !== "multi" && leg.pick.odds < 1.35) return [];
        seen.add(leg.match);
        return [{ ...leg, reason: l.reason }];
      });
      return finish(profile, legs, c?.comment ?? "", c?.stake_percent ?? DEFAULT_STAKE[profile]);
    }).filter((c) => c.legs.length > 0);
    if (coupons.length) return coupons;
  } catch (e) {
    onProgress(`IA indisponible pour les coupons : ${e instanceof Error ? e.message : String(e)}`);
  }
  return computedCoupons(day);
}
