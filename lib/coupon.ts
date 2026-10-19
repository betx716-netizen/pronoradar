// Construit un coupon combiné à partir des matchs analysés : au plus une sélection par match,
// choisie selon le profil de risque, puis classement des matchs pour garder les meilleures.
import type { AnalysisResult, MarketCategory, MarketPick } from "./schemas";
import { edge, isValueBet } from "./value";

// Tous les coupons restent fiables : chaque sélection doit être probable. Ce qui change d'un profil à l'autre,
// c'est la cote visée, atteinte en ajoutant des matchs ou en prenant des paris mieux cotés mais toujours solides.
export type RiskProfile = "x2" | "x5" | "x10" | "x20" | "x50" | "value";

export const PROFILES: Record<RiskProfile, { label: string; description: string; minProbability: number; target?: number }> = {
  x2: { label: "Objectif cote 2", description: "Sélections solides qui ont de la valeur, cote totale autour de 2", minProbability: 60, target: 2 },
  x5: { label: "Objectif cote 5", description: "Sélections solides qui ont de la valeur, cote totale autour de 5", minProbability: 56, target: 5 },
  x10: { label: "Objectif cote 10", description: "Sélections solides qui ont de la valeur, cote totale autour de 10", minProbability: 54, target: 10 },
  x20: { label: "Objectif cote 20", description: "Cote totale autour de 20 : des outsiders bien analysés plutôt qu'une pile de favoris", minProbability: 52, target: 20 },
  x50: { label: "Objectif cote 50", description: "Cote totale autour de 50 : plus de matchs, donc plus de risque global", minProbability: 50, target: 50 },
  value: { label: "Value", description: "Uniquement les paris où notre probabilité bat la cote du bookmaker (avantage ≥ 3 %), cote totale autour de 4", minProbability: 40, target: 4 },
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
  buteur: "Buteur",
};

export type CouponLeg = { match: string; competition: string; date: string | null; pick: MarketPick };

export type Coupon = {
  legs: CouponLeg[];
  totalOdds: number;
  probability: number; // % que tout le coupon passe, en supposant les matchs indépendants
  estimatedOddsCount: number; // sélections dont la cote est estimée faute de cote bookmaker
};

// Un pari retenu : assez probable, sur un marché qui n'est pas fragile, et à une cote d'au moins 1,40 :
// empiler des favoris à 1,20 n'est pas plus sûr, ça multiplie juste les risques de tout perdre.
const MIN_ODDS = 1.4;
const reliable = (p: MarketPick, minProbability: number) => p.probability >= minProbability && p.reliability !== "fragile" && p.odds >= MIN_ODDS;

// Qualité d'une sélection : d'abord sa valeur (probabilité × cote), ce qui fait remonter les outsiders sous-cotés,
// puis sa probabilité pour départager. Les cotes estimées sont un peu pénalisées. Plus le coût est bas, mieux c'est.
function cost(p: MarketPick) {
  const odds = p.oddsSource === "bookmaker" ? p.odds : 1 + (p.odds - 1) * 0.85;
  const prob = p.probability / 100;
  return -((prob * odds - 1) + 0.25 * prob);
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
  const { minProbability, target } = PROFILES[options.profile];
  const forcedLegs: CouponLeg[] = [];
  const candidates: (CouponLeg & { cost: number })[] = [];
  // Tous les paris retenus de chaque match, pour chercher la combinaison la plus courte vers la cote visée.
  const pools: { leg: Omit<CouponLeg, "pick">; picks: MarketPick[] }[] = [];

  for (const r of results) {
    const match = `${r.analysis.match.home} – ${r.analysis.match.away}`;
    const leg = { match, competition: r.analysis.match.competition, date: r.analysis.match.date };
    // Pari imposé (remplacement proposé par le coach) : gardé tel quel.
    const forcedSelection = options.forced?.[match];
    const forced = forcedSelection && r.picks?.find((p) => sameSelection(p.selection, forcedSelection));
    if (forced) {
      forcedLegs.push({ ...leg, pick: forced });
      continue;
    }
    const allowed = (r.picks ?? []).filter(
      (p) => options.categories.includes(p.category) && reliable(p, minProbability) && (options.profile !== "value" || isValueBet(p)),
    );
    if (allowed.length === 0) continue;
    pools.push({ leg, picks: allowed });
    // Value : le plus gros avantage. Sinon : le pari qui fait monter la cote au moindre risque.
    const best =
      options.profile === "value"
        ? allowed.reduce((x, y) => ((edge(y) ?? -1) > (edge(x) ?? -1) ? y : x))
        : allowed.reduce((x, y) => (cost(y) < cost(x) ? y : x));
    candidates.push({ ...leg, pick: best, cost: options.profile === "value" ? -(edge(best) ?? 0) : cost(best) });
  }

  const legs = [...forcedLegs];

  // Cote visée : on essaie 1, 2, 3… sélections et on garde la combinaison qui a le plus de chances de passer.
  // Pour k sélections, chacune doit valoir environ cible^(1/k) : on prend sur chaque match le pari le plus
  // probable à cette cote, puis les k meilleurs matchs. Peu de matchs bien cotés battent souvent une pile de favoris.
  if (target && options.profile !== "value") {
    const forcedOdds = legs.reduce((t, l) => t * l.pick.odds, 1);
    const rest = target / forcedOdds;
    let best: { legs: CouponLeg[]; prob: number } | null = null;
    for (let k = 1; k <= Math.min(options.size - legs.length, 8, pools.length); k++) {
      const per = rest ** (1 / k);
      const choice = pools
        .map(({ leg, picks }) => {
          const fit = picks.filter((p) => p.odds >= per * 0.85 && p.odds <= per * 1.6);
          const pick = fit.length ? fit.reduce((x, y) => (y.probability > x.probability ? y : x)) : null;
          return pick ? { ...leg, pick } : null;
        })
        .filter((x): x is CouponLeg => x !== null)
        .sort((x, y) => y.pick.probability - x.pick.probability)
        .slice(0, k);
      if (choice.length < k) continue;
      const odds = choice.reduce((t, l) => t * l.pick.odds, 1);
      const prob = choice.reduce((t, l) => t * (l.pick.probability / 100), 1);
      if (odds >= rest * 0.9 && (!best || prob > best.prob)) best = { legs: choice, prob };
    }
    if (best) legs.push(...best.legs);
  }

  // Sinon (ou pour Value) : on ajoute les meilleures sélections jusqu'à la cote visée, sans dépasser le maximum.
  let odds = legs.reduce((t, l) => t * l.pick.odds, 1);
  for (const c of candidates.sort((x, y) => x.cost - y.cost)) {
    if (legs.some((l) => l.match === c.match)) continue;
    if (legs.length >= options.size || (target && odds >= target * 0.92)) break;
    const { cost: _cost, ...leg } = c;
    legs.push(leg);
    odds *= leg.pick.odds;
  }

  return {
    legs,
    totalOdds: Math.round(legs.reduce((t, l) => t * l.pick.odds, 1) * 100) / 100,
    probability: Math.round(legs.reduce((t, l) => t * (l.pick.probability / 100), 1) * 1000) / 10,
    estimatedOddsCount: legs.filter((l) => l.pick.oddsSource === "estimée").length,
  };
}
