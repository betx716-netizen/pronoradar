// Bilan public des coupons du jour de l'IA : chaque coupon publié est réglé d'après les scores finaux (ESPN),
// puis gardé dans la table coupon_record. Rien n'est retiré : les coupons perdus restent affichés.
import type { DailyCoupon } from "./dailyCoupons";
import { SLUGS, parseScoreboard, scoreboardUrl, type LiveMatch } from "./espn";
import { findLive, legState, sameTeam, type LegState } from "./settle";
import { db, supabaseConfigured } from "./supabase";

export type RecordStatus = "won" | "lost" | "void" | "pending" | "unverifiable";
export type RecordLeg = { match: string; competition: string; selection: string; odds: number; state: LegState; score: string | null };
export type CouponRecord = { day: string; profile: string; title: string; total_odds: number; status: RecordStatus; legs: RecordLeg[] };

const parisDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
// Début du bilan : remis à zéro le 27 octobre 2026, il compte les coupons publiés à partir du lendemain.
export const RECORD_START = "2026-10-28";
const FINAL: RecordStatus[] = ["won", "lost", "void", "unverifiable"];

/** État d'un coupon d'après ses sélections : une seule perdue suffit à le perdre. */
export function couponStatus(states: LegState[]): RecordStatus {
  if (states.includes("lost")) return "lost";
  if (states.includes("pending")) return "pending";
  if (states.includes("unknown")) return "unverifiable";
  return states.every((s) => s === "push") ? "void" : "won";
}

// Scores d'un championnat pour un jour, gardés pendant le calcul (plusieurs sélections partagent un match).
function scoresLoader() {
  const cache = new Map<string, Promise<LiveMatch[]>>();
  return (competition: string, day: string) => {
    const slug = SLUGS[competition];
    if (!slug) return Promise.resolve([] as LiveMatch[]);
    const key = `${slug}|${day}`;
    if (!cache.has(key)) {
      cache.set(
        key,
        fetch(scoreboardUrl(slug, day.replace(/-/g, "")), { next: { revalidate: 600 }, signal: AbortSignal.timeout(6000) })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => (d ? parseScoreboard(d, slug) : []))
          .catch(() => []),
      );
    }
    return cache.get(key)!;
  };
}

// Statistiques d'un match terminé (corners, tirs cadrés, cartons, fautes, hors-jeu), par équipe, d'après ESPN.
type MatchStats = { home: Record<string, number>; away: Record<string, number> };
const STAT_KEYS: Record<string, RegExp> = {
  corners: /corner/i,
  tirs_cadres: /shotsontarget|on target|on goal/i,
  yellow: /yellow/i,
  red: /redcard|red card/i,
  fautes: /foul/i,
  hors_jeu: /offside/i,
};
function statsLoader() {
  const cache = new Map<string, Promise<MatchStats | null>>();
  return (m: LiveMatch) => {
    if (!cache.has(m.id)) {
      cache.set(
        m.id,
        fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${m.slug}/summary?event=${m.id}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000) })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            const teams: { homeAway?: string; statistics?: { name?: string; label?: string; displayValue?: string }[] }[] = d?.boxscore?.teams ?? [];
            if (teams.length < 2) return null;
            const read = (t: (typeof teams)[number]) => {
              const out: Record<string, number> = {};
              for (const [key, re] of Object.entries(STAT_KEYS)) {
                const st = (t.statistics ?? []).find((x) => re.test(`${x.name ?? ""} ${x.label ?? ""}`) && !/total ?shots|shots$/i.test(x.name ?? ""));
                const v = Number(st?.displayValue);
                if (Number.isFinite(v)) out[key] = v;
              }
              return out;
            };
            const home = teams.find((t) => t.homeAway === "home") ?? teams[0];
            const away = teams.find((t) => t.homeAway === "away") ?? teams[1];
            return { home: read(home), away: read(away) };
          })
          .catch(() => null),
      );
    }
    return cache.get(m.id)!;
  };
}

/** Pari sur une statistique (« Plus de 9,5 corners », « PSG plus de 4,5 tirs cadrés »), réglé avec les chiffres du match. */
export function settleStat(category: string, selection: string, home: string, away: string, st: MatchStats): LegState {
  const keyOf: Record<string, (x: Record<string, number>) => number | undefined> = {
    corners: (x) => x.corners,
    tirs_cadres: (x) => x.tirs_cadres,
    fautes: (x) => x.fautes,
    hors_jeu: (x) => x.hors_jeu,
    // Cartons : un rouge compte comme un carton (règle la plus courante chez les bookmakers).
    cartons: (x) => (x.yellow == null ? undefined : x.yellow + (x.red ?? 0)),
  };
  const get = keyOf[category];
  const m = selection.match(/(plus|moins)\s+de\s+(\d+[,.]\d)/i);
  if (!get || !m) return "unknown";
  const before = selection.slice(0, m.index).trim();
  const team = before && sameTeam(before, home) ? "home" : before && sameTeam(before, away) ? "away" : null;
  const h = get(st.home);
  const a = get(st.away);
  const value = team === "home" ? h : team === "away" ? a : h == null || a == null ? undefined : h + a;
  if (value == null) return "unknown";
  const n = Number(m[2].replace(",", "."));
  return /plus/i.test(m[1]) === value > n ? "won" : "lost";
}

async function settleCoupon(
  day: string,
  c: DailyCoupon,
  scores: ReturnType<typeof scoresLoader>,
  stats: ReturnType<typeof statsLoader>,
): Promise<CouponRecord> {
  const legs: RecordLeg[] = await Promise.all(
    c.legs.map(async (l) => {
      const [home = "", away = ""] = l.match.split(/\s+[–-]\s+/);
      const date = l.date?.slice(0, 10) || day;
      const live = findLive(await scores(l.competition, date), home, away);
      let state = legState(l.pick, home, away, live);
      if (state === "unknown" && live?.state === "post" && ["corners", "tirs_cadres", "cartons", "fautes", "hors_jeu"].includes(l.pick.category)) {
        const st = await stats(live);
        if (st) state = settleStat(l.pick.category, l.pick.selection, home, away, st);
      }
      // Match introuvable plus de deux jours après : on ne pourra pas le vérifier.
      if (state === "unknown" && !live && Date.now() - new Date(`${date}T23:59:00Z`).getTime() < 2 * 86400000) state = "pending";
      const score = live && live.homeScore != null && live.awayScore != null && live.state === "post" ? `${live.homeScore}-${live.awayScore}` : null;
      return { match: l.match, competition: l.competition, selection: l.pick.selection, odds: l.pick.odds, state, score };
    }),
  );
  const status = couponStatus(legs.map((l) => l.state));
  // Sélection remboursée : sa cote sort du calcul, comme chez les bookmakers.
  const odds = status === "won" ? Math.round(legs.filter((l) => l.state === "won").reduce((p, l) => p * l.odds, 1) * 100) / 100 : c.totalOdds;
  return { day, profile: c.profile, title: c.title, total_odds: odds, status, legs };
}

/** Règle les coupons pas encore tranchés des derniers jours, puis renvoie tout le bilan (du plus récent au plus ancien). */
export async function loadRecord(days = 60): Promise<CouponRecord[]> {
  if (!supabaseConfigured()) return [];
  const from = parisDay(new Date(Date.now() - days * 86400000));
  const since = from > RECORD_START ? from : RECORD_START;
  const [{ data: runs }, { data: saved }] = await Promise.all([
    db().from("daily_runs").select("day, coupons").eq("status", "ready").gte("day", since).order("day", { ascending: false }),
    db().from("coupon_record").select("day, profile, title, total_odds, status, legs").gte("day", since),
  ]);
  const done = new Map((saved ?? []).map((r) => [`${r.day}|${r.profile}`, r as CouponRecord]));
  const scores = scoresLoader();
  const stats = statsLoader();
  const out: CouponRecord[] = [];
  const updates: (CouponRecord & { settled_at: string | null; updated_at: string })[] = [];
  for (const run of runs ?? []) {
    for (const c of (run.coupons ?? []) as DailyCoupon[]) {
      if (!c?.legs?.length) continue;
      const prev = done.get(`${run.day}|${c.profile}`);
      if (prev && FINAL.includes(prev.status)) {
        out.push(prev);
        continue;
      }
      const rec = await settleCoupon(run.day, c, scores, stats);
      out.push(rec);
      const now = new Date().toISOString();
      updates.push({ ...rec, settled_at: FINAL.includes(rec.status) ? now : null, updated_at: now });
    }
  }
  if (updates.length) await db().from("coupon_record").upsert(updates, { onConflict: "day,profile" });
  return out;
}

export type ProfileStats = { profile: string; title: string; played: number; won: number; lost: number; voided: number; profit: number; staked: number };

/** Statistiques par type de coupon, pour une mise fixe par coupon (en FCFA). */
export function recordStats(records: CouponRecord[], stake = 1000) {
  const by = new Map<string, ProfileStats>();
  for (const r of records) {
    if (!["won", "lost", "void"].includes(r.status)) continue;
    const s = by.get(r.profile) ?? { profile: r.profile, title: r.title, played: 0, won: 0, lost: 0, voided: 0, profit: 0, staked: 0 };
    s.played++;
    s.staked += stake;
    if (r.status === "won") {
      s.won++;
      s.profit += Math.round(stake * (Number(r.total_odds) - 1));
    } else if (r.status === "lost") {
      s.lost++;
      s.profit -= stake;
    } else s.voided++;
    by.set(r.profile, s);
  }
  const list = [...by.values()];
  const total = list.reduce(
    (t, s) => ({ ...t, played: t.played + s.played, won: t.won + s.won, lost: t.lost + s.lost, voided: t.voided + s.voided, profit: t.profit + s.profit, staked: t.staked + s.staked }),
    { profile: "all", title: "Tous les coupons", played: 0, won: 0, lost: 0, voided: 0, profit: 0, staked: 0 } as ProfileStats,
  );
  return { list, total };
}
