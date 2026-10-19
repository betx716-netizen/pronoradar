// Programme des matchs via l'annuaire public d'ESPN (gratuit, sans clé ni quota connu) :
// secours quand les cotes et les statistiques ne sont plus disponibles. Pas de cotes.
import type { Fixture } from "./schemas";

export const SLUGS: Record<string, string> = {
  "Ligue des Champions": "uefa.champions",
  "Ligue Europa": "uefa.europa",
  "Ligue Conférence": "uefa.europa.conf",
  "Ligue 1": "fra.1",
  "Premier League": "eng.1",
  LaLiga: "esp.1",
  "Serie A": "ita.1",
  Bundesliga: "ger.1",
  "Liga Portugal": "por.1",
  Eredivisie: "ned.1",
  "Ligue 2": "fra.2",
  "Championship (Angleterre)": "eng.2",
};

export const espnCovers = (competition: string) => competition in SLUGS;

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
// fr-CA donne AAAA-MM-JJ, en-GB donne HH:MM.
const paris = (iso: string, locale: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, { timeZone: "Europe/Paris", ...opts }).format(new Date(iso));

type EspnEvent = {
  date?: string;
  competitions?: { competitors?: { homeAway?: string; team?: { displayName?: string } }[]; status?: { type?: { state?: string } } }[];
  week?: { number?: number };
};

export async function fetchEspnFixtures(competition: string): Promise<Fixture[]> {
  const slug = SLUGS[competition];
  if (!slug) return [];
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 86400000);
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${ymd(now)}-${ymd(end)}&limit=200`, {
    next: { revalidate: 7200 },
  });
  if (!res.ok) throw new Error(`Programme de secours indisponible (erreur ${res.status}).`);
  const events: EspnEvent[] = (await res.json())?.events ?? [];
  return events.flatMap((e) => {
    const c = e.competitions?.[0];
    const home = c?.competitors?.find((x) => x.homeAway === "home")?.team?.displayName;
    const away = c?.competitors?.find((x) => x.homeAway === "away")?.team?.displayName;
    if (!e.date || !home || !away || c?.status?.type?.state === "post") return [];
    return [
      {
        home,
        away,
        competition,
        date: paris(e.date, "fr-CA", { year: "numeric", month: "2-digit", day: "2-digit" }),
        time: paris(e.date, "en-GB", { hour: "2-digit", minute: "2-digit" }),
        stage: null,
        odds: null,
        apiFootballId: null,
      },
    ];
  });
}

// ——— Compositions officielles ———
// ESPN publie les onze de départ environ une heure avant le coup d'envoi.

type RosterEntry = { starter?: boolean; jersey?: string; athlete?: { displayName?: string }; position?: { abbreviation?: string } };
type Roster = { homeAway?: string; formation?: string; roster?: RosterEntry[] };

const LINE: Record<string, number> = { G: 0, D: 1, M: 2, F: 3 };
// « CD-L », « LB », « DM », « AM-R », « CF »… → gardien, défense, milieu ou attaque.
function lineOf(pos: string) {
  const p = pos.toUpperCase();
  if (p.startsWith("G")) return 0;
  if (/^(D|CB|LB|RB|LWB|RWB|SW)/.test(p) || p.startsWith("CD")) return 1;
  if (/^(M|DM|CM|AM|LM|RM)/.test(p)) return 2;
  if (/^(F|ST|CF|LW|RW|SS)/.test(p)) return 3;
  return LINE[p[0]] ?? 2;
}

function toLineup(r: Roster) {
  const starters = (r.roster ?? []).filter((x) => x.starter && x.athlete?.displayName);
  if (starters.length < 11) return null;
  const label = (x: RosterEntry) => `${x.jersey ?? ""} ${x.athlete!.displayName}`.trim();
  const gk = starters.find((x) => lineOf(x.position?.abbreviation ?? "") === 0);
  const field = starters.filter((x) => x !== gk);
  const groups = [1, 2, 3].map((l) => field.filter((x) => lineOf(x.position?.abbreviation ?? "") === l).map(label)).filter((g) => g.length);
  return {
    formation: r.formation || groups.map((g) => g.length).join("-"),
    goalkeeper: gk ? label(gk) : "",
    lines: groups,
    kit: null,
    doubts: [],
    status: "officielle" as const,
    source: "Onze de départ officiel",
  };
}

const sameTeam = (a: string, b: string) => {
  const n = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  const x = n(a);
  const y = n(b);
  return x === y || (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x)));
};

/** Onze de départ officiels du match s'ils sont publiés, sinon null. */
export async function fetchOfficialLineups(competition: string, home: string, away: string, date: string | null) {
  const slug = SLUGS[competition];
  if (!slug) return null;
  const day = date && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10).replace(/-/g, "") : ymd(new Date());
  const board = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${day}`, { cache: "no-store" });
  if (!board.ok) return null;
  const events: (EspnEvent & { id?: string })[] = (await board.json())?.events ?? [];
  const event = events.find((e) => {
    const c = e.competitions?.[0]?.competitors ?? [];
    const h = c.find((x) => x.homeAway === "home")?.team?.displayName ?? "";
    const a = c.find((x) => x.homeAway === "away")?.team?.displayName ?? "";
    return sameTeam(h, home) && sameTeam(a, away);
  });
  if (!event?.id) return null;
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${event.id}`, { cache: "no-store" });
  if (!res.ok) return null;
  const rosters: Roster[] = (await res.json())?.rosters ?? [];
  const h = rosters.find((r) => r.homeAway === "home");
  const a = rosters.find((r) => r.homeAway === "away");
  const lh = h && toLineup(h);
  const la = a && toLineup(a);
  return lh && la ? { home: lh, away: la } : null;
}

// ——— Scores en direct ———

export type LiveMatch = {
  competition: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  state: "pre" | "in" | "post";
  clock: string; // « 67' », « MT », « Terminé », ou l'heure de coup d'envoi
  date: string;
};

type LiveEvent = {
  date?: string;
  competitions?: {
    competitors?: { homeAway?: string; score?: string; team?: { displayName?: string } }[];
    status?: { displayClock?: string; type?: { state?: string; shortDetail?: string; completed?: boolean } };
  }[];
};

function clockLabel(state: string, detail: string, displayClock: string, date: string) {
  if (state === "post") return "Terminé";
  if (state === "pre") return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
  if (/^HT|half/i.test(detail)) return "MT";
  return displayClock && displayClock !== "0'" ? displayClock : detail;
}

/** Matchs d'hier, d'aujourd'hui et de demain d'un championnat, avec leur score et leur état. */
export async function fetchLiveScores(competition: string): Promise<LiveMatch[]> {
  const slug = SLUGS[competition];
  if (!slug) return [];
  const now = Date.now();
  const range = `${ymd(new Date(now - 86400000))}-${ymd(new Date(now + 86400000))}`;
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${range}&limit=200`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) return [];
  const events: LiveEvent[] = (await res.json())?.events ?? [];
  return events.flatMap((e) => {
    const c = e.competitions?.[0];
    const h = c?.competitors?.find((x) => x.homeAway === "home");
    const a = c?.competitors?.find((x) => x.homeAway === "away");
    if (!e.date || !h?.team?.displayName || !a?.team?.displayName) return [];
    const state = (c?.status?.type?.state ?? "pre") as LiveMatch["state"];
    const score = (s?: string) => (state === "pre" || s == null || s === "" ? null : Number(s));
    return [
      {
        competition,
        home: h.team.displayName,
        away: a.team.displayName,
        homeScore: score(h.score),
        awayScore: score(a.score),
        state,
        clock: clockLabel(state, c?.status?.type?.shortDetail ?? "", c?.status?.displayClock ?? "", e.date),
        date: e.date,
      },
    ];
  });
}

export { sameTeam };
