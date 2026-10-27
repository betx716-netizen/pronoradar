// Règlement d'un pari d'après le score final, utilisé en direct (navigateur) et pour le bilan public (serveur).
import type { LiveMatch } from "./espn";
import type { MarketPick } from "./schemas";

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
      const r = resultOf(pick.selection, h, a, isHome, isAway);
      return r === null ? "unknown" : decide(r);
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
    case "buts_equipe": {
      // « Benfica plus de 1,5 buts »
      const m2 = pick.selection.match(/^(.*?)\s+(plus|moins)\s+de\s+(\d+[,.]\d)/i);
      if (!m2) return "unknown";
      const goals = isHome(m2[1]) ? h : isAway(m2[1]) ? a : null;
      if (goals == null) return "unknown";
      const n = Number(m2[3].replace(",", "."));
      return /plus/i.test(m2[2]) ? (goals > n ? "won" : decide(false)) : goals > n ? "lost" : decide(true);
    }
    case "score_exact": {
      const sc = pick.selection.match(/(\d+)\s*[-–:]\s*(\d+)/);
      if (!sc) return "unknown";
      return decide(h === Number(sc[1]) && a === Number(sc[2]));
    }
    case "resultat_buts":
    case "resultat_btts": {
      // « Victoire de l'AS Roma + Moins de 3,5 buts », « PSG et Oui »
      const parts = pick.selection.split(/\s+(?:\+|et)\s+/i);
      if (parts.length < 2) return "unknown";
      const second = parts.pop() ?? "";
      const res = resultOf(parts.join(" et "), h, a, isHome, isAway);
      if (res === null) return "unknown";
      let other: boolean | null = null;
      const s2 = second.toLowerCase();
      if (pick.category === "resultat_btts" || /oui|non|marquent/.test(s2)) other = /non/.test(s2) ? !(h > 0 && a > 0) : h > 0 && a > 0;
      else {
        const n = Number(s2.match(/(\d+[,.]\d)/)?.[1]?.replace(",", "."));
        if (Number.isFinite(n)) other = /plus/.test(s2) ? h + a > n : /moins/.test(s2) ? h + a < n : null;
      }
      if (other === null) return "unknown";
      return decide(res && other);
    }
    case "sans_encaisser": {
      // « PSG ne prend pas de but », « Victoire de PSG sans encaisser »
      const win = /victoire|gagne/i.test(sel);
      const side = teamIn(pick.selection, isHome, isAway);
      if (!side) return "unknown";
      const conceded = side === "home" ? a : h;
      const won = side === "home" ? h > a : a > h;
      if (conceded > 0) return "lost";
      return decide(!win || won);
    }
    case "ecart": {
      // « PSG gagne par 2 buts d'écart ou plus »
      const side = teamIn(pick.selection, isHome, isAway);
      const n = Number(sel.match(/(\d+)\s*buts?/)?.[1]);
      if (!side || !Number.isFinite(n)) return "unknown";
      const diff = side === "home" ? h - a : a - h;
      return decide(/moins|au plus/.test(sel) ? diff > 0 && diff <= n : diff >= n);
    }
    case "pair_impair":
      if (/impair/.test(sel)) return decide((h + a) % 2 === 1);
      if (/pair/.test(sel)) return decide((h + a) % 2 === 0);
      return "unknown";
    case "mi_temps": {
      // Résultat à la mi-temps : « Mi-temps : PSG », « Nul à la mi-temps »
      if (!m.homeHalves || !m.awayHalves) return final ? "unknown" : "pending";
      const t = pick.selection.replace(/^(r[ée]sultat\s+[àa]\s+la\s+)?mi-temps\s*:?\s*/i, "").replace(/\s*[àa]\s+la\s+mi-temps$/i, "");
      const r = resultOf(t, m.homeHalves[0], m.awayHalves[0], isHome, isAway);
      return r === null ? "unknown" : decide(r);
    }
    case "buts_1re_mt":
    case "mi_temps_prolifique":
    case "marque_deux_mt":
    case "gagne_une_mt": {
      const hh = m.homeHalves;
      const ah = m.awayHalves;
      if (!final) return "pending";
      if (!hh || !ah) return "unknown";
      const first = hh[0] + ah[0];
      const second = hh[1] + ah[1];
      if (pick.category === "buts_1re_mt") {
        const n = Number(sel.match(/(\d+[,.]\d)/)?.[1]?.replace(",", "."));
        if (!Number.isFinite(n)) return "unknown";
        return decide(/moins/.test(sel) ? first < n : first > n);
      }
      if (pick.category === "mi_temps_prolifique") {
        if (/autant|égalité|egalite|nul/.test(sel)) return decide(first === second);
        if (/1re|1ère|premi/.test(sel)) return decide(first > second);
        if (/2e|2ème|second|deuxi/.test(sel)) return decide(second > first);
        return "unknown";
      }
      const side = teamIn(pick.selection, isHome, isAway);
      if (!side) return "unknown";
      const mine = side === "home" ? hh : ah;
      const theirs = side === "home" ? ah : hh;
      if (pick.category === "marque_deux_mt") return decide(mine[0] > 0 && mine[1] > 0);
      return decide(mine[0] > theirs[0] || mine[1] > theirs[1]);
    }
    default:
      return "unknown";
  }
}

// Équipe nommée au début d'un pari (« PSG ne prend pas de but », « Victoire de Lyon sans encaisser »).
function teamIn(selection: string, isHome: (t: string) => boolean, isAway: (t: string) => boolean): "home" | "away" | null {
  const t = selection
    .replace(/^(victoire\s+(de\s+l'|de\s+la\s+|du\s+|des\s+|de\s+|d')?)/i, "")
    .split(/\s+(ne|gagne|marque|sans|par|avec|plus|moins|remporte)\b/i)[0]
    .trim();
  return isHome(t) ? "home" : isAway(t) ? "away" : null;
}

// Résultat demandé (« Victoire de l'AS Roma », « Nul », « PSG ») : vrai s'il est réalisé, null si illisible.
function resultOf(text: string, h: number, a: number, isHome: (t: string) => boolean, isAway: (t: string) => boolean): boolean | null {
  const t = text.replace(/^(victoire\s+(de\s+l'|de\s+la\s+|du\s+|des\s+|de\s+|d')?)/i, "").trim();
  if (/^(match\s+)?nul$/i.test(t)) return h === a;
  if (isHome(t)) return h > a;
  if (isAway(t)) return a > h;
  return null;
}
