"use client";

import type { AnalysisResult } from "@/lib/schemas";
import { edge, isValueBet } from "@/lib/value";
import { OddsButton } from "./OddsButton";
import { ScrollRow } from "./ScrollRow";

/** Bandeau défilant des meilleurs paris du moment : value bets d'abord, puis les plus probables à cote intéressante. */
export function TopPicks({ results, onOpen }: { results: AnalysisResult[]; onOpen: (r: AnalysisResult) => void }) {
  const items = results
    .flatMap((r) =>
      (r.picks ?? [])
        .filter((p) => p.odds >= 1.3 && p.probability >= 45)
        .map((p) => ({ r, p, score: (isValueBet(p) ? 100 : 0) + (edge(p) ?? 0) + p.probability * Math.log(p.odds) })),
    )
    .sort((a, b) => b.score - a.score)
    // Un seul pari par match dans le bandeau.
    .filter((x, i, all) => all.findIndex((y) => y.r === x.r) === i)
    .slice(0, 10);

  if (items.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide">🔥 Les meilleurs paris du moment</h2>
        <span className="text-xs text-muted">Touchez un match pour voir l&apos;analyse</span>
      </div>
      <ScrollRow className="-mx-4 snap-x snap-mandatory gap-3 px-4 pb-2 sm:mx-0 sm:px-12">
        {items.map(({ r, p }) => {
          const match = `${r.analysis.match.home} – ${r.analysis.match.away}`;
          const value = isValueBet(p);
          return (
            <article
              key={match}
              className={`fade-in relative w-64 shrink-0 snap-start overflow-hidden rounded-2xl border p-3.5 ${
                value ? "border-accent/60 bg-gradient-to-br from-accent-soft to-surface" : "border-border bg-surface"
              }`}
            >
              {value && (
                <span className="absolute right-3 top-3 rounded-full bg-accent px-2 py-0.5 text-[10px] font-black text-on-accent">VALUE +{edge(p)!.toFixed(0)} %</span>
              )}
              <button onClick={() => onOpen(r)} className="block w-full pr-16 text-left">
                <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted">{r.analysis.match.competition}</p>
                <p className="truncate font-semibold">{match}</p>
              </button>
              <p className="mt-2 truncate text-sm">{p.selection}</p>
              <div className="mt-1 mb-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full bg-accent" style={{ width: `${p.probability}%` }} />
              </div>
              <OddsButton leg={{ match, competition: r.analysis.match.competition, date: r.analysis.match.date, pick: p }} label={`${p.probability.toFixed(0)} % de chances`} />
            </article>
          );
        })}
      </ScrollRow>
    </section>
  );
}
