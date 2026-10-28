// Coupons du jour : l'IA les compose à partir de toutes les analyses de la journée.
// Si l'IA est indisponible, le générateur automatique (lib/coupon.ts) prend le relais.
import { AI_PROFILES, buildAiCoupons, type AiCouponsRequest, type AiProfile } from "./aiCoupons";
import { CATEGORY_LABELS, buildCoupon, clubAlreadyIn, couponTitle, type CouponLeg } from "./coupon";
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

// Paris envoyés à l'IA pour chaque match. Pour qu'elle varie ses coupons, on lui montre tout l'éventail :
// le meilleur pari de chaque type de marché (corners, tirs cadrés, cartons, buteur… compris), puis ceux qui ont
// le plus de valeur, et quelques paris très sûrs pour le grand combiné.
const FRAGILE_MIN = 55; // un marché « fragile » (forte variance) n'est proposé que s'il est assez probable
function candidates(r: AnalysisResult): MarketPick[] {
  const ok = (r.picks ?? []).filter(
    (p) => p.odds >= 1.3 && p.probability >= 45 && (p.reliability !== "fragile" || p.probability >= FRAGILE_MIN) && p.category !== "score_exact",
  );
  const value = (p: MarketPick) => p.probability * p.odds;
  const byCategory = new Map<string, MarketPick[]>();
  for (const p of [...ok].sort((a, b) => value(b) - value(a))) byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), p]);
  const bestOfEach = [...byCategory.values()].map((list) => list[0]);
  const secondOfEach = [...byCategory.values()].flatMap((list) => list.slice(1, 2));
  const byValue = [...ok].sort((a, b) => value(b) - value(a)).slice(0, 6);
  const safe = (r.picks ?? [])
    .filter((p) => p.odds >= 1.04 && p.odds < 1.45 && p.probability >= 78 && p.reliability !== "fragile")
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 3);
  return [...new Set([...bestOfEach, ...byValue, ...safe, ...secondOfEach])].slice(0, 20);
}

function finish(profile: AiProfile, legs: DailyLeg[], comment: string, stakePercent: number): DailyCoupon {
  const totalOdds = Math.round(legs.reduce((t, l) => t * l.pick.odds, 1) * 100) / 100;
  return {
    profile,
    // Le nom suit la cote réellement atteinte : pas de « grosse cote » à 12.
    title: couponTitle(totalOdds, legs.length, profile === "multi"),
    subtitle: profile === "multi" ? COUPON_META.multi.subtitle : `Cote ${totalOdds.toFixed(2)}`,
    legs,
    comment,
    stakePercent,
    totalOdds,
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

// Deux coupons dans la même fourchette de cote auraient le même nom : le suivant prend le nom du palier
// au-dessus (« L'équilibré » plutôt qu'un second « Le sûr »), puisqu'ils sont rangés par cote croissante.
const LADDER = ["Le sûr", "L'équilibré", "L'ambitieux", "Le coup", "La grosse cote"];
function uniqueTitles(coupons: DailyCoupon[]): DailyCoupon[] {
  let floor = -1;
  return coupons.map((c) => {
    if (c.profile === "multi") return c;
    const at = Math.max(LADDER.indexOf(c.title), floor + 1);
    floor = Math.min(at, LADDER.length - 1);
    return { ...c, title: LADDER[floor] };
  });
}

/** Les six coupons du jour, composés par l'IA (ou calculés si elle est indisponible). */
export async function composeDailyCoupons(all: DayResult[], onProgress: (m: string) => void = () => {}): Promise<DailyCoupon[]> {
  // Les analyses faites sans recherche web (actualité non vérifiée) ne servent aux coupons que s'il n'y a pas assez du reste.
  const verified = all.filter((d) => !d.result.offline);
  const day = verified.length >= 6 ? verified : all;
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
        // Ce que disent les pronostiqueurs du web sur les autres marchés (buts, corners…).
        trends: (r.analysis.secondary_trends ?? []).slice(0, 6).map((t) => `${t.market} : ${t.verdict}`.slice(0, 160)),
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
      let fragile = 0;
      const legs: DailyLeg[] = [];
      for (const l of c?.legs ?? []) {
        const leg = index.get(l.pick_id.trim());
        // Un seul pari par club (même écrit autrement), et seulement des paris existants. Hors grand combiné, rien sous 1,35.
        if (!leg || clubAlreadyIn(leg.match, legs)) continue;
        if (profile !== "multi" && leg.pick.odds < 1.35) continue;
        // Au plus un marché à forte variance (corners, cartons, buteur…) par coupon.
        if (leg.pick.reliability === "fragile" && fragile++ >= 1) continue;
        legs.push({ ...leg, reason: l.reason });
      }
      return finish(profile, legs, c?.comment ?? "", c?.stake_percent ?? DEFAULT_STAKE[profile]);
    })
      .filter((c) => c.legs.length > 0)
      .sort((a, b) => Number(a.profile === "multi") - Number(b.profile === "multi") || a.totalOdds - b.totalOdds);
    if (coupons.length) return uniqueTitles(coupons);
  } catch (e) {
    onProgress(`IA indisponible pour les coupons : ${e instanceof Error ? e.message : String(e)}`);
  }
  return computedCoupons(day);
}
