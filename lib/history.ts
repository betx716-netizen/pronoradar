// Historique des coupons joués : copie locale pour un affichage immédiat, synchronisée avec Supabase
// (via /api/history) sur le compte de l'utilisateur. Sans compte connecté, seule la copie locale existe.
import { authFetch } from "./client";
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
// Coupons supprimés (à effacer aussi en ligne) et coupons déjà vus en ligne : sans ça, un coupon supprimé
// revenait à la synchronisation suivante, renvoyé par cet appareil ou par un autre qui en gardait une copie.
const DELETED_KEY = "pronoradar.history.deleted.v1";
const SYNCED_KEY = "pronoradar.history.synced.v1";
const readIds = (key: string) => {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? "[]") as string[]);
  } catch {
    return new Set<string>();
  }
};
const writeIds = (key: string, ids: Set<string>) => {
  try {
    localStorage.setItem(key, JSON.stringify([...ids].slice(-2000)));
  } catch {}
};

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
  authFetch(`/api/history${query}`, { ...init, headers: { "Content-Type": "application/json" } });

const pushRemote = (bets: SavedBet[]) => api({ method: "POST", body: JSON.stringify({ bets }) }).catch(() => null);

/** Récupère l'historique Supabase, y envoie les coupons qui n'existaient que sur cet appareil, et fusionne. */
export async function syncHistory(): Promise<SyncState> {
  try {
    const res = await api();
    if (res.status === 401 || res.status === 503) return "local";
    if (!res.ok) return "error";
    const deleted = readIds(DELETED_KEY);
    // Supprimés sur cet appareil mais encore en ligne (suppression précédente échouée) : on réessaie.
    const pending = ((await res.json()).bets as unknown[]).filter(isBet);
    const stillDeleted = new Set<string>();
    for (const b of pending.filter((b) => deleted.has(b.id))) {
      const r = await api({ method: "DELETE" }, `?id=${encodeURIComponent(b.id)}`).catch(() => null);
      if (!r?.ok) stillDeleted.add(b.id);
    }
    writeIds(DELETED_KEY, stillDeleted);
    const remote = pending.filter((b) => !deleted.has(b.id));
    const remoteIds = new Set(remote.map((b) => b.id));
    const synced = readIds(SYNCED_KEY);
    // Un coupon déjà vu en ligne et qui n'y est plus a été supprimé depuis un autre appareil : on ne le renvoie pas.
    const localOnly = loadHistory().filter((b) => !remoteIds.has(b.id) && !synced.has(b.id) && !deleted.has(b.id));
    const pushed = localOnly.length ? Boolean((await pushRemote(localOnly))?.ok) : true;
    writeIds(SYNCED_KEY, new Set([...remoteIds, ...(pushed ? localOnly.map((b) => b.id) : [])]));
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
  removeBets([id]);
}

/** Supprime des coupons ici et en ligne ; en cas d'échec réseau, la suppression est retentée à la synchronisation. */
export function removeBets(ids: string[]) {
  const gone = new Set(ids);
  storeLocal(loadHistory().filter((b) => !gone.has(b.id)));
  const deleted = readIds(DELETED_KEY);
  ids.forEach((id) => deleted.add(id));
  writeIds(DELETED_KEY, deleted);
  for (const id of ids)
    api({ method: "DELETE" }, `?id=${encodeURIComponent(id)}`)
      .then((r) => {
        if (!r.ok) return;
        const d = readIds(DELETED_KEY);
        d.delete(id);
        writeIds(DELETED_KEY, d);
      })
      .catch(() => null);
}

/** Gain net d'un pari terminé (0 s'il est en cours ou remboursé). */
export function profit(b: SavedBet) {
  if (b.status === "gagne") return b.stake * (b.totalOdds - 1);
  if (b.status === "perdu") return -b.stake;
  return 0;
}
