// Ce que l'application envoie au navigateur pour la journée, selon l'offre du visiteur :
// le contenu Premium est retiré côté serveur, il n'est jamais envoyé à un compte gratuit.
import type { AiProfile } from "./aiCoupons";
import { CATEGORY_LABELS } from "./coupon";
import type { DailyCoupon } from "./dailyCoupons";
import type { DayData, DayMatch, MatchStatus, RunStatus } from "./daily";
import { FREE_COUPONS, FREE_MATCH_TIPS } from "./plans";
import type { AnalysisResult, MarketPick, OddsSummary, Sport } from "./schemas";

export type Tip = {
  selection: string;
  market: string;
  probability: number;
  odds: number;
  estimated: boolean;
  confidence: "faible" | "moyenne" | "élevée";
  score: string | null;
};

export type MatchCard = {
  id: string;
  sport: Sport;
  competition: string;
  home: string;
  away: string;
  date: string;
  time: string | null;
  status: MatchStatus;
  odds: OddsSummary | null;
  locked: boolean;
  tip: Tip | null;
  probs: { home: number; draw: number; away: number } | null;
  picks: MarketPick[]; // Premium : tous les paris proposés, pour composer son propre combiné
  picksCount: number;
};

export type CouponCard =
  | (DailyCoupon & { locked: false })
  | { locked: true; profile: AiProfile; title: string; subtitle: string; totalOdds: number; legsCount: number; probability: number };

export type TodayView = {
  day: string;
  status: RunStatus | "none";
  progress: { done: number; total: number };
  coupons: CouponCard[];
  matches: MatchCard[];
  viewer: { signedIn: boolean; email: string | null; premium: boolean; premiumUntil: string | null };
};

/** Le pari phare d'un match : le plus intéressant parmi les paris fiables et probables. */
export function mainTip(r: AnalysisResult): Tip | null {
  const picks = (r.picks ?? []).filter((p) => p.reliability !== "fragile" && p.category !== "score_exact");
  if (!picks.length) return null;
  const solid = picks.filter((p) => p.probability >= 55 && p.odds >= 1.3);
  const best = (solid.length ? solid : picks).reduce((x, y) =>
    solid.length ? (y.probability * y.odds + y.probability / 200 > x.probability * x.odds + x.probability / 200 ? y : x) : y.probability > x.probability ? y : x,
  );
  const ai = r.analysis.ai_analysis;
  return {
    selection: best.selection,
    market: CATEGORY_LABELS[best.category],
    probability: Math.round(best.probability),
    odds: best.odds,
    estimated: best.oddsSource === "estimée",
    confidence: ai.confidence,
    score: ai.score_prediction || null,
  };
}

function matchCard(m: DayMatch, open: boolean, premium: boolean): MatchCard {
  const f = m.fixture;
  const r = m.result;
  const ai = r?.analysis.ai_analysis;
  return {
    id: m.id,
    sport: f.sport,
    competition: f.competition,
    home: f.home,
    away: f.away,
    date: f.date,
    time: f.time,
    status: m.status,
    odds: f.odds ?? null,
    locked: m.status === "done" && !open,
    tip: open && r ? mainTip(r) : null,
    probs: open && ai ? { home: Math.round(ai.prob_home), draw: Math.round(ai.prob_draw), away: Math.round(ai.prob_away) } : null,
    picks: premium && r ? r.picks ?? [] : [],
    picksCount: r?.picks?.length ?? 0,
  };
}

export function buildView(d: DayData, viewer: TodayView["viewer"]): TodayView {
  const premium = viewer.premium;
  // Matchs gratuits : les premiers matchs analysés, dans l'ordre de la journée.
  const freeIds = new Set(d.matches.filter((m) => m.status === "done").slice(0, FREE_MATCH_TIPS).map((m) => m.id));
  const coupons: CouponCard[] = d.coupons.map((c) =>
    premium || (FREE_COUPONS as readonly string[]).includes(c.profile)
      ? { ...c, locked: false as const }
      : { locked: true as const, profile: c.profile, title: c.title, subtitle: c.subtitle, totalOdds: c.totalOdds, legsCount: c.legs.length, probability: c.probability },
  );
  return {
    day: d.day,
    status: d.status,
    progress: { done: d.matches.filter((m) => m.status === "done" || m.status === "error").length, total: d.matches.length },
    coupons,
    matches: d.matches.map((m) => matchCard(m, premium || freeIds.has(m.id), premium)),
    viewer,
  };
}

/** Un visiteur gratuit peut ouvrir l'analyse détaillée des matchs offerts. */
export function canOpenMatch(d: DayData, id: string, premium: boolean) {
  if (premium) return true;
  return d.matches.filter((m) => m.status === "done").slice(0, FREE_MATCH_TIPS).some((m) => m.id === id);
}
