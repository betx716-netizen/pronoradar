"use client";

import { LeagueLogo } from "./LeagueLogo";
import { ScrollRow } from "./ScrollRow";

/**
 * Choix des championnats pour les analyses et les coupons : « Tous », ou un ou plusieurs championnats.
 * Le nombre de matchs analysés est affiché pour chacun.
 */
export function LeagueFilter({
  counts,
  selected,
  onChange,
}: {
  counts: Record<string, number>;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const names = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  if (names.length < 2) return null;
  const all = selected.length === 0;
  const toggle = (n: string) => onChange(selected.includes(n) ? selected.filter((x) => x !== n) : [...selected, n]);
  const chip = (active: boolean) =>
    `flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${active ? "border-accent bg-accent text-on-accent" : "border-border bg-surface text-muted"}`;
  return (
    <div className="mb-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Championnats</p>
      <ScrollRow className="gap-2">
        <button onClick={() => onChange([])} className={chip(all)}>
          Tous
        </button>
        {names.map((n) => (
          <button key={n} onClick={() => toggle(n)} className={chip(selected.includes(n))}>
            <LeagueLogo name={n} size={16} />
            {n}
            <span className="text-xs opacity-75">{counts[n]}</span>
          </button>
        ))}
      </ScrollRow>
    </div>
  );
}
