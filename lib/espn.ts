// Programme des matchs via l'annuaire public d'ESPN (gratuit, sans clé ni quota connu) :
// secours quand les cotes et les statistiques ne sont plus disponibles. Pas de cotes.
import type { Fixture, PastGame } from "./schemas";

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
  "Jupiler Pro League (Belgique)": "bel.1",
  "Süper Lig (Turquie)": "tur.1",
  "Premiership (Écosse)": "sco.1",
  "Super League (Suisse)": "sui.1",
  "Bundesliga (Autriche)": "aut.1",
  "Super League (Grèce)": "gre.1",
  "Superliga (Danemark)": "den.1",
  "Allsvenskan (Suède)": "swe.1",
  "Eliteserien (Norvège)": "nor.1",
  "Ligue 2": "fra.2",
  "Championship (Angleterre)": "eng.2",
  "LaLiga 2": "esp.2",
  "Serie B": "ita.2",
  "2. Bundesliga": "ger.2",
};

export const espnCovers = (competition: string) => competition in SLUGS;

// Identifiants ESPN des championnats (relevés le 26/10/2026), pour reconnaître leurs matchs dans le programme « tous les championnats ».
export const ESPN_IDS: Record<string, string> = {
  "Ligue des Champions": "775",
  "Ligue Europa": "776",
  "Ligue Conférence": "20296",
  "Ligue 1": "710",
  "Premier League": "700",
  LaLiga: "740",
  "Serie A": "730",
  Bundesliga: "720",
  "Liga Portugal": "715",
  Eredivisie: "725",
  "Jupiler Pro League (Belgique)": "3901",
  "Süper Lig (Turquie)": "3946",
  "Premiership (Écosse)": "735",
  "Super League (Suisse)": "3944",
  "Bundesliga (Autriche)": "3907",
  "Super League (Grèce)": "3955",
  "Superliga (Danemark)": "3913",
  "Allsvenskan (Suède)": "3945",
  "Eliteserien (Norvège)": "3960",
  "Ligue 2": "3926",
  "Championship (Angleterre)": "3914",
  "LaLiga 2": "3921",
  "Serie B": "3931",
  "2. Bundesliga": "3927",
};
const NAME_BY_ID = Object.fromEntries(Object.entries(ESPN_IDS).map(([name, id]) => [id, name]));

/** Jours au format ESPN (AAAAMMJJ), de `from` à `to` jours par rapport à aujourd'hui. ESPN refuse désormais les plages : un jour par requête. */
export const espnDays = (from: number, to: number) => {
  const now = Date.now();
  return Array.from({ length: to - from + 1 }, (_, i) => ymd(new Date(now + (from + i) * 86400000)));
};

export const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
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
  // Un jour par requête (ESPN refuse les plages de dates), d'aujourd'hui à J+7.
  const pages = await Promise.all(
    espnDays(0, 7).map(async (d) => {
      const res = await fetch(scoreboardUrl(slug, d), { next: { revalidate: 7200 }, signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`Programme de secours indisponible (erreur ${res.status}).`);
      return ((await res.json())?.events ?? []) as (EspnEvent & { id?: string })[];
    }),
  );
  const seen = new Set<string>();
  const events = pages.flat().filter((e) => (e.id ? !seen.has(e.id) && seen.add(e.id) : true));
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

type FormEvent = {
  gameDate?: string;
  atVs?: string;
  score?: string;
  homeTeamScore?: string;
  awayTeamScore?: string;
  homeTeamId?: string;
  opponent?: { displayName?: string };
  leagueName?: string;
};
type FormBlock = { team?: { id?: string; displayName?: string }; events?: FormEvent[] };

// Résumé ESPN du match (pour l'historique) : trouvé via le tableau des scores du jour du match.
async function findSummary(competition: string, home: string, away: string, date: string | null) {
  const slug = SLUGS[competition];
  if (!slug) return null;
  const day = date && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10).replace(/-/g, "") : ymd(new Date());
  const board = await fetch(scoreboardUrl(slug, day), { next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000) });
  if (!board.ok) return null;
  const events: (EspnEvent & { id?: string })[] = (await board.json())?.events ?? [];
  const event = events.find((e) => {
    const c = e.competitions?.[0]?.competitors ?? [];
    const h = c.find((x) => x.homeAway === "home")?.team?.displayName ?? "";
    const a = c.find((x) => x.homeAway === "away")?.team?.displayName ?? "";
    return sameTeam(h, home) && sameTeam(a, away);
  });
  if (!event?.id) return null;
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${event.id}`, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(6000),
  });
  return res.ok ? res.json() : null;
}

// Un match de la liste de forme ESPN, remis au format domicile-extérieur.
function toPastGame(team: string, e: FormEvent): PastGame | null {
  const opp = e.opponent?.displayName;
  if (!opp) return null;
  const atHome = e.atVs !== "@";
  const [a, b] = (e.score ?? "").split("-").map((x) => x.trim());
  const hs = e.homeTeamScore ?? (atHome ? a : b);
  const as = e.awayTeamScore ?? (atHome ? b : a);
  if (hs == null || as == null || hs === "" || as === "") return null;
  return {
    date: e.gameDate ? e.gameDate.slice(0, 10) : null,
    home: atHome ? team : opp,
    away: atHome ? opp : team,
    score: `${hs}-${as}`,
    competition: e.leagueName ?? null,
  };
}

/** Derniers matchs de chaque équipe et dernières confrontations, d'après ESPN ; null si introuvables. */
export async function fetchMatchHistory(competition: string, home: string, away: string, date: string | null) {
  const data = await findSummary(competition, home, away, date).catch(() => null);
  if (!data) return null;
  const form: FormBlock[] = data?.boxscore?.form ?? [];
  const games = (name: string) => {
    const block = form.find((f) => sameTeam(f.team?.displayName ?? "", name));
    return (block?.events ?? []).flatMap((e) => toPastGame(name, e) ?? []).slice(0, 5);
  };
  const h2hBlock: FormBlock | undefined = (data?.headToHeadGames ?? [])[0];
  const h2hTeam = h2hBlock?.team?.displayName ?? home;
  const h2h = (h2hBlock?.events ?? []).flatMap((e) => toPastGame(h2hTeam, e) ?? []).slice(0, 5);
  const result = { home: games(home), away: games(away), h2h };
  return result.home.length || result.away.length || result.h2h.length ? result : null;
}

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
  id: string;
  slug: string;
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
  id?: string;
  date?: string;
  competitions?: {
    competitors?: { homeAway?: string; score?: string; team?: { displayName?: string } }[];
    status?: { displayClock?: string; type?: { state?: string; shortDetail?: string; completed?: boolean } };
  }[];
};

// Championnats et coupes suivis pour le direct « dans le monde » (les adresses inconnues renvoient simplement rien).
export const WORLD_SLUGS = [
  "uefa.champions", "uefa.europa", "uefa.europa.conf", "uefa.nations", "fifa.world", "fifa.worldq.uefa", "fifa.worldq.caf",
  "fifa.worldq.conmebol", "caf.nations", "caf.champions", "conmebol.libertadores", "conmebol.sudamericana", "concacaf.champions",
  "fra.1", "fra.2", "fra.coupe_de_france", "eng.1", "eng.2", "eng.3", "eng.fa", "eng.league_cup", "esp.1", "esp.2", "esp.copa_del_rey",
  "ita.1", "ita.2", "ita.coppa_italia", "ger.1", "ger.2", "ger.dfb_pokal", "por.1", "ned.1", "bel.1", "tur.1", "sco.1",
  "gre.1", "cze.1", "aut.1", "sui.1", "den.1", "nor.1", "swe.1", "pol.1", "cro.1", "srb.1", "rus.1", "ukr.1", "cyp.1", "isr.1",
  "rou.1", "bul.1", "hun.1", "irl.1", "usa.1", "mex.1", "bra.1", "arg.1", "col.1", "chi.1", "uru.1", "per.1", "ecu.1",
  "ksa.1", "qat.1", "uae.1", "egy.1", "mar.1", "rsa.1", "jpn.1", "kor.1", "chn.1", "aus.1", "ind.1",
];

function clockLabel(state: string, detail: string, displayClock: string, date: string) {
  if (state === "post") return "Terminé";
  if (state === "pre") return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
  if (/^HT|half/i.test(detail)) return "MT";
  return displayClock && displayClock !== "0'" ? displayClock : detail;
}

// Nom du championnat pour l'affichage : celui de l'application si on le connaît, sinon celui d'ESPN.
const APP_NAME = Object.fromEntries(Object.entries(SLUGS).map(([name, slug]) => [slug, name]));

/** Lit un tableau des scores ESPN ; sert au serveur comme au téléphone (secours si le serveur n'obtient rien). */
export function parseScoreboard(data: unknown, slug: string): LiveMatch[] {
  const d = data as { leagues?: { name?: string }[]; events?: LiveEvent[] } | null;
  const label: string = APP_NAME[slug] ?? d?.leagues?.[0]?.name ?? slug;
  const events: LiveEvent[] = d?.events ?? [];
  return events.flatMap((e) => {
    const c = e.competitions?.[0];
    const h = c?.competitors?.find((x) => x.homeAway === "home");
    const a = c?.competitors?.find((x) => x.homeAway === "away");
    if (!e.id || !e.date || !h?.team?.displayName || !a?.team?.displayName) return [];
    const state = (c?.status?.type?.state ?? "pre") as LiveMatch["state"];
    const score = (s?: string) => (state === "pre" || s == null || s === "" ? null : Number(s));
    return [
      {
        id: e.id,
        slug,
        competition: label,
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

export const scoreboardUrl = (slug: string, range: string) =>
  `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${range}&limit=200`;

async function fetchSlug(slug: string, range: string, revalidate: number): Promise<LiveMatch[]> {
  // Délai maximal : une source lente ne doit pas bloquer tout l'onglet Direct.
  const res = await fetch(scoreboardUrl(slug, range), { next: { revalidate }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) return [];
  return parseScoreboard(await res.json(), slug);
}

/** Matchs d'hier, d'aujourd'hui et de demain d'un championnat de l'application, avec leur score et leur état. */
export async function fetchLiveScores(competition: string): Promise<LiveMatch[]> {
  const slug = SLUGS[competition];
  if (!slug) return [];
  const now = Date.now();
  // Hier, aujourd'hui et demain : une requête par jour (ESPN refuse les plages de dates).
  const days = [ymd(new Date(now - 86400000)), ymd(new Date(now)), ymd(new Date(now + 86400000))];
  const all = (await Promise.all(days.map((d) => fetchSlug(slug, d, 30).catch(() => [] as LiveMatch[])))).flat();
  return all.filter((m, i) => all.findIndex((x) => x.id === m.id) === i);
}

/** Tous les matchs en cours en ce moment, dans tous les championnats suivis. */
export async function fetchWorldLive(): Promise<{ matches: LiveMatch[]; sofaOk: boolean }> {
  // Source la plus complète d'abord ; ESPN complète (ou remplace si elle échoue).
  let sofaOk = true;
  const sofa = await fetchSofaLive().catch(() => {
    sofaOk = false;
    return [] as LiveMatch[];
  });
  const today = ymd(new Date());
  const espn = (await Promise.all(WORLD_SLUGS.map((s) => fetchSlug(s, today, 30).catch(() => [])))).flat().filter((m) => m.state === "in");
  // Un match présent dans les deux sources n'est gardé qu'une fois (version ESPN, qui a les statistiques détaillées).
  const extra = sofa.filter((s) => !espn.some((e) => sameTeam(e.home, s.home) && sameTeam(e.away, s.away)));
  return { matches: [...espn, ...extra], sofaOk };
}

type Stat = { name?: string; label?: string; displayValue?: string };
type Summary = {
  boxscore?: { teams?: { team?: { displayName?: string }; statistics?: Stat[] }[] };
  keyEvents?: { text?: string; clock?: { displayValue?: string }; type?: { text?: string } }[];
  commentary?: { text?: string; time?: { displayValue?: string } }[];
};

/** Statistiques et faits marquants d'un match en cours (possession, tirs, buts, cartons…), pour l'analyse en direct. */
export async function fetchMatchDetail(slug: string, id: string) {
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${id}`, { cache: "no-store" });
  if (!res.ok) return { stats: [] as string[], events: [] as string[] };
  const d: Summary = await res.json();
  const KEEP = /possession|shots|on target|corner|foul|yellow|red|offside|saves/i;
  const stats = (d.boxscore?.teams ?? []).map((t) => {
    const list = (t.statistics ?? []).filter((x) => KEEP.test(`${x.name} ${x.label}`)).map((x) => `${x.label ?? x.name} ${x.displayValue}`);
    return `${t.team?.displayName ?? "?"} : ${list.join(", ")}`;
  });
  const events = (d.keyEvents ?? [])
    .map((e) => `${e.clock?.displayValue ?? ""} ${e.type?.text ?? ""} ${e.text ?? ""}`.trim())
    .filter(Boolean)
    .slice(-15);
  return { stats, events };
}

export { sameTeam };

import { SOFA_HEADERS, parseSofaLive, parseSofaStats } from "./sofa";

export async function fetchSofaLive(): Promise<LiveMatch[]> {
  const res = await fetch("https://api.sofascore.com/api/v1/sport/football/events/live", {
    headers: SOFA_HEADERS,
    next: { revalidate: 30 },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Sofascore ${res.status}`);
  return parseSofaLive(await res.json());
}

/** Statistiques d'un match Sofascore (possession, tirs…), pour l'analyse en direct. */
export async function fetchSofaDetail(id: string) {
  const res = await fetch(`https://api.sofascore.com/api/v1/event/${id}/statistics`, { headers: SOFA_HEADERS, cache: "no-store" });
  if (!res.ok) return { stats: [] as string[], events: [] as string[] };
  return { stats: parseSofaStats(await res.json()), events: [] as string[] };
}


// ——— Programme de la semaine, tous championnats ———
// Une requête par jour sur le programme « tous les championnats » d'ESPN, puis tri par championnat de l'application.

type Price = { close?: { odds?: string }; open?: { odds?: string } };
type EspnOdds = {
  moneyline?: { home?: Price; draw?: Price; away?: Price };
  total?: { over?: Price & { close?: { line?: string } }; under?: Price };
  overUnder?: number;
};
type AllEvent = EspnEvent & { id?: string; uid?: string; competitions?: { odds?: EspnOdds[] }[] };

// Cote américaine (+150, -200) → cote décimale (2.50, 1.50).
const decimal = (p?: Price) => {
  const n = Number((p?.close?.odds ?? p?.open?.odds ?? "").replace("+", ""));
  if (!Number.isFinite(n) || n === 0) return null;
  return Math.round((n > 0 ? 1 + n / 100 : 1 + 100 / -n) * 100) / 100;
};

/** Cotes fournies avec le programme ESPN (DraftKings) : 1X2 et plus/moins de buts. Gratuites, sans quota. */
function espnOdds(o?: EspnOdds): Fixture["odds"] {
  if (!o?.moneyline) return null;
  const home = decimal(o.moneyline.home);
  const away = decimal(o.moneyline.away);
  if (!home || !away) return null;
  const over = decimal(o.total?.over);
  const under = decimal(o.total?.under);
  return {
    bookmakers: 1,
    home,
    draw: decimal(o.moneyline.draw),
    away,
    exchange: null,
    totals: o.overUnder && over && under ? { point: o.overUnder, over, under } : null,
  };
}

/** Matchs d'aujourd'hui à J+7 (jours de Paris) des championnats de l'application, en cours et terminés compris. */
export async function fetchWeekFixtures(): Promise<Fixture[]> {
  const today = paris(new Date().toISOString(), "fr-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
  const last = paris(new Date(Date.now() + 7 * 86400000).toISOString(), "fr-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
  const pages = await Promise.all(
    espnDays(-1, 8).map(async (d) => {
      try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${d}&limit=500`, {
          next: { revalidate: 1800 },
          signal: AbortSignal.timeout(8000),
        });
        return res.ok ? (((await res.json())?.events ?? []) as AllEvent[]) : [];
      } catch {
        return [] as AllEvent[];
      }
    }),
  );
  const seen = new Set<string>();
  const out: Fixture[] = [];
  for (const e of pages.flat()) {
    const leagueId = e.uid?.match(/~l:(\d+)~/)?.[1];
    const competition = leagueId ? NAME_BY_ID[leagueId] : undefined;
    if (!competition || !e.date || (e.id && seen.has(e.id))) continue;
    if (e.id) seen.add(e.id);
    const c = e.competitions?.[0];
    const home = c?.competitors?.find((x) => x.homeAway === "home")?.team?.displayName;
    const away = c?.competitors?.find((x) => x.homeAway === "away")?.team?.displayName;
    const date = paris(e.date, "fr-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
    if (!home || !away || date < today || date > last) continue;
    out.push({ home, away, competition, date, time: paris(e.date, "en-GB", { hour: "2-digit", minute: "2-digit" }), stage: null, odds: espnOdds(e.competitions?.[0]?.odds?.[0]), apiFootballId: null });
  }
  return out.sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));
}
