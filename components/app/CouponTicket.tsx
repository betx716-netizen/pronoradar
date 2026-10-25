"use client";

import { useState } from "react";
import { CATEGORY_LABELS } from "@/lib/coupon";
import { addBet } from "@/lib/history";
import type { CouponCard } from "@/lib/view";
import { Icon } from "../Icon";

const odds = (n: number) => n.toFixed(2).replace(".", ",");
/** Vrai si le pari nomme déjà son marché (« … (remboursé si nul) », « Plus de 2,5 buts »…). */
export const repeats = (selection: string, market: string) => {
  const s = selection.toLowerCase();
  return market.toLowerCase().split(/[\s/+]+/).filter((w) => w.length > 3).some((w) => s.includes(w));
};

// Lignes factices affichées floues sur un coupon verrouillé : le vrai contenu n'est jamais envoyé.
const FAKE = ["Équipe A – Équipe B", "Club C – Club D", "Équipe E – Équipe F", "Club G – Club H", "Équipe I – Équipe J"];

/** Un coupon du jour, présenté comme un ticket papier. */
export function CouponTicket({
  coupon,
  onUnlock,
  onCopy,
  onOpenMatch,
  delay = 0,
}: {
  coupon: CouponCard;
  onUnlock: () => void;
  onCopy: () => void;
  onOpenMatch: (id: string) => void;
  delay?: number;
}) {
  const [played, setPlayed] = useState(false);

  return (
    <article className="ticket deal flex w-[84vw] max-w-[340px] shrink-0 snap-center flex-col px-5 pb-6 pt-6 sm:w-[340px]" style={{ animationDelay: `${delay}ms` }}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-paper-muted">{coupon.subtitle}</p>
          <h3 className="font-display text-[28px] font-bold leading-none">{coupon.title}</h3>
        </div>
        <div className="text-right">
          <p className="text-[13px] font-medium text-paper-muted">Cote totale</p>
          <p className="font-display text-[40px] font-extrabold leading-[0.9] text-pitch">{odds(coupon.totalOdds)}</p>
        </div>
      </header>

      <div className="ticket-rule my-4" />

      {coupon.locked ? (
        <div className="relative flex-1">
          <ul className="locked-blur space-y-3" aria-hidden>
            {FAKE.slice(0, Math.min(coupon.legsCount, 5)).map((m) => (
              <li key={m} className="flex justify-between text-[15px]">
                <span>{m}</span>
                <span className="font-display font-bold">1,85</span>
              </li>
            ))}
          </ul>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <p className="text-[15px] font-semibold">
              {coupon.legsCount} sélection{coupon.legsCount > 1 ? "s" : ""} choisies par l&apos;IA
            </p>
            <button onClick={onUnlock} className="inline-flex items-center gap-2 rounded-full bg-orange px-5 py-2.5 font-semibold text-white shadow-[0_6px_16px_-6px_var(--orange)] active:scale-95">
              <Icon name="lock" className="h-4 w-4" />
              Débloquer avec Premium
            </button>
          </div>
        </div>
      ) : (
        <>
          <ul className="flex-1 space-y-3">
            {coupon.legs.map((l) => (
              <li key={l.match}>
                <button onClick={() => onOpenMatch(l.matchId)} className="w-full text-left">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[13px] text-paper-muted">{l.match}</span>
                    <span className="font-display text-lg font-bold">{odds(l.pick.odds)}</span>
                  </div>
                  <p className="text-[15px] font-semibold leading-snug">
                    {l.pick.selection}
                    {!repeats(l.pick.selection, CATEGORY_LABELS[l.pick.category]) && (
                      <span className="font-normal text-paper-muted"> · {CATEGORY_LABELS[l.pick.category]}</span>
                    )}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          {coupon.comment && <p className="mt-4 text-[14px] leading-relaxed text-paper-muted">{coupon.comment}</p>}
          <div className="ticket-rule my-4" />
          <dl className="grid grid-cols-2 gap-3 text-[13px] text-paper-muted">
            <div>
              <dt>Chance estimée</dt>
              <dd className="font-display text-xl font-bold text-paper-ink">{coupon.probability.toFixed(0)} %</dd>
            </div>
            <div className="text-right">
              <dt>Mise conseillée</dt>
              <dd className="font-display text-xl font-bold text-paper-ink">
                {coupon.stakePercent} % <span className="font-sans text-[13px] font-normal text-paper-muted">de ta cagnotte</span>
              </dd>
            </div>
          </dl>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={onCopy} className="rounded-full border-2 border-pitch px-3 py-2 text-[14px] font-semibold text-pitch active:scale-95">
              Modifier
            </button>
            <button
              disabled={played}
              onClick={() => {
                addBet({ profile: coupon.title, legs: coupon.legs, totalOdds: coupon.totalOdds, probability: coupon.probability, stake: 0 });
                setPlayed(true);
              }}
              className="rounded-full bg-pitch px-3 py-2 text-[14px] font-semibold text-white active:scale-95 disabled:opacity-70"
            >
              {played ? "Ajouté au suivi" : "Je l'ai joué"}
            </button>
          </div>
        </>
      )}
    </article>
  );
}
