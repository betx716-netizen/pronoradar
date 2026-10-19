// Construit un coupon combiné à partir des matchs analysés : au plus une sélection par match,
// choisie selon le profil de risque, puis classement des matchs pour garder les meilleures.
import type { AnalysisResult, MarketCategory, MarketPick } from "./schemas";
import { edge, isValueBet } from "./value";

export type RiskProfile = "value" | "sur" | "equilibre" | "audacieux" | "jackpot";

export const PROFILES: Record<RiskProfile, { label: string; description: string; minProbability: number; minOdds?: number }> = {
  value: { label: "Value", description: "Uniquement les paris où notre probabilité bat la cote du bookmaker (avantage ≥ 3 %)", minProbability: 35 },
  sur: { label: "Sûr", description: "Sélections très probables, petite cote", minProbability: 70 },
  equilibre: { label: "Équilibré", description: "Bon compromis entre chance de gain et cote", minProbability: 58 },
  audacieux: { label: "Audacieux", description: "Cotes plus élevées, risque assumé", minProbability: 42 },
  jackpot: {
    label: "Grosse cote",
    description: "Paris à forte cote (≥ 2,50) : score exact, mi-temps/fin, combinés… Très peu de chances de passer, petite mise uniquement",
    minProbability: 12,
    minOdds: 2.5,
  },
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
  rembourse: "Remboursé si nul",
  mi_temps: "Mi-temps",
  mi_temps_fin: "Mi-temps / Fin",
  handicap: "Handicap",
  score_exact: "Score exact",
  buts_equipe: "Buts par équipe",
  resultat_buts: "Résultat + buts",
  resultat_btts: "Résultat + les deux marquent",
  tirs_cadres: "Tirs cadrés",
  hors_jeu: "Hors-jeu",
  premier_set: "1er set",
  handicap_jeux: "Handicap jeux",
  score_sets: "Score en sets",
  tie_break: "Tie-break",
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
  const reliability = pick.reliability === "fragile" ? 0.8 : pick.reliability === "moyenne" ? 0.92 : 1;
  const trust = (pick.oddsSource === "bookmaker" ? 1.05 : 1) * reliability;
  if (profile === "value") return (edge(pick) ?? -1) * reliability;
  if (profile === "sur") return p * trust;
  if (profile === "equilibre") return p * Math.log(odds + 0.5) * trust;
  if (profile === "audacieux") return p * odds * trust;
  // Grosse cote : on vise la cote, tout en écartant les paris presque impossibles.
  return p * odds ** 1.3 * trust;
}

// Le coach recopie une alternative sous la forme « sélection @ cote (probabilité %) » : on compare la sélection seule.
export const sameSelection = (a: string, b: string) => {
  const clean = (s: string) => s.split(" @ ")[0].trim().toLowerCase();
  const x = clean(a);
  const y = clean(b);
  return x === y || (Math.min(x.length, y.length) >= 6 && (x.includes(y) || y.includes(x)));
};

export function buildCoupon(
  results: AnalysisResult[],
  options: { profile: RiskProfile; size: number; categories: MarketCategory[]; forced?: Record<string, string> },
): Coupon {
  const { minProbability, minOdds = 1.05 } = PROFILES[options.profile];
  const candidates: (CouponLeg & { score: number })[] = [];

  for (const r of results) {
    const match = `${r.analysis.match.home} – ${r.analysis.match.away}`;
    // Pari imposé (remplacement proposé par le coach) : gardé tel quel, en tête du coupon.
    const forcedSelection = options.forced?.[match];
    const forced = forcedSelection && r.picks?.find((p) => sameSelection(p.selection, forcedSelection));
    if (forced) {
      candidates.push({ match, competition: r.analysis.match.competition, date: r.analysis.match.date, pick: forced, score: Infinity });
      continue;
    }
    const allowed = (r.picks ?? []).filter(
      (p) => options.categories.includes(p.category) && p.probability >= minProbability && p.odds >= minOdds && (options.profile !== "value" || isValueBet(p)),
    );
    if (allowed.length === 0) continue;
    const best = allowed.reduce((a, b) => (score(b, options.profile) > score(a, options.profile) ? b : a));
    candidates.push({
      match,
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
