// API-Football (https://www.api-football.com) : calendrier, forme, blessés,
// confrontations directes et pronostics chiffrés. Formule gratuite : environ 100 requêtes par jour.
import { sameMatch } from "./teams";
import type { Fixture } from "./schemas";

const BASE = "https://v3.football.api-sports.io";

export const hasApiFootball = () => Boolean(process.env.API_FOOTBALL_KEY);

export class ApiFootballError extends Error {}

let lastRemaining: number | null = null;
export const apiFootballRemaining = () => lastRemaining;

async function get<T>(path: string, params: Record<string, string | number>): Promise<T[]> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY ?? "" }, cache: "no-store" });
  const remaining = res.headers.get("x-ratelimit-requests-remaining");
  if (remaining !== null) lastRemaining = Number(remaining);
  if (!res.ok) throw new ApiFootballError(`API-Football : erreur ${res.status}`);
  const body = (await res.json()) as { errors: unknown; response: T[] };
  // L'API répond 200 même en cas d'erreur (quota, saison non incluse dans la formule…).
  const errors = body.errors && typeof body.errors === "object" ? Object.values(body.errors as Record<string, string>) : [];
  if (errors.length > 0) throw new ApiFootballError(`API-Football : ${errors.join(" ")}`);
  return body.response;
}

// Les saisons européennes portent l'année de leur début (2026-2027 → 2026).
function currentSeason() {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

type ApiFixture = {
  fixture: { id: number; date: string; venue: { name: string | null } };
  teams: { home: { name: string }; away: { name: string } };
};

/** Associe aux matchs déjà trouvés leur identifiant API-Football (une requête par championnat). */
export async function attachApiFootballIds(fixtures: Fixture[], leagueId: number): Promise<Fixture[]> {
  if (fixtures.length === 0) return fixtures;
  const dates = fixtures.map((f) => f.date).sort();
  const list = await get<ApiFixture>("/fixtures", {
    league: leagueId,
    season: currentSeason(),
    from: dates[0],
    to: dates[dates.length - 1],
  });
  return fixtures.map((f) => {
    const hit = list.find((a) =>
      sameMatch(f, { home: a.teams.home.name, away: a.teams.away.name, date: a.fixture.date.slice(0, 10) }),
    );
    return { ...f, apiFootballId: hit?.fixture.id ?? null };
  });
}

/** Matchs des 7 prochains jours d'un championnat, quand The Odds API ne le couvre pas. */
export async function fetchApiFootballFixtures(leagueId: number, competition: string): Promise<Fixture[]> {
  const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  const list = await get<ApiFixture>("/fixtures", { league: leagueId, season: currentSeason(), from: day(0), to: day(7) });
  return list.map((a) => {
    const d = new Date(a.fixture.date);
    return {
      home: a.teams.home.name,
      away: a.teams.away.name,
      competition,
      date: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d),
      time: new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(d),
      stage: null,
      odds: null,
      apiFootballId: a.fixture.id,
    };
  });
}

type Prediction = {
  predictions: {
    winner: { name: string | null; comment: string | null } | null;
    advice: string | null;
    under_over: string | null;
    percent: { home: string; draw: string; away: string };
  };
  teams: {
    home: { name: string; last_5: { form: string | null }; league: { form: string | null } };
    away: { name: string; last_5: { form: string | null }; league: { form: string | null } };
  };
  h2h: { teams: { home: { name: string }; away: { name: string } }; goals: { home: number | null; away: number | null }; fixture: { date: string } }[];
};

type Injury = { player: { name: string; reason: string | null; type: string | null }; team: { name: string } };

export type ApiFootballInsight = {
  percent: { home: number; draw: number; away: number };
  winner: string | null;
  advice: string | null;
  underOver: string | null;
  formHome: string | null;
  formAway: string | null;
  h2h: string[];
  injuries: string[];
};

const pct = (s: string) => Number.parseFloat(s) || 0;

/** Pronostic chiffré, forme et confrontations directes (1 requête), plus les blessés si demandé (1 requête). */
export async function fetchInsight(fixtureId: number, withInjuries: boolean): Promise<ApiFootballInsight | null> {
  const [pred] = await get<Prediction>("/predictions", { fixture: fixtureId });
  if (!pred) return null;
  const injuries = withInjuries
    ? (await get<Injury>("/injuries", { fixture: fixtureId })).map(
        (i) => `${i.player.name} (${i.team.name}) : ${[i.player.type, i.player.reason].filter(Boolean).join(", ")}`,
      )
    : [];
  return {
    percent: {
      home: pct(pred.predictions.percent.home),
      draw: pct(pred.predictions.percent.draw),
      away: pct(pred.predictions.percent.away),
    },
    winner: pred.predictions.winner?.name ?? null,
    advice: pred.predictions.advice,
    underOver: pred.predictions.under_over,
    formHome: pred.teams.home.league.form ?? pred.teams.home.last_5.form,
    formAway: pred.teams.away.league.form ?? pred.teams.away.last_5.form,
    h2h: pred.h2h
      .slice(-5)
      .map((m) => `${m.fixture.date.slice(0, 10)} : ${m.teams.home.name} ${m.goals.home ?? "?"}-${m.goals.away ?? "?"} ${m.teams.away.name}`),
    injuries,
  };
}
