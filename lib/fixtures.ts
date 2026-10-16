import { emptyUsage, researchWithWeb, structure, todayInParis } from "./claude";
import { FixturesSchema, type Fixture, type Sport } from "./schemas";

const FIXTURES_SYSTEM = `Tu trouves le programme des prochains matchs d'une compétition sportive.
Cherche sur des sources fiables (site officiel de la compétition, L'Équipe, Flashscore, ATP/WTA…).
Liste uniquement les matchs à venir dans les 7 prochains jours, avec date et heure de Paris.
Pour le football, indique l'équipe qui reçoit en premier. N'invente aucun match.`;

export async function findFixtures(sport: Sport, competition: string, onProgress: (m: string) => void) {
  const usage = emptyUsage();
  const { dossier } = await researchWithWeb({
    system: FIXTURES_SYSTEM,
    prompt: `Nous sommes le ${todayInParis()}. Sport : ${sport}. Compétition : ${competition}. Quels sont les prochains matchs ?`,
    maxSearches: 5,
    effort: "medium",
    usage,
    onProgress,
  });
  const { fixtures } = await structure(
    FixturesSchema,
    "Convertis cette liste de matchs en JSON, sans rien inventer. Dates au format AAAA-MM-JJ.",
    dossier,
    usage,
  );
  return { fixtures: fixtures as Fixture[], usage };
}
