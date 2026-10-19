"use client";

import type { CouponLeg } from "@/lib/coupon";
import { isInSlip, toggleLeg, useSlip } from "@/lib/slip";

/** Bouton de cote cliquable, façon bookmaker : un toucher ajoute le pari au panier. */
export function OddsButton({ leg, label, sub, compact }: { leg: CouponLeg; label: string; sub?: string; compact?: boolean }) {
  const legs = useSlip();
  const on = isInSlip(legs, leg.match, leg.pick.selection);
  const estimated = leg.pick.oddsSource === "estimée";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleLeg(leg);
      }}
      aria-pressed={on}
      className={`odds-btn flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl border px-2 ${compact ? "py-1" : "py-1.5"} transition active:scale-95 ${
        on ? "border-accent bg-accent text-black shadow-lg shadow-accent/25" : "border-border bg-surface-3 hover:border-accent/60"
      }`}
    >
      <span className={`max-w-full truncate text-[10px] uppercase tracking-wide ${on ? "text-black/70" : "text-muted"}`}>{label}</span>
      <span className="text-sm font-bold tabular-nums">
        {estimated && <span className={on ? "" : "text-gold"}>◆ </span>}
        {leg.pick.odds.toFixed(2)}
      </span>
      {sub && <span className={`text-[10px] tabular-nums ${on ? "text-black/70" : "text-muted"}`}>{sub}</span>}
    </button>
  );
}
