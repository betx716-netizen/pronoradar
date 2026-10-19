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
