"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { PLANS, PREMIUM_PERKS, fcfa, type PlanId } from "@/lib/plans";
import { Icon } from "../Icon";
import { LoginForm } from "./LoginForm";
import { Sheet } from "./Sheet";

/** Offres Premium et paiement CinetPay. Demande d'abord la connexion si besoin. */
export function Paywall({ signedIn, onClose }: { signedIn: boolean; onClose: () => void }) {
  const [plan, setPlan] = useState<PlanId>("mois");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = PLANS.find((p) => p.id === plan)!;

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api<{ url: string }>("/api/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <Sheet title="Passe en Premium" onClose={onClose}>
      <ul className="mb-5 space-y-2.5">
        {PREMIUM_PERKS.map((perk) => (
          <li key={perk} className="flex gap-3 text-[15px] leading-snug">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Icon name="check" className="h-3.5 w-3.5" />
            </span>
            {perk}
          </li>
        ))}
      </ul>

      <fieldset className="space-y-2" aria-label="Choisis ta durée">
        {PLANS.map((p) => {
          const on = p.id === plan;
          return (
            <label
              key={p.id}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 bg-surface px-4 py-3 transition ${on ? "border-orange" : "border-transparent"}`}
            >
              <input type="radio" name="plan" value={p.id} checked={on} onChange={() => setPlan(p.id)} className="sr-only" />
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-orange" : "border-border"}`}>
                {on && <span className="h-2.5 w-2.5 rounded-full bg-orange" />}
              </span>
              <span className="flex-1">
                <span className="flex items-center gap-2 font-semibold">
                  {p.label}
                  {p.badge && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[12px] font-semibold text-accent">{p.badge}</span>}
                </span>
                <span className="text-[13px] text-muted">{p.perDay}</span>
              </span>
              <span className="font-display text-2xl font-bold">{fcfa(p.price)}</span>
            </label>
          );
        })}
      </fieldset>

      <div className="mt-5">
        {signedIn ? (
          <>
            {error && <p className="mb-2 text-[14px] text-danger">{error}</p>}
            <button onClick={pay} disabled={busy} className="w-full rounded-full bg-orange py-4 text-[17px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--orange)] disabled:opacity-60">
              {busy ? "Ouverture du paiement…" : `Payer ${fcfa(chosen.price)}`}
            </button>
            <p className="mt-3 text-center text-[13px] text-muted">Orange Money, MTN, Moov, Wave ou carte bancaire. Sans renouvellement automatique.</p>
          </>
        ) : (
          <div className="rounded-2xl bg-surface p-4">
            <p className="mb-3 font-semibold">Crée ton compte pour payer</p>
            <LoginForm intro="Ton abonnement sera lié à ton email : tu le retrouves sur tous tes appareils." />
          </div>
        )}
      </div>

      <p className="mt-5 pb-2 text-center text-[12px] leading-relaxed text-muted">
        Les pronostics sont des analyses, pas des garanties de gain. Jeu interdit aux moins de 18 ans.
      </p>
    </Sheet>
  );
}
