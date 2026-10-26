import { fetchWeekFixtures } from "@/lib/espn";
import { isDemo } from "@/lib/http";
import { LEAGUES } from "@/lib/leagues";

export const runtime = "nodejs";

const parisDay = (d: Date) =>
  new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

// Nombre de matchs par championnat de football pour chaque jour, d'aujourd'hui à J+7 (heure de Paris),
// lu dans l'annuaire public d'ESPN (gratuit, sans quota). Les matchs en cours et terminés comptent.
// Sert à mettre en tête de liste les championnats qui jouent le jour choisi.
export async function GET() {
  const now = Date.now();
  const days = Array.from({ length: 8 }, (_, i) => parisDay(new Date(now + i * 86400000)));
  const byDay: Record<string, Record<string, number>> = Object.fromEntries(days.map((d) => [d, {}]));
  // Démo : comptes fictifs (aujourd'hui pour les championnats impairs, après-demain pour tous).
  if (isDemo()) {
    for (const [i, l] of LEAGUES.football.entries()) {
      for (const d of days) byDay[d][l.name] = 0;
      if (i % 2) byDay[days[0]][l.name] = 1 + (i % 3);
      byDay[days[2]][l.name] = 3; // demoFixtures renvoie 3 matchs dans 2 jours
    }
    return Response.json({ today: days[0], days: byDay, counts: byDay[days[0]] });
  }
  // Un jour par requête sur le programme « tous les championnats » (ESPN refuse désormais les plages de dates).
  for (const d of days) for (const l of LEAGUES.football) byDay[d][l.name] = 0;
  for (const f of await fetchWeekFixtures()) if (byDay[f.date]) byDay[f.date][f.competition] = (byDay[f.date][f.competition] ?? 0) + 1;
  return Response.json(
    { today: days[0], days: byDay, counts: byDay[days[0]] },
    { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" } },
  );
}
