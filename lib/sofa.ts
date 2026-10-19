// Lecture des données Sofascore (direct mondial), utilisable côté serveur comme dans le navigateur.
// Sofascore bloque souvent les serveurs : le navigateur du téléphone l'interroge alors lui-même.
import type { LiveMatch } from "./espn";

// Sofascore liste en une seule requête tous les matchs de football en cours dans le monde (des centaines de
// championnats). Service public sans clé, non officiel : en cas d'échec, on garde la liste d'ESPN.

type SofaEvent = {
  id?: number;
  tournament?: { name?: string; category?: { name?: string } };
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
  homeScore?: { current?: number };
  awayScore?: { current?: number };
  status?: { type?: string; description?: string };
  time?: { currentPeriodStartTimestamp?: number };
  startTimestamp?: number;
};

export const SOFA_HEADERS = { "User-Agent": "Mozilla/5.0 (PronoRadar)", Accept: "application/json" };

function sofaClock(e: SofaEvent) {
  const desc = (e.status?.description ?? "").toLowerCase();
  if (/half ?time|pause/.test(desc)) return "MT";
  const start = e.time?.currentPeriodStartTimestamp;
  if (!start) return e.status?.description ?? "En cours";
  const base = /2nd/.test(desc) ? 45 : /1st extra/.test(desc) ? 90 : /2nd extra/.test(desc) ? 105 : 0;
  const cap = /2nd/.test(desc) ? 90 : /extra/.test(desc) ? base + 15 : 45;
  const minute = base + Math.floor((Date.now() / 1000 - start) / 60) + 1;
  return minute > cap ? `${cap}+${minute - cap}'` : `${minute}'`;
}


export const SOFA_LIVE_URL = "https://api.sofascore.com/api/v1/sport/football/events/live";
export const sofaStatsUrl = (id: string) => `https://api.sofascore.com/api/v1/event/${id}/statistics`;

export function parseSofaLive(data: unknown): LiveMatch[] {
  const events: SofaEvent[] = (data as { events?: SofaEvent[] })?.events ?? [];
  return events.flatMap((e) => {
    if (!e.id || !e.homeTeam?.name || !e.awayTeam?.name || e.status?.type !== "inprogress") return [];
    const country = e.tournament?.category?.name;
    return [
      {
        id: String(e.id),
        slug: "sofa",
        competition: [country, e.tournament?.name].filter(Boolean).join(" · ") || "Football",
        home: e.homeTeam.name,
        away: e.awayTeam.name,
        homeScore: e.homeScore?.current ?? 0,
        awayScore: e.awayScore?.current ?? 0,
        state: "in" as const,
        clock: sofaClock(e),
        date: new Date((e.startTimestamp ?? Date.now() / 1000) * 1000).toISOString(),
      },
    ];
  });
}

type SofaStats = { statistics?: { period?: string; groups?: { statisticsItems?: { name?: string; home?: string; away?: string }[] }[] }[] };

export function parseSofaStats(data: unknown): string[] {
  const d = data as SofaStats;
  const all = d.statistics?.find((p) => p.period === "ALL") ?? d.statistics?.[0];
  const KEEP = /possession|shots|on target|corner|fouls|yellow|red|offsides|saves|expected goals|big chances/i;
  const items = (all?.groups ?? []).flatMap((g) => g.statisticsItems ?? []).filter((i) => KEEP.test(i.name ?? ""));
  return items.map((i) => `${i.name} : domicile ${i.home} / extérieur ${i.away}`);
}
