import { nameSimilarity, normalizeName } from "@/lib/teams";

export const runtime = "nodejs";

// Logo d'une équipe. Source principale : l'annuaire public des équipes d'ESPN (tous les grands championnats,
// une requête par championnat, gardée 7 jours). Repli : TheSportsDB. Réponse mise en cache 30 jours par Vercel.
const CACHE = "public, s-maxage=2592000, stale-while-revalidate=604800";

const ESPN_LEAGUES = [
  "uefa.champions", "uefa.europa", "uefa.europa.conf",
  "fra.1", "fra.2", "eng.1", "eng.2", "esp.1", "esp.2", "ita.1", "ita.2", "ger.1", "ger.2", "por.1", "ned.1", "bel.1", "tur.1", "sco.1",
  "gre.1", "cze.1", "aut.1", "sui.1", "den.1", "nor.1", "swe.1", "pol.1", "cro.1", "srb.1", "rus.1", "ukr.1", "cyp.1", "isr.1",
  "rou.1", "bul.1", "hun.1", "aze.1", "kaz.1", "irl.1", "usa.1", "mex.1", "bra.1", "arg.1", "ksa.1",
];

// Noms de villes écrits différemment selon les langues (« Slavia Praha » chez les bookmakers, « Slavia Prague » chez ESPN).
const CITY: Record<string, string> = {
  praha: "prague", munchen: "munich", lisboa: "lisbon", moskva: "moscow", beograd: "belgrade", kobenhavn: "copenhagen",
  bucuresti: "bucharest", kyiv: "kiev", sevilla: "seville", torino: "turin", wien: "vienna", bruxelles: "brussels",
  athina: "athens", genova: "genoa", roma: "rome", milano: "milan", koln: "cologne", plzen: "pilsen", brugge: "bruges",
  frankfurt: "frankfurt", porto: "porto", glasgow: "glasgow", zurich: "zurich", praga: "prague",
};
const tokens = (n: string) => normalizeName(n).map((t) => CITY[t] ?? t);
const key = (n: string) => tokens(n).join(" ");
// Ressemblance sur les mots traduits, avec mots partiels (« Inter » / « Internazionale »).
function similarity(a: string, b: string) {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  const common = ta.filter((t) => tb.some((u) => u === t || (Math.min(t.length, u.length) >= 4 && (u.startsWith(t) || t.startsWith(u))))).length;
  return Math.max(common / Math.max(ta.length, tb.length), nameSimilarity(a, b));
}

type Entry = { names: string[]; logo: string };
let directory: Promise<Entry[]> | null = null;
let builtAt = 0;

type EspnTeam = { team?: { displayName?: string; shortDisplayName?: string; name?: string; location?: string; logos?: { href?: string }[] } };

async function espnLeague(slug: string): Promise<Entry[]> {
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams`, { next: { revalidate: 604800 } });
    if (!res.ok) return [];
    const data = await res.json();
    const teams: EspnTeam[] = data?.sports?.[0]?.leagues?.[0]?.teams ?? [];
    return teams.flatMap(({ team }) => {
      const logo = team?.logos?.[0]?.href;
      if (!team || !logo) return [];
      return [{ names: [team.displayName, team.shortDisplayName, team.name, team.location].filter((n): n is string => Boolean(n)), logo }];
    });
  } catch {
    return [];
  }
}

function getDirectory() {
  if (!directory || Date.now() - builtAt > 86400000) {
    builtAt = Date.now();
    directory = Promise.all(ESPN_LEAGUES.map(espnLeague)).then((all) => all.flat());
  }
  return directory;
}

async function fromEspn(name: string): Promise<string | null> {
  const wanted = key(name);
  let best: { score: number; logo: string } | null = null;
  for (const e of await getDirectory()) {
    for (const n of e.names) {
      const score = key(n) === wanted ? 2 : similarity(name, n);
      if (!best || score > best.score) best = { score, logo: e.logo };
    }
  }
  return best && best.score >= 0.6 ? best.logo : null;
}

async function fromSportsDb(name: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(name)}`, { next: { revalidate: 2592000 } });
    if (!res.ok) return null;
    const teams = ((await res.json().catch(() => null))?.teams ?? []) as { strSport?: string; strBadge?: string; strTeamBadge?: string }[];
    const t = teams.find((x) => !x.strSport || x.strSport === "Soccer");
    return t?.strBadge || t?.strTeamBadge || null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const name = (new URL(req.url).searchParams.get("name") ?? "").trim().slice(0, 80);
  if (name.length < 2) return Response.json({ url: null });
  const espn = await fromEspn(name);
  const url = espn ?? (await fromSportsDb(name)) ?? (key(name) !== name.toLowerCase() ? await fromSportsDb(tokens(name).join(" ")) : null);
  // Un échec n'est gardé qu'une heure, pour retenter vite si une source était momentanément indisponible.
  return Response.json(
    { url, source: espn ? "espn" : url ? "thesportsdb" : null },
    { headers: { "Cache-Control": url ? CACHE : "public, s-maxage=3600" } },
  );
}
