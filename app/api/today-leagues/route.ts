import { espnCovers, fetchEspnFixtures } from "@/lib/espn";
import { LEAGUES } from "@/lib/leagues";

export const runtime = "nodejs";

// Nombre de matchs du jour pour chaque championnat de football, lu dans l'annuaire public d'ESPN
// (gratuit, sans quota) : sert à mettre en tête de liste les championnats qui jouent aujourd'hui.
export async function GET() {
  const today = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const entries = await Promise.all(
    LEAGUES.football
      .filter((l) => espnCovers(l.name))
      .map(async (l) => {
        try {
          const fixtures = await fetchEspnFixtures(l.name);
          return [l.name, fixtures.filter((f) => f.date === today).length] as const;
        } catch {
          return [l.name, null] as const;
        }
      }),
  );
  return Response.json(
    { day: today, counts: Object.fromEntries(entries.filter(([, n]) => n !== null)) },
    { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=1800" } },
  );
}
