"use client";
// Scores en direct côté navigateur : interrogés toutes les 30 secondes tant que la page est visible.
import { useEffect, useState } from "react";
import type { LiveMatch } from "./espn";
import type { MarketPick } from "./schemas";

export type { LiveMatch };

export function useLiveScores(leagues: string[]) {
  const key = [...new Set(leagues)].sort().join(",");
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!key) {
      setMatches([]);
      return;
    }
    let alive = true;
    const load = () => {
      if (document.hidden) return;
      fetch(`/api/live?leagues=${encodeURIComponent(key)}`)
        .then((r) => r.json())
        .then((d: { matches: LiveMatch[] }) => {
          if (!alive) return;
          setMatches(d.matches ?? []);
          setUpdatedAt(Date.now());
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 30_000);
    document.addEventListener("visibilitychange", load);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", load);
    };
  }, [key]);

  return { matches, updatedAt };
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const NOISE = /^(fc|cf|ac|as|sc|afc|ssc|rc|cd|ud|club|sporting|real)$/;
const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !NOISE.test(w));

/** Même équipe malgré des écritures différentes (« Paris Saint Germain » / « Paris Saint-Germain »). */
export function sameTeam(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  if (x === y || (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x)))) return true;
  const wa = words(a);
  const wb = new Set(words(b));
  return wa.length > 0 && wa.filter((w) => wb.has(w)).length / Math.max(wa.length, wb.size) >= 0.5;
}

export function findLive(matches: LiveMatch[], home: string, away: string) {
  return matches.find((m) => sameTeam(m.home, home) && sameTeam(m.away, away)) ?? null;
}

export type LegState = "won" | "lost" | "push" | "pending" | "unknown";

/**
 * État d'un pari d'après le score : gagné, perdu, remboursé, en attente (match pas fini et pas encore tranché)
 * ou inconnu (marché que le score ne permet pas de vérifier : corners, cartons…).
 */
export function legState(pick: MarketPick, home: string, away: string, m: LiveMatch | null): LegState {
  if (!m || m.homeScore == null || m.awayScore == null) return m ? "pending" : "unknown";
  const h = m.homeScore;
  const a = m.awayScore;
  const final = m.state === "post";
  const sel = pick.selection.toLowerCase();
  const isHome = (t: string) => sameTeam(t, home);
  const isAway = (t: string) => sameTeam(t, away);
  const decide = (ok: boolean) => (final ? (ok ? "won" : "lost") : "pending");

  switch (pick.category) {
    case "resultat": {
      if (/nul/.test(sel)) return decide(h === a);
      const team = pick.selection.replace(/^victoire\s+/i, "");
      if (isHome(team)) return decide(h > a);
      if (isAway(team)) return decide(a > h);
      return "unknown";
    }
    case "double_chance": {
      const [x, y] = pick.selection.split(/\s+ou\s+/i);
      const ok = (t: string) => (/^nul$/i.test(t.trim()) ? h === a : isHome(t) ? h > a : isAway(t) ? a > h : null);
      const r1 = ok(x ?? "");
      const r2 = ok(y ?? "");
      if (r1 === null || r2 === null) return "unknown";
      return decide(r1 || r2);
    }
    case "rembourse": {
      const team = pick.selection.replace(/\s*\(rembours.*$/i, "");
      if (final && h === a) return "push";
      if (isHome(team)) return decide(h > a);
      if (isAway(team)) return decide(a > h);
      return "unknown";
    }
    case "buts": {
      const n = Number(sel.match(/(\d+[,.]\d)/)?.[1]?.replace(",", "."));
      if (!Number.isFinite(n)) return "unknown";
      const total = h + a;
      if (/plus/.test(sel)) return total > n ? "won" : decide(false);
      if (/moins/.test(sel)) return total > n ? "lost" : decide(true);
      return "unknown";
    }
    case "les_deux_marquent": {
      const both = h > 0 && a > 0;
      if (/non/.test(sel)) return both ? "lost" : decide(true);
      return both ? "won" : decide(false);
    }
    default:
      return "unknown";
  }
}
