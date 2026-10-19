import { nameSimilarity, normalizeName } from "@/lib/teams";

export const runtime = "nodejs";

// Logo d'une équipe. Source principale : l'annuaire public des équipes d'ESPN (tous les grands championnats,
// une requête par championnat, gardée 7 jours). Repli : TheSportsDB. Réponse mise en cache 30 jours par Vercel.
const CACHE = "public, s-maxage=2592000, stale-while-revalidate=604800";

const ESPN_LEAGUES = [
  "uefa.champions", "uefa.europa", "uefa.europa.conf",
  "fra.1", "fra.2", "eng.1", "eng.2", "esp.1", "ita.1", "ger.1", "por.1", "ned.1", "bel.1", "tur.1", "sco.1",
];

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
  const wanted = normalizeName(name).join(" ");
  let best: { score: number; logo: string } | null = null;
  for (const e of await getDirectory()) {
    for (const n of e.names) {
      const score = normalizeName(n).join(" ") === wanted ? 2 : nameSimilarity(name, n);
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
  const url = espn ?? (await fromSportsDb(name));
  // Un échec n'est gardé qu'une heure, pour retenter vite si une source était momentanément indisponible.
  return Response.json(
    { url, source: espn ? "espn" : url ? "thesportsdb" : null },
    { headers: { "Cache-Control": url ? CACHE : "public, s-maxage=3600" } },
  );
}
