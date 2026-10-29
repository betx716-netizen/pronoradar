// Importance d'un match pour le moteur du jour : quand il y a plus de matchs que d'analyses possibles,
// on garde les plus suivis (compétition, grandes équipes) plutôt que l'ordre de la liste des championnats.
import { sameTeam } from "./settle";

// Niveau de la compétition (plus c'est haut, plus elle passe tôt).
const TIERS: [number, string[]][] = [
  [100, ["Ligue des Champions"]],
  [90, ["Ligue Europa", "Ligue 1", "Premier League", "LaLiga", "Serie A", "Bundesliga"]],
  [80, ["Ligue Conférence"]],
  // Coupes nationales : premiers tours pleins de petits clubs ; les grands clubs y remontent grâce à leur bonus.
  [62, ["Coupe d'Allemagne", "Coupe de France", "Coupe d'Italie", "Coupe du Roi (Espagne)", "FA Cup (Angleterre)", "Coupe de la Ligue anglaise"]],
  [65, ["Liga Portugal", "Eredivisie", "Jupiler Pro League (Belgique)", "Süper Lig (Turquie)", "Premiership (Écosse)", "Coupe du Portugal", "Coupe des Pays-Bas"]],
  [50, ["Super League (Suisse)", "Bundesliga (Autriche)", "Super League (Grèce)", "Superliga (Danemark)", "Ekstraklasa (Pologne)", "Allsvenskan (Suède)", "Eliteserien (Norvège)"]],
  [40, ["Ligue 2", "Championship (Angleterre)", "LaLiga 2", "Serie B", "2. Bundesliga"]],
];
const tierOf = (competition: string) => TIERS.find(([, names]) => names.includes(competition))?.[0] ?? 45;

// Clubs très suivis : leur match remonte, même en coupe contre un petit club.
const BIG_CLUBS = [
  "Paris Saint-Germain", "Marseille", "Lyon", "Monaco", "Lille",
  "Real Madrid", "Barcelona", "Atletico Madrid",
  "Manchester City", "Manchester United", "Liverpool", "Arsenal", "Chelsea", "Tottenham",
  "Bayern Munich", "Borussia Dortmund", "Bayer Leverkusen", "RB Leipzig",
  "Inter Milan", "AC Milan", "Juventus", "Napoli", "AS Roma",
  "Benfica", "Porto", "Sporting CP", "Ajax", "PSV Eindhoven", "Galatasaray", "Fenerbahce", "Celtic",
];
const isBig = (team: string) => BIG_CLUBS.some((c) => sameTeam(c, team));

/** Score d'importance d'un match : compétition, grandes équipes, puis présence de cotes (analyse plus fiable). */
export function matchPriority(f: { competition: string; home: string; away: string; odds?: unknown }) {
  const big = Number(isBig(f.home)) + Number(isBig(f.away));
  return tierOf(f.competition) + big * 15 + (f.odds ? 5 : 0);
}
