// Historique des coupons joués, gardé dans le navigateur (propre à chaque appareil).
import type { CouponLeg } from "./coupon";

export type BetStatus = "en_cours" | "gagne" | "perdu" | "rembourse";

export type SavedBet = {
  id: string;
  createdAt: string;
  profile: string;
  legs: CouponLeg[];
  totalOdds: number;
  probability: number;
  stake: number;
  status: BetStatus;
};

const KEY = "pronoradar.history.v1";

export function loadHistory(): SavedBet[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as SavedBet[];
  } catch {
    return [];
  }
}

export function saveHistory(bets: SavedBet[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(bets));
    window.dispatchEvent(new Event("pronoradar-history"));
  } catch {}
}

export function addBet(bet: Omit<SavedBet, "id" | "createdAt" | "status">) {
  saveHistory([{ ...bet, id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: "en_cours" }, ...loadHistory()]);
}

/** Gain net d'un pari terminé (0 s'il est en cours ou remboursé). */
export function profit(b: SavedBet) {
  if (b.status === "gagne") return b.stake * (b.totalOdds - 1);
  if (b.status === "perdu") return -b.stake;
  return 0;
}
