// Moteur quotidien : chaque jour, le serveur trouve les matchs du jour, les analyse un par un et compose
// les coupons. Tout est enregistré dans Supabase et servi à tous les utilisateurs : le coût des API ne dépend
// pas du nombre d'abonnés.
//
// Déroulé : le cron Vercel (une fois par jour) appelle /api/cron/daily, qui travaille quelques minutes puis
// se relance lui-même tant qu'il reste des matchs. Si la chaîne s'interrompt, la première visite qui trouve
// un travail arrêté depuis plus de 3 minutes la relance.
import { matchPriority } from "./priority";
import { analyzeMatch } from "./analyze";
import { composeDailyCoupons, computedCoupons, type DailyCoupon, type DayResult } from "./dailyCoupons";
import { demoAnalysis, demoFixtures } from "./demo";
import { espnCovers, fetchWeekFixtures, sameTeam } from "./espn";
import { findFixtures } from "./fixtures";
import { isDemo } from "./http";
import { fixtureId } from "./jobs";
import { LEAGUES, findLeague } from "./leagues";
import type { AnalysisMode, AnalysisResult, Fixture, Sport } from "./schemas";
import { db } from "./supabase";

export type DayFixture = Fixture & { sport: Sport };
export type RunStatus = "planning" | "analyzing" | "composing" | "ready" | "failed";
export type MatchStatus = "pending" | "running" | "done" | "error";

export type DayMatch = { id: string; position: number; status: MatchStatus; fixture: DayFixture; result: AnalysisResult | null };
export type DayData = {
  day: string;
  status: RunStatus | "none";
  heartbeat: string | null;
  readyAt: string | null;
  coupons: DailyCoupon[];
  matches: DayMatch[];
};

// Tous les championnats de football, dans l'ordre de priorité : quand il y a plus de matchs que la limite
// du jour, les premiers de la liste passent devant (coupes d'Europe, grands championnats, puis les autres).
const DEFAULT_LEAGUES = LEAGUES.football.map((l) => l.name);
const MAX_MATCHES = Number(process.env.DAILY_MAX_MATCHES) || 20;
const CONCURRENCY = Number(process.env.DAILY_CONCURRENCY) || 3;
const MODE: AnalysisMode = process.env.DAILY_MODE === "rapide" ? "rapide" : "complete";
const STALE_MINUTES = 8;
const MAX_ATTEMPTS = 2;
const TAKEOVER_MS = 10 * 60_000;

/** Championnats suivis chaque jour : DAILY_LEAGUES (noms séparés par des virgules) ou la liste par défaut. */
export function dailyLeagues(): { sport: Sport; name: string }[] {
  const names = (process.env.DAILY_LEAGUES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return (names.length ? names : DEFAULT_LEAGUES).flatMap((name) => {
    const sport = (Object.keys(LEAGUES) as Sport[]).find((s) => findLeague(s, name));
    return sport ? [{ sport, name }] : [];
  });
}

/** Jour en cours, heure de Paris (celle des programmes des championnats), au format AAAA-MM-JJ. */
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

// ---------------------------------------------------------------------------------------------------------
// Planification : trouver les matchs du jour.

async function findDayFixtures(day: string, log: (m: string) => void) {
  const notes: string[] = [];
  const found: DayFixture[] = [];
  const leagues = dailyLeagues();
  // Programme gratuit du jour (ESPN, tous championnats, avec cotes DraftKings) : sert de base et de tri.
  // On n'interroge les cotes payantes que pour les championnats qui jouent (en cas d'erreur ESPN, on interroge tout).
  const espnDay = await fetchWeekFixtures()
    .then((all) => all.filter((f) => f.date === day))
    .catch(() => [] as Fixture[]);
  const playing = leagues.filter(
    ({ sport, name }) => sport !== "football" || !espnCovers(name) || espnDay.length === 0 || espnDay.some((f) => f.competition === name),
  );
  log(`${playing.length} championnat(s) sur ${leagues.length} jouent aujourd'hui`);
  for (const { sport, name } of playing) {
    const free = espnDay.filter((f) => f.competition === name);
    let ofDay: Fixture[] = [];
    try {
      const r = await findFixtures(sport, name, () => {});
      notes.push(...r.notes.map((n) => `${name} : ${n}`));
      ofDay = r.fixtures.filter((f) => f.date === day);
    } catch (e) {
      notes.push(`${name} : ${e instanceof Error ? e.message : String(e)}`);
    }
    // Matchs absents de la source payante (championnat non couvert, quota épuisé…) : repris du programme gratuit.
    const extra = free.filter((e) => !ofDay.some((f) => sameTeam(f.home, e.home) && sameTeam(f.away, e.away)));
    const merged = [...ofDay, ...extra].sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
    found.push(...merged.map((f) => ({ ...f, sport })));
    log(`${name} : ${merged.length} match(s) aujourd'hui`);
  }
  // Tous les matchs du jour sont classés par importance : niveau de la compétition, grandes équipes,
  // puis présence de cotes. À égalité, l'ordre de la liste des championnats.
  const ranked = found
    .map((f, i) => ({ f, i, p: matchPriority(f) }))
    .sort((a, b) => b.p - a.p || a.i - b.i);
  return { fixtures: ranked.slice(0, MAX_MATCHES).map((x) => x.f), notes };
}

async function plan(day: string, log: (m: string) => void) {
  const { fixtures, notes } = await findDayFixtures(day, log);
  if (fixtures.length) {
    const rows = fixtures.map((f, position) => ({ id: `${day}|${fixtureId(f)}`, day, position, fixture: f }));
    const { error } = await db().from("daily_matches").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  await db()
    .from("daily_runs")
    .update({ status: fixtures.length ? "analyzing" : "ready", coupons: fixtures.length ? null : [], notes, heartbeat: new Date().toISOString(), ready_at: fixtures.length ? null : new Date().toISOString() })
    .eq("day", day);
  log(`${fixtures.length} match(s) à analyser`);
}

const staleBefore = (ms: number) => new Date(Date.now() - ms).toISOString();
// Les horodatages de Postgres et de JavaScript n'ont pas le même format : on compare des nombres.
const olderThan = (ts: string | null | undefined, ms: number) => !ts || Date.parse(ts) < Date.now() - ms;

/** Crée la journée si besoin (un seul serveur la planifie) et reprend une planification abandonnée. */
async function ensureRun(day: string, log: (m: string) => void) {
  const { data: created } = await db()
    .from("daily_runs")
    .upsert({ day, status: "planning" }, { onConflict: "day", ignoreDuplicates: true })
    .select()
    .maybeSingle();
  if (created) {
    await plan(day, log);
  } else {
    const { data: run } = await db().from("daily_runs").select("status, heartbeat").eq("day", day).single();
    if (run?.status === "planning" && olderThan(run.heartbeat, TAKEOVER_MS)) {
      const { data: mine } = await db()
        .from("daily_runs")
        .update({ heartbeat: new Date().toISOString() })
        .eq("day", day)
        .eq("status", "planning")
        .lt("heartbeat", staleBefore(TAKEOVER_MS))
        .select()
        .maybeSingle();
      if (mine) await plan(day, log);
    }
  }
  const { data } = await db().from("daily_runs").select("*").eq("day", day).single();
  return data as { status: RunStatus; heartbeat: string };
}

// ---------------------------------------------------------------------------------------------------------
// Analyse des matchs.

const touch = (day: string) => db().from("daily_runs").update({ heartbeat: new Date().toISOString() }).eq("day", day);

async function analyzeRow(day: string, row: { id: string; attempts: number; fixture: DayFixture }, log: (m: string) => void) {
  const f = row.fixture;
  log(`Analyse : ${f.home} – ${f.away}`);
  try {
    const result = await analyzeMatch(
      { sport: f.sport, mode: MODE, home: f.home, away: f.away, competition: f.competition, date: f.date, odds: f.odds ?? null, apiFootballId: f.apiFootballId ?? null },
      () => {},
    );
    await db().from("daily_matches").update({ status: "done", result, error: null, updated_at: new Date().toISOString() }).eq("id", row.id);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log(`Échec ${f.home} – ${f.away} : ${message}`);
    await db()
      .from("daily_matches")
      .update({ status: row.attempts >= MAX_ATTEMPTS ? "error" : "pending", error: message, updated_at: new Date().toISOString() })
      .eq("id", row.id);
  }
  await touch(day);
}

type Progress = { pending: number; running: number; done: number; total: number };

async function progress(day: string): Promise<Progress> {
  const { data } = await db().from("daily_matches").select("id, status, attempts, claimed_at").eq("day", day);
  const rows = data ?? [];
  const staleMs = STALE_MINUTES * 60_000;
  // Bloqués trop longtemps après le dernier essai : abandonnés.
  const dead = rows.filter((r) => r.status === "running" && olderThan(r.claimed_at, staleMs) && r.attempts >= MAX_ATTEMPTS).map((r) => r.id);
  if (dead.length) await db().from("daily_matches").update({ status: "error", error: "Analyse interrompue." }).in("id", dead);
  const live = rows.filter((r) => !dead.includes(r.id));
  return {
    pending: live.filter((r) => (r.status === "pending" && r.attempts < MAX_ATTEMPTS) || (r.status === "running" && olderThan(r.claimed_at, staleMs))).length,
    running: live.filter((r) => r.status === "running" && !olderThan(r.claimed_at, staleMs)).length,
    done: live.filter((r) => r.status === "done").length,
    total: rows.length,
  };
}

async function compose(day: string, log: (m: string) => void) {
  const { data: claimed } = await db()
    .from("daily_runs")
    .update({ status: "composing", heartbeat: new Date().toISOString() })
    .eq("day", day)
    .eq("status", "analyzing")
    .select()
    .maybeSingle();
  if (!claimed) return;
  log("Composition des coupons du jour…");
  const { data } = await db().from("daily_matches").select("id, result").eq("day", day).eq("status", "done").order("position");
  const results: DayResult[] = (data ?? []).filter((r) => r.result).map((r) => ({ id: r.id, result: r.result as AnalysisResult }));
  const coupons = await composeDailyCoupons(results, log);
  await db().from("daily_runs").update({ status: "ready", coupons, ready_at: new Date().toISOString(), heartbeat: new Date().toISOString() }).eq("day", day);
  log(`${coupons.length} coupon(s) prêts`);
}

/**
 * Travaille jusqu'à `deadline` (horodatage en ms). Renvoie `more: true` s'il reste des matchs à analyser :
 * l'appelant doit alors relancer un nouveau passage.
 */
export async function runWorker(deadline: number, log: (m: string) => void = console.log): Promise<{ more: boolean; status: RunStatus }> {
  const day = today();
  let run = await ensureRun(day, log);
  await touch(day);

  if (run.status === "analyzing") {
    const durations: number[] = [];
    const lane = async () => {
      while (true) {
        const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 150_000;
        if (deadline - Date.now() < Math.max(120_000, avg * 1.3)) return;
        const { data } = await db().rpc("claim_daily_match", { p_day: day, p_stale_minutes: STALE_MINUTES, p_max_attempts: MAX_ATTEMPTS });
        const row = (data as { id: string; attempts: number; fixture: DayFixture }[] | null)?.[0];
        if (!row) return;
        const start = Date.now();
        await analyzeRow(day, row, log);
        durations.push(Date.now() - start);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, lane));
    const p = await progress(day);
    if (p.pending > 0) return { more: true, status: "analyzing" };
    if (p.running > 0) return { more: false, status: "analyzing" }; // un autre passage termine ses matchs et relancera
    await compose(day, log);
  } else if (run.status === "composing" && olderThan(run.heartbeat, TAKEOVER_MS)) {
    await db().from("daily_runs").update({ status: "analyzing" }).eq("day", day).eq("status", "composing");
    await compose(day, log);
  }

  run = (await db().from("daily_runs").select("status, heartbeat").eq("day", day).single()).data as typeof run;
  return { more: false, status: run.status };
}

// ---------------------------------------------------------------------------------------------------------
// Lecture.

let cache: { at: number; data: DayData } | null = null;
const CACHE_MS = 30_000;

export async function readDay(): Promise<DayData> {
  if (isDemo()) return demoDay();
  const day = today();
  if (cache && cache.data.day === day && Date.now() - cache.at < CACHE_MS) return cache.data;
  const [{ data: run }, { data: rows }] = await Promise.all([
    db().from("daily_runs").select("*").eq("day", day).maybeSingle(),
    db().from("daily_matches").select("id, position, status, fixture, result").eq("day", day).order("position"),
  ]);
  const data: DayData = {
    day,
    status: (run?.status as RunStatus) ?? "none",
    heartbeat: run?.heartbeat ?? null,
    readyAt: run?.ready_at ?? null,
    coupons: (run?.coupons as DailyCoupon[] | null) ?? [],
    matches: (rows ?? []) as DayMatch[],
  };
  cache = { at: Date.now(), data };
  return data;
}

/** Vrai si le travail du jour n'a pas commencé ou semble arrêté : il faut relancer le moteur. */
export function needsKick(d: DayData) {
  if (isDemo()) return false;
  if (d.status === "none") return true;
  if (d.status === "ready" || d.status === "failed") return false;
  return olderThan(d.heartbeat, 3 * 60_000);
}

// ---------------------------------------------------------------------------------------------------------
// Mode démo : une journée fictive calculée une fois, en mémoire.

const g = globalThis as unknown as { __prDemoDay?: Promise<DayData> & { day?: string } };

function demoDay(): Promise<DayData> {
  const day = today();
  if (g.__prDemoDay?.day === day) return g.__prDemoDay;
  const p = (async () => {
    const leagues = ["Ligue des Champions", "Premier League", "Ligue 1"];
    const fixtures = (await Promise.all(leagues.map((l) => demoFixtures("football", l, () => {})))).flat();
    const matches: DayMatch[] = await Promise.all(
      fixtures.map(async (f, position) => {
        const fixture: DayFixture = { ...f, date: day, sport: "football" };
        const result = await demoAnalysis(
          { sport: "football", mode: "complete", home: f.home, away: f.away, competition: f.competition, date: day, odds: f.odds ?? null, apiFootballId: null },
          () => {},
        );
        return { id: `${day}|${fixtureId(fixture)}`, position, status: "done" as const, fixture, result };
      }),
    );
    const coupons = computedCoupons(matches.map((m) => ({ id: m.id, result: m.result! })));
    return { day, status: "ready", heartbeat: new Date().toISOString(), readyAt: new Date().toISOString(), coupons, matches } satisfies DayData;
  })();
  g.__prDemoDay = Object.assign(p, { day });
  return p;
}
