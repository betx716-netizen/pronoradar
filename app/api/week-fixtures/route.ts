import { demoFixtures } from "@/lib/demo";
import { fetchWeekFixtures } from "@/lib/espn";
import { isDemo } from "@/lib/http";
import { LEAGUES } from "@/lib/leagues";
import type { Fixture } from "@/lib/schemas";

export const runtime = "nodejs";

// Programme de football d'aujourd'hui à J+7 (heure de Paris), tous les championnats de l'application en une fois.
// Source gratuite et sans quota (ESPN). Les cotes sont récupérées plus tard, au moment de l'analyse.
export async function GET() {
  if (isDemo()) {
    const all: Fixture[] = [];
    const today = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    // Démo : un championnat sur deux joue aujourd'hui, les autres dans deux jours.
    const lists = await Promise.all(LEAGUES.football.slice(0, 6).map((l) => demoFixtures("football", l.name, () => {})));
    lists.forEach((fixtures, i) => all.push(...fixtures.map((f) => (i % 2 ? { ...f, date: today } : f))));
    return Response.json({ fixtures: all });
  }
  const fixtures = await fetchWeekFixtures();
  return Response.json({ fixtures }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" } });
}
