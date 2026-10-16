import type { ApiFootballInsight } from "./apifootball";
import type { AnalyzeRequest, Source } from "./schemas";

export function emptySource(partial: Partial<Source> & Pick<Source, "name" | "type" | "pick">): Source {
  return {
    url: "",
    prob_home: null,
    prob_draw: null,
    prob_away: null,
    odds_home: null,
    odds_draw: null,
    odds_away: null,
    other_tips: [],
    reasoning: "",
    published: null,
    ...partial,
  };
}

// Sources « fiables » venues des API, ajoutées telles quelles à la liste des pronostics.
export function apiSources(req: AnalyzeRequest, insight: ApiFootballInsight | null): Source[] {
  const sources: Source[] = [];
  const tennis = req.sport === "tennis";
  const o = req.odds;
  if (o) {
    sources.push(
      emptySource({
        name: o.bookmakers > 1 ? `Moyenne de ${o.bookmakers} bookmakers` : "Bookmaker",
        type: "bookmaker",
        pick: "none",
        url: "https://the-odds-api.com",
        odds_home: o.home,
        odds_draw: tennis ? null : o.draw,
        odds_away: o.away,
        reasoning: "Cotes relevées par The Odds API au moment de la recherche des matchs.",
      }),
    );
    if (o.exchange) {
      sources.push(
        emptySource({
          name: o.exchange.name,
          type: "exchange",
          pick: "none",
          url: "https://the-odds-api.com",
          odds_home: o.exchange.home,
          odds_draw: tennis ? null : o.exchange.draw,
          odds_away: o.exchange.away,
          reasoning: "Bourse de paris : cotes fixées par les parieurs eux-mêmes, sans marge du bookmaker.",
        }),
      );
    }
  }
  if (insight) {
    const tips = [insight.advice, insight.underOver ? `Buts : ${insight.underOver}` : null].filter((t): t is string => Boolean(t));
    sources.push(
      emptySource({
        name: "API-Football (modèle statistique)",
        type: "stats_model",
        pick: "none",
        url: "https://www.api-football.com",
        prob_home: insight.percent.home,
        prob_draw: insight.percent.draw,
        prob_away: insight.percent.away,
        other_tips: tips,
        reasoning: insight.winner ? `Vainqueur prédit : ${insight.winner}.` : "Pas de vainqueur net prédit.",
      }),
    );
  }
  return sources;
}
