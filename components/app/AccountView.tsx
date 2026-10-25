"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { PLANS, fcfa } from "@/lib/plans";
import { signOut } from "@/lib/session";
import { Icon } from "../Icon";
import { ThemeToggle } from "../ThemeToggle";
import { AdminPayments } from "./AdminPayments";
import { LoginForm } from "./LoginForm";

type Me = {
  email: string;
  premium: boolean;
  premiumUntil: string | null;
  admin: boolean;
  payments: { id: string; plan: string; amount: number; status: string; created_at: string }[];
};

const date = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
const STATUS: Record<string, string> = { accepted: "Payé", pending: "En attente", review: "En vérification", refused: "Refusé" };

/** Compte : connexion, offre en cours, renouvellement et historique des paiements. */
export function AccountView({ email, refreshKey, onUnlock }: { email: string | null; refreshKey: number; onUnlock: () => void }) {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (!email) return setMe(null);
    api<Me>("/api/me").then(setMe).catch(() => setMe(null));
  }, [email, refreshKey]);

  if (!email) {
    return (
      <div className="mx-auto max-w-md rounded-3xl bg-surface p-5">
        <h2 className="mb-1 font-display text-3xl font-bold">Connexion</h2>
        <LoginForm intro="Connecte-toi pour retrouver ton abonnement et ton suivi des paris sur tous tes appareils." />
      </div>
    );
  }

  const premiumActive = me?.premium;
  return (
    <div className="mx-auto max-w-md space-y-4">
      <section className={`rounded-3xl p-5 ${premiumActive ? "bg-pitch text-white" : "bg-surface"}`}>
        <p className={`text-[14px] ${premiumActive ? "text-white/70" : "text-muted"}`}>{email}</p>
        <div className="mt-1 flex items-center gap-2">
          {premiumActive && <Icon name="crown" className="h-6 w-6 text-orange" />}
          <h2 className="font-display text-3xl font-bold">{premiumActive ? "Premium" : "Gratuit"}</h2>
        </div>
        {premiumActive ? (
          <p className="mt-1 text-[15px] text-white/85">
            {me?.admin && !me.premiumUntil ? "Accès administrateur" : me?.premiumUntil ? `Actif jusqu'au ${date(me.premiumUntil)}` : "Actif"}
          </p>
        ) : (
          <p className="mt-1 text-[15px] text-muted">Tu vois le coupon sûr du jour et quelques pronostics.</p>
        )}
        {!(me?.admin && !me.premiumUntil) && (
        <button
          onClick={onUnlock}
          className={`mt-4 w-full rounded-full py-3 font-semibold ${premiumActive ? "bg-white text-pitch" : "bg-orange text-white"}`}
        >
          {premiumActive ? "Prolonger mon abonnement" : `Passer en Premium dès ${fcfa(PLANS[0].price)}`}
        </button>
        )}
      </section>

      {me?.admin && <AdminPayments />}

      {me && me.payments.length > 0 && (
        <section className="rounded-3xl bg-surface p-5">
          <h3 className="mb-3 font-display text-xl font-bold">Mes paiements</h3>
          <ul className="divide-y divide-border">
            {me.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5 text-[15px]">
                <span>
                  {PLANS.find((x) => x.id === p.plan)?.label ?? p.plan}
                  <span className="block text-[13px] text-muted">{date(p.created_at)}</span>
                </span>
                <span className="text-right">
                  <span className="font-display text-lg font-bold">{fcfa(p.amount)}</span>
                  <span className={`block text-[13px] ${p.status === "accepted" ? "text-success" : p.status === "refused" ? "text-danger" : "text-muted"}`}>
                    {STATUS[p.status] ?? p.status}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex items-center justify-between rounded-3xl bg-surface p-5">
        <span className="font-medium">Thème clair ou sombre</span>
        <span className="rounded-full bg-pitch">
          <ThemeToggle />
        </span>
      </section>

      <button onClick={() => signOut()} className="w-full rounded-full border-2 border-border py-3 font-semibold text-muted">
        Me déconnecter
      </button>
    </div>
  );
}
