import { readKey } from "./env";
// The Odds API (https://the-odds-api.com) : cotes de dizaines de bookmakers.
// Une requête renvoie tous les matchs à venir d'un championnat avec leurs cotes.
import type { Fixture, OddsSummary, Sport } from "./schemas";

const BASE = "https://api.the-odds-api.com/v4";
const EXCHANGE_KEYS = ["betfair_ex_eu", "betfair_ex_uk", "matchbook"];

// Les réponses sont gardées en mémoire 2 heures par Vercel : ouvrir le site 1 ou 50 fois
// ne coûte qu'une requête par championnat sur cette période.
export const CACHE_SECONDS = 2 * 60 * 60;

type Outcome = { name: string; price: number };
type OddsEvent = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: { key: string; title: string; markets: { key: string; outcomes: Outcome[] }[] }[];
};

export const hasOddsApi = () => Boolean(readKey("ODDS_API_KEY"));

export class OddsApiError extends Error {}

async function get<T>(path: string, params: Record<string, string>) {
  const url = new URL(BASE + path);
  url.searchParams.set("apiKey", readKey("ODDS_API_KEY"));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { next: { revalidate: CACHE_SECONDS } });
  const remaining = res.headers.get("x-requests-remaining");
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new OddsApiError(`The Odds API : ${body?.message ?? `erreur ${res.status}`}`);
  }
  return { data: (await res.json()) as T, remaining: remaining !== null ? Number(remaining) : null };
}

/** Liste des compétitions actives (gratuit : ne consomme pas de crédit). */
async function activeSports() {
  const { data } = await get<{ key: string; group: string; title: string; active: boolean }[]>("/sports", {});
  return data.filter((s) => s.active);
}

// Moyenne des cotes de tous les bookmakers, et cote de la bourse de paris à part.
function summarize(e: OddsEvent): OddsSummary | null {
  const books = e.bookmakers
    .map((b) => {
      const market = b.markets.find((m) => m.key === "h2h");
      if (!market) return null;
      const totals = b.markets.find((m) => m.key === "totals");
      const over = totals?.outcomes.find((o) => o.name === "Over") as (Outcome & { point?: number }) | undefined;
      const under = totals?.outcomes.find((o) => o.name === "Under" && (o as Outcome & { point?: number }).point === over?.point);
      const find = (name: string) => market.outcomes.find((o) => o.name === name)?.price ?? null;
      return {
        key: b.key,
        title: b.title,
        home: find(e.home_team),
        draw: find("Draw"),
        away: find(e.away_team),
        totals: over?.point !== undefined && under ? { point: over.point, over: over.price, under: under.price } : null,
      };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null && b.home !== null && b.away !== null);
  if (books.length === 0) return null;

  const regular = books.filter((b) => !EXCHANGE_KEYS.includes(b.key));
  const pool = regular.length > 0 ? regular : books;
  const avg = (vals: (number | null)[]) => {
    const v = vals.filter((x): x is number => x !== null);
    return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 100) / 100 : null;
  };
  const ex = books.find((b) => EXCHANGE_KEYS.includes(b.key));
  return {
    bookmakers: pool.length,
    home: avg(pool.map((b) => b.home))!,
    draw: avg(pool.map((b) => b.draw)),
    away: avg(pool.map((b) => b.away))!,
    exchange: ex ? { name: ex.title, home: ex.home!, draw: ex.draw, away: ex.away! } : null,
    totals: summarizeTotals(pool.map((b) => b.totals).filter((t): t is NonNullable<typeof t> => t !== null)),
  };
}

// Garde la ligne la plus proposée (souvent 2,5 buts) et fait la moyenne des cotes plus / moins.
function summarizeTotals(lines: { point: number; over: number; under: number }[]) {
  if (lines.length === 0) return null;
  const counts = new Map<number, number>();
  for (const l of lines) counts.set(l.point, (counts.get(l.point) ?? 0) + 1);
  const point = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const same = lines.filter((l) => l.point === point);
  const mean = (v: number[]) => Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 100) / 100;
  return { point, over: mean(same.map((l) => l.over)), under: mean(same.map((l) => l.under)) };
}

function parisDateTime(iso: string) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
  const time = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(d);
  return { date, time };
}

async function oddsForSport(sportKey: string, competition: string, sport: Sport) {
  // Bornes arrondies à la tranche de 2 heures : l'adresse de la requête reste identique, donc la mémoire sert.
  const slot = CACHE_SECONDS * 1000;
  const now = new Date(Math.floor(Date.now() / slot) * slot);
  const in7days = new Date(now.getTime() + 7 * 86400000);
  const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
  const { data, remaining } = await get<OddsEvent[]>(`/sports/${sportKey}/odds`, {
    regions: "eu",
    markets: "h2h,totals",
    oddsFormat: "decimal",
    commenceTimeFrom: iso(now),
    commenceTimeTo: iso(in7days),
  });
  const fixtures: Fixture[] = data.map((e) => {
    const { date, time } = parisDateTime(e.commence_time);
    const odds = summarize(e);
    return {
      home: e.home_team,
      away: e.away_team,
      competition: sport === "tennis" ? e.sport_title : competition,
      date,
      time,
      stage: null,
      odds: odds && sport === "tennis" ? { ...odds, draw: null, exchange: odds.exchange && { ...odds.exchange, draw: null } } : odds,
    };
  });
  return { fixtures, remaining };
}

/**
 * Matchs des 7 prochains jours avec leurs cotes.
 * Football : `sportKey` est la clé du championnat. Tennis : `tour` vaut "tennis_atp" ou "tennis_wta",
 * et on interroge chaque tournoi en cours (une requête par tournoi).
 */
export async function fetchOddsFixtures(sport: Sport, competition: string, key: string) {
  const sports = await activeSports();
  const keys = sport === "tennis" ? sports.filter((s) => s.key.startsWith(key + "_")).map((s) => s.key) : sports.some((s) => s.key === key) ? [key] : [];
  if (keys.length === 0) return { fixtures: [] as Fixture[], remaining: null, covered: false };

  let remaining: number | null = null;
  const fixtures: Fixture[] = [];
  for (const k of keys) {
    const r = await oddsForSport(k, competition, sport);
    fixtures.push(...r.fixtures);
    remaining = r.remaining ?? remaining;
  }
  fixtures.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return { fixtures, remaining, covered: true };
}
