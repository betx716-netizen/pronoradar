import { apiFootballRemaining, attachApiFootballIds, fetchApiFootballFixtures, hasApiFootball } from "./apifootball";
import { emptyUsage, researchWithGoogle, structure, todayInParis } from "./gemini";
import { findLeague } from "./leagues";
import { fetchOddsFixtures, hasOddsApi } from "./odds";
import { FixturesSchema, type Fixture, type Sport } from "./schemas";

const FIXTURES_SYSTEM = `Tu trouves le programme des prochains matchs d'une compétition sportive.
Cherche sur des sources fiables (site officiel de la compétition, L'Équipe, Flashscore, ATP/WTA…).
Liste uniquement les matchs à venir dans les 7 prochains jours, avec date et heure de Paris.
Pour le football, indique l'équipe qui reçoit en premier. N'invente aucun match.`;

/**
 * Prochains matchs d'un championnat. Ordre de préférence :
 * The Odds API (matchs + cotes), sinon API-Football, sinon recherche Google via Gemini.
 * Au football, chaque match reçoit aussi son identifiant API-Football.
 */
export async function findFixtures(sport: Sport, competition: string, onProgress: (m: string) => void) {
  const usage = emptyUsage();
  const league = findLeague(sport, competition);
  const notes: string[] = [];
  let fixtures: Fixture[] | null = null;

  if (league?.oddsKey && hasOddsApi()) {
    try {
      const r = await fetchOddsFixtures(sport, competition, league.oddsKey);
      usage.oddsRequestsRemaining = r.remaining;
      if (r.covered) fixtures = r.fixtures;
    } catch (e) {
      notes.push(e instanceof Error ? e.message : String(e));
    }
  }

  if (sport === "football" && league?.apiFootballId && hasApiFootball()) {
    try {
      fixtures = fixtures
        ? await attachApiFootballIds(fixtures, league.apiFootballId)
        : await fetchApiFootballFixtures(league.apiFootballId, competition);
    } catch (e) {
      notes.push(e instanceof Error ? e.message : String(e));
    }
    usage.apiFootballRequestsRemaining = apiFootballRemaining();
  }

  if (!fixtures) {
    onProgress("Recherche du programme sur Google…");
    const { text } = await researchWithGoogle({
      system: FIXTURES_SYSTEM,
      prompt: `Nous sommes le ${todayInParis()}. Sport : ${sport}. Compétition : ${competition}. Quels sont les prochains matchs ?`,
      usage,
      onProgress,
    });
    const parsed = await structure(
      FixturesSchema,
      "Convertis cette liste de matchs en JSON, sans rien inventer. Dates au format AAAA-MM-JJ.",
      text,
      usage,
      onProgress,
    );
    fixtures = parsed.fixtures.map((f) => ({ ...f, competition, odds: null, apiFootballId: null }));
  }

  return { fixtures, usage, notes };
}
