"use client";

import { CATEGORY_LABELS } from "@/lib/coupon";
import type { MarketCategory, MarketPick } from "@/lib/schemas";

const ORDER: MarketCategory[] = ["resultat", "double_chance", "buts", "les_deux_marquent", "corners", "fautes", "cartons", "sets", "jeux"];

function probColor(p: number) {
  return p >= 70 ? "bg-accent" : p >= 55 ? "bg-gold" : "bg-draw";
}

/** Tous les paris d'un match, regroupés par marché, avec probabilité, cote et origine de la donnée. */
export function MarketsPanel({ picks }: { picks: MarketPick[] }) {
  const groups = ORDER.map((c) => [c, picks.filter((p) => p.category === c)] as const).filter(([, list]) => list.length);
  if (groups.length === 0) return null;
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Marchés analysés</h3>
        <p className="text-xs text-muted">
          <span className="text-accent">●</span> cote bookmaker · <span className="text-gold">◆</span> cote estimée par l&apos;IA
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map(([category, list]) => (
          <div key={category} className="rounded-xl bg-surface-2 p-3">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{CATEGORY_LABELS[category]}</h4>
            <ul className="space-y-2.5">
              {[...list]
                .sort((a, b) => b.probability - a.probability)
                .map((p) => (
                  <li key={p.selection} title={p.reasoning || undefined}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">{p.selection}</span>
                      <span className="shrink-0 tabular-nums">
                        <strong>{p.probability.toFixed(0)} %</strong>
                        <span className={`ml-2 rounded-md px-1.5 py-0.5 text-xs ${p.oddsSource === "bookmaker" ? "bg-accent-soft text-accent" : "bg-gold-soft text-gold"}`}>
                          {p.oddsSource === "bookmaker" ? "●" : "◆"} {p.odds.toFixed(2)}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <div className={`h-full ${probColor(p.probability)}`} style={{ width: `${p.probability}%` }} />
                    </div>
                    {p.reasoning && p.category !== "resultat" && <p className="mt-1 text-xs text-muted">{p.reasoning}</p>}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Corners, fautes et cartons : estimations de l&apos;IA à partir des moyennes des équipes, aucun bookmaker gratuit ne les fournit.
      </p>
    </section>
  );
}
