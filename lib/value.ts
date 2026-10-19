// Value bet : la probabilité estimée dépasse celle que sous-entend la cote du bookmaker.
// Seules les cotes réelles comptent : une cote « estimée » est calculée à partir de la probabilité, donc sans écart possible.
import type { MarketPick } from "./schemas";

export const MIN_EDGE = 3; // % d'avantage minimum pour signaler un value bet

/** Avantage espéré en % (probabilité × cote − 1), ou null si la cote n'est pas celle d'un bookmaker. */
export function edge(pick: MarketPick): number | null {
  if (pick.oddsSource !== "bookmaker" || pick.category === "rembourse") return null;
  return Math.round(((pick.probability / 100) * pick.odds - 1) * 1000) / 10;
}

export const isValueBet = (pick: MarketPick) => (edge(pick) ?? -1) >= MIN_EDGE;

/** Mise conseillée (Kelly au quart, plafonnée à 5 % de la bankroll) pour une cote et une probabilité données. */
export function kellyStake(bankroll: number, probability: number, odds: number): number {
  const p = probability / 100;
  const b = odds - 1;
  if (b <= 0 || bankroll <= 0) return 0;
  const fraction = Math.max(0, (p * b - (1 - p)) / b) / 4;
  return Math.round(bankroll * Math.min(fraction, 0.05) * 100) / 100;
}
