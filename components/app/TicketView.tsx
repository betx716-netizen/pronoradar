"use client";

import { useState } from "react";
import { CATEGORY_LABELS } from "@/lib/coupon";
import { addBet } from "@/lib/history";
import type { Ticket } from "@/lib/ticket";
import { Icon } from "../Icon";
import { repeats } from "./CouponTicket";

const odds = (n: number) => n.toFixed(2).replace(".", ",");
const money = (n: number) => `${new Intl.NumberFormat("fr-FR").format(Math.round(n))} F`;

/** « Mon ticket » : le combiné composé par l'utilisateur, avec mise et gain possible. */
export function TicketView({ ticket, premium, onBrowse, onUnlock }: { ticket: Ticket; premium: boolean; onBrowse: () => void; onUnlock: () => void }) {
  const [stake, setStake] = useState("1000");
  const [saved, setSaved] = useState(false);
  const amount = Number(stake) || 0;

  if (ticket.legs.length === 0) {
    return (
      <div className="ticket mx-auto mt-2 max-w-md px-6 py-10 text-center">
        <Icon name="ticket" className="mx-auto h-10 w-10 text-paper-muted" />
        <h2 className="mt-3 font-display text-3xl font-bold">Ton ticket est vide</h2>
        <p className="mx-auto mt-2 max-w-xs text-[15px] text-paper-muted">
          {premium
            ? "Ouvre un match et touche les paris proposés par l'IA pour composer ton combiné, ou touche « Modifier » sur un coupon du jour."
            : "Compose ton propre combiné à partir des paris de l'IA, match par match. C'est inclus dans Premium."}
        </p>
        <button onClick={premium ? onBrowse : onUnlock} className="mt-5 rounded-full bg-pitch px-6 py-3 font-semibold text-white">
          {premium ? "Voir les matchs du jour" : "Découvrir Premium"}
        </button>
      </div>
    );
  }

  return (
    <div className="ticket mx-auto max-w-md px-5 pb-7 pt-7">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-3xl font-bold">Mon ticket</h2>
        <button onClick={ticket.clear} className="text-[14px] font-medium text-paper-muted">
          Tout effacer
        </button>
      </div>
      <div className="ticket-rule my-4" />
      <ul className="space-y-3">
        {ticket.legs.map((l) => (
          <li key={l.matchId} className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-paper-muted">{l.match}</p>
              <p className="text-[15px] font-semibold leading-snug">
                {l.pick.selection}
                {!repeats(l.pick.selection, CATEGORY_LABELS[l.pick.category]) && (
                  <span className="font-normal text-paper-muted"> · {CATEGORY_LABELS[l.pick.category]}</span>
                )}
              </p>
            </div>
            <span className="font-display text-lg font-bold">{odds(l.pick.odds)}</span>
            <button onClick={() => ticket.remove(l.matchId)} aria-label={`Retirer ${l.match}`} className="mt-0.5 text-paper-muted">
              <Icon name="close" className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="ticket-rule my-4" />
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[13px] text-paper-muted">
            {ticket.legs.length} sélection{ticket.legs.length > 1 ? "s" : ""} · chance estimée {ticket.probability.toFixed(0)} %
          </p>
          <p className="text-[13px] text-paper-muted">Cote totale</p>
        </div>
        <p className="font-display text-5xl font-extrabold leading-none text-pitch">{odds(ticket.totalOdds)}</p>
      </div>
      <label className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-4 py-2">
        <span className="text-[14px] font-medium">Ma mise</span>
        <span className="flex items-center gap-1">
          <input
            inputMode="numeric"
            value={stake}
            onChange={(e) => setStake(e.target.value.replace(/\D/g, "").slice(0, 7))}
            className="w-24 bg-transparent text-right font-display text-2xl font-bold outline-none"
            aria-label="Mise en francs CFA"
          />
          <span className="font-semibold">F</span>
        </span>
      </label>
      <p className="mt-3 flex justify-between text-[15px]">
        <span>Gain possible</span>
        <strong className="font-display text-2xl">{money(amount * ticket.totalOdds)}</strong>
      </p>
      <button
        disabled={saved}
        onClick={() => {
          addBet({ profile: "Mon ticket", legs: ticket.legs, totalOdds: ticket.totalOdds, probability: ticket.probability, stake: amount });
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        }}
        className="mt-5 w-full rounded-full bg-pitch py-3.5 font-semibold text-white disabled:opacity-70"
      >
        {saved ? "Ajouté à mon suivi" : "Je l'ai joué"}
      </button>
      <p className="mt-3 text-center text-[12px] text-paper-muted">Recopie ces sélections chez ton bookmaker. Joue une somme que tu peux perdre.</p>
    </div>
  );
}
