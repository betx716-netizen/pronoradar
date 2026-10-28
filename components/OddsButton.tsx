import type { CouponLeg } from "@/lib/coupon";

/** Affichage d'une cote façon bookmaker. */
export function OddsButton({ leg, label, sub, compact }: { leg: CouponLeg; label: string; sub?: string; compact?: boolean }) {
  const estimated = leg.pick.oddsSource === "estimée";
  return (
    <span className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl border border-border bg-surface-3 px-2 ${compact ? "py-1" : "py-1.5"}`}>
      <span className="max-w-full truncate text-[0.625rem] uppercase tracking-wide text-muted">{label}</span>
      <span className="text-sm font-bold tabular-nums">
        {estimated && <span className="text-gold">◆ </span>}
        {leg.pick.odds.toFixed(2)}
      </span>
      {sub && <span className="text-[0.625rem] tabular-nums text-muted">{sub}</span>}
    </span>
  );
}
