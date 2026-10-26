import { SLUGS, scoreboardUrl, ymd } from "@/lib/espn";
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
  // Hier à J+8 en UTC : couvre ces 8 journées de Paris quel que soit le décalage horaire.
  const range = `${ymd(new Date(now - 86400000))}-${ymd(new Date(now + 8 * 86400000))}`;
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
  await Promise.all(
    LEAGUES.football
      .filter((l) => SLUGS[l.name])
      .map(async (l) => {
        try {
          // Délai maximal : un championnat lent ne doit pas retarder toute la liste.
          const res = await fetch(scoreboardUrl(SLUGS[l.name], range), { next: { revalidate: 1800 }, signal: AbortSignal.timeout(6000) });
          if (!res.ok) return;
          const events: { date?: string }[] = (await res.json())?.events ?? [];
          for (const d of days) byDay[d][l.name] = 0;
          for (const e of events) {
            if (!e.date) continue;
            const d = parisDay(new Date(e.date));
            if (byDay[d]) byDay[d][l.name] += 1;
          }
        } catch {
          // Championnat injoignable : absent des comptes, il garde sa place habituelle dans la liste.
        }
      }),
  );
  return Response.json(
    { today: days[0], days: byDay, counts: byDay[days[0]] },
    { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" } },
  );
}
