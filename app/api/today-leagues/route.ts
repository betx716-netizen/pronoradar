import { SLUGS, scoreboardUrl, ymd } from "@/lib/espn";
import { LEAGUES } from "@/lib/leagues";

export const runtime = "nodejs";

const parisDay = (d: Date) =>
  new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

// Nombre de matchs du jour (heure de Paris) pour chaque championnat de football, lu dans l'annuaire public d'ESPN
// (gratuit, sans quota). Compte aussi les matchs en cours et déjà terminés : un championnat qui a joué l'après-midi
// reste « championnat du jour » le soir. Sert à mettre ces championnats en tête de liste.
export async function GET() {
  const now = Date.now();
  const today = parisDay(new Date(now));
  // Hier à demain en UTC : couvre toute la journée de Paris quel que soit le décalage horaire.
  const range = `${ymd(new Date(now - 86400000))}-${ymd(new Date(now + 86400000))}`;
  const entries = await Promise.all(
    LEAGUES.football
      .filter((l) => SLUGS[l.name])
      .map(async (l) => {
        try {
          // Délai maximal : un championnat lent ne doit pas retarder toute la liste.
          const res = await fetch(scoreboardUrl(SLUGS[l.name], range), { next: { revalidate: 1800 }, signal: AbortSignal.timeout(6000) });
          if (!res.ok) return [l.name, null] as const;
          const events: { date?: string }[] = (await res.json())?.events ?? [];
          return [l.name, events.filter((e) => e.date && parisDay(new Date(e.date)) === today).length] as const;
        } catch {
          return [l.name, null] as const;
        }
      }),
  );
  return Response.json(
    { day: today, counts: Object.fromEntries(entries.filter(([, n]) => n !== null)) },
    { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" } },
  );
}
