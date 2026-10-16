// Construit un coupon combiné à partir des matchs analysés : au plus une sélection par match,
// choisie selon le profil de risque, puis classement des matchs pour garder les meilleures.
import type { AnalysisResult, MarketCategory, MarketPick } from "./schemas";

export type RiskProfile = "sur" | "equilibre" | "audacieux";

export const PROFILES: Record<RiskProfile, { label: string; description: string; minProbability: number }> = {
  sur: { label: "Sûr", description: "Sélections très probables, petite cote", minProbability: 70 },
  equilibre: { label: "Équilibré", description: "Bon compromis entre chance de gain et cote", minProbability: 58 },
  audacieux: { label: "Audacieux", description: "Cotes plus élevées, risque assumé", minProbability: 42 },
};

export const CATEGORY_LABELS: Record<MarketCategory, string> = {
  resultat: "Résultat",
  double_chance: "Double chance",
  buts: "Buts",
  les_deux_marquent: "Les deux marquent",
  corners: "Corners",
  fautes: "Fautes",
  cartons: "Cartons",
  sets: "Sets",
  jeux: "Jeux",
};

export type CouponLeg = { match: string; competition: string; date: string | null; pick: MarketPick };

export type Coupon = {
  legs: CouponLeg[];
  totalOdds: number;
  probability: number; // % que tout le coupon passe, en supposant les matchs indépendants
  estimatedOddsCount: number; // sélections dont la cote est estimée faute de cote bookmaker
};

// Score d'une sélection selon le profil : sûreté pure, compromis, ou valeur attendue.
function score(pick: MarketPick, profile: RiskProfile) {
  const p = pick.probability / 100;
  // Une cote estimée n'est pas garantie chez le bookmaker : on la décote pour préférer les cotes réelles.
  const odds = pick.oddsSource === "bookmaker" ? pick.odds : 1 + (pick.odds - 1) * 0.85;
  const trust = pick.oddsSource === "bookmaker" ? 1.05 : 1;
  if (profile === "sur") return p * trust;
  if (profile === "equilibre") return p * Math.log(odds + 0.5) * trust;
  return p * odds * trust;
}

export function buildCoupon(
  results: AnalysisResult[],
  options: { profile: RiskProfile; size: number; categories: MarketCategory[] },
): Coupon {
  const { minProbability } = PROFILES[options.profile];
  const candidates: (CouponLeg & { score: number })[] = [];

  for (const r of results) {
    const allowed = (r.picks ?? []).filter(
      (p) => options.categories.includes(p.category) && p.probability >= minProbability && p.odds > 1.05,
    );
    if (allowed.length === 0) continue;
    const best = allowed.reduce((a, b) => (score(b, options.profile) > score(a, options.profile) ? b : a));
    candidates.push({
      match: `${r.analysis.match.home} – ${r.analysis.match.away}`,
      competition: r.analysis.match.competition,
      date: r.analysis.match.date,
      pick: best,
      score: score(best, options.profile),
    });
  }

  const legs = candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, options.size)
    .map(({ score: _score, ...leg }) => leg);

  return {
    legs,
    totalOdds: Math.round(legs.reduce((t, l) => t * l.pick.odds, 1) * 100) / 100,
    probability: Math.round(legs.reduce((t, l) => t * (l.pick.probability / 100), 1) * 1000) / 10,
    estimatedOddsCount: legs.filter((l) => l.pick.oddsSource === "estimée").length,
  };
}
