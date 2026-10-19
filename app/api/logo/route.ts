import { normalizeName } from "@/lib/teams";

export const runtime = "nodejs";

// Logo d'une équipe via TheSportsDB (gratuit, sans clé). Réponse mise en cache 30 jours par Vercel.
const CACHE = "public, s-maxage=2592000, stale-while-revalidate=604800";

type Team = { strTeam?: string; strAlternate?: string; strSport?: string; strBadge?: string | null; strTeamBadge?: string | null };

async function search(query: string): Promise<Team[]> {
  const res = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(query)}`, {
    next: { revalidate: 2592000 },
  });
  if (!res.ok) return [];
  return ((await res.json().catch(() => null))?.teams ?? []) as Team[];
}

export async function GET(req: Request) {
  const name = (new URL(req.url).searchParams.get("name") ?? "").trim().slice(0, 80);
  if (name.length < 2) return Response.json({ url: null });

  const wanted = normalizeName(name).join(" ");
  // Essais successifs : nom complet, puis nom simplifié (« Paris Saint Germain FC » → « paris saint germain »).
  for (const q of [...new Set([name, wanted])]) {
    try {
      const teams = (await search(q)).filter((t) => !t.strSport || t.strSport === "Soccer");
      const best =
        teams.find((t) => normalizeName(t.strTeam ?? "").join(" ") === wanted) ??
        teams.find((t) => (t.strAlternate ?? "").toLowerCase().includes(name.toLowerCase())) ??
        teams[0];
      const url = best?.strBadge || best?.strTeamBadge;
      if (url) return Response.json({ url: `${url}/small` }, { headers: { "Cache-Control": CACHE } });
    } catch {}
  }
  return Response.json({ url: null }, { headers: { "Cache-Control": CACHE } });
}
