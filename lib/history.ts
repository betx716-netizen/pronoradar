// Historique des coupons joués : copie locale pour un affichage immédiat, synchronisée avec Supabase
// (via /api/history) pour le retrouver sur tous les appareils. Sans Supabase, seule la copie locale existe.
import { getPassword } from "./client";
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

export type SyncState = "local" | "synced" | "error";

const KEY = "pronoradar.history.v1";
const isBet = (b: unknown): b is SavedBet => Array.isArray((b as SavedBet)?.legs) && typeof (b as SavedBet).id === "string";

export function loadHistory(): SavedBet[] {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown[]).filter(isBet);
  } catch {
    return [];
  }
}

function storeLocal(bets: SavedBet[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(bets));
    window.dispatchEvent(new Event("pronoradar-history"));
  } catch {}
}

const api = (init?: RequestInit, query = "") =>
  fetch(`/api/history${query}`, {
    ...init,
    headers: { "Content-Type": "application/json", "x-app-password": getPassword() },
  });

const pushRemote = (bets: SavedBet[]) => api({ method: "POST", body: JSON.stringify({ bets }) }).catch(() => null);

/** Récupère l'historique Supabase, y envoie les coupons qui n'existaient que sur cet appareil, et fusionne. */
export async function syncHistory(): Promise<SyncState> {
  try {
    const res = await api();
    if (res.status === 503) return "local";
    if (!res.ok) return "error";
    const remote = ((await res.json()).bets as unknown[]).filter(isBet);
    const remoteIds = new Set(remote.map((b) => b.id));
    const localOnly = loadHistory().filter((b) => !remoteIds.has(b.id));
    if (localOnly.length) await pushRemote(localOnly);
    storeLocal([...localOnly, ...remote].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    return "synced";
  } catch {
    return "error";
  }
}

export function addBet(bet: Omit<SavedBet, "id" | "createdAt" | "status">) {
  const full: SavedBet = { ...bet, id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: "en_cours" };
  storeLocal([full, ...loadHistory()]);
  pushRemote([full]);
}

export function updateBet(id: string, changes: Partial<SavedBet>) {
  const bets = loadHistory().map((b) => (b.id === id ? { ...b, ...changes } : b));
  storeLocal(bets);
  const changed = bets.find((b) => b.id === id);
  if (changed) pushRemote([changed]);
}

export function removeBet(id: string) {
  storeLocal(loadHistory().filter((b) => b.id !== id));
  api({ method: "DELETE" }, `?id=${encodeURIComponent(id)}`).catch(() => null);
}

/** Gain net d'un pari terminé (0 s'il est en cours ou remboursé). */
export function profit(b: SavedBet) {
  if (b.status === "gagne") return b.stake * (b.totalOdds - 1);
  if (b.status === "perdu") return -b.stake;
  return 0;
}
