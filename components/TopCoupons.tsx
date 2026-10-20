"use client";

import { useEffect, useState } from "react";
import { loadAiCoupons, type Built } from "./AiCoupons";
import { ScrollRow } from "./ScrollRow";

/** Carrousel des coupons de l'IA sur l'accueil, classés du plus sûr au plus coté. */
export function TopCoupons({ onOpen, refreshKey }: { onOpen: () => void; refreshKey: number }) {
  const [coupons, setCoupons] = useState<Built[]>([]);
  useEffect(() => {
    const refresh = () => {
      const saved = loadAiCoupons();
      const odds = (c: Built) => c.legs.reduce((t, l) => t * l.pick.odds, 1);
      setCoupons((saved?.coupons ?? []).filter((c) => c.legs.length).sort((a, b) => odds(a) - odds(b)));
    };
    refresh();
    // Mis à jour dès que l'IA génère ou qu'on supprime des coupons.
    window.addEventListener("pronoradar-coupons", refresh);
    return () => window.removeEventListener("pronoradar-coupons", refresh);
  }, [refreshKey]);

  if (coupons.length === 0) return null;

  const card = (c: Built, i: number, mobile: boolean) => {
    const odds = c.legs.reduce((t, l) => t * l.pick.odds, 1);
    return (
      <button
        key={c.profile}
        onClick={onOpen}
        className={`flex flex-col overflow-hidden rounded-3xl border border-border bg-surface text-left shadow-sm transition active:scale-[0.98] ${
          mobile ? "w-72 shrink-0 snap-start" : "h-full"
        }`}
      >
        <div className="flex items-center justify-between bg-[#0f172a] px-4 py-2 text-white">
          <span className="font-display text-3xl leading-none text-accent">#{i + 1}</span>
          <span className="text-xs font-semibold text-white/70">
            {c.legs.length} sélection{c.legs.length > 1 ? "s" : ""}
          </span>
        </div>
        <ul className="flex-1 divide-y divide-border">
          {c.legs.slice(0, 4).map((l) => (
            <li key={l.match} className="px-4 py-2">
              <p className="truncate text-[11px] text-muted">{l.match}</p>
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 break-words text-sm font-semibold leading-snug">{l.pick.selection}</p>
                <span className="shrink-0 font-bold tabular-nums">{l.pick.odds.toFixed(2)}</span>
              </div>
            </li>
          ))}
          {c.legs.length > 4 && <li className="px-4 py-1.5 text-xs text-muted">+ {c.legs.length - 4} autres sélections</li>}
        </ul>
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
          <span className="text-xs font-semibold uppercase text-muted">Cote totale</span>
          <span className="rounded-xl bg-accent px-3 py-1 font-display text-2xl leading-none text-on-accent tabular-nums">{odds.toFixed(2)}</span>
        </div>
      </button>
    );
  };

  return (
    <section className="mb-6">
      <h2 className="mb-2 font-display text-3xl leading-none">Top des coupons</h2>
      {/* Téléphone : carrousel à faire glisser. Ordinateur : grille de cartes de même hauteur. */}
      <div className="sm:hidden">
        <ScrollRow className="-mx-4 snap-x snap-mandatory items-stretch gap-3 px-4 pb-2">{coupons.map((c, i) => card(c, i, true))}</ScrollRow>
      </div>
      <div className="hidden grid-cols-2 gap-4 sm:grid lg:grid-cols-3">{coupons.map((c, i) => card(c, i, false))}</div>
    </section>
  );
}
