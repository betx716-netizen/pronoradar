"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { PLANS, fcfa } from "@/lib/plans";
import { signOut } from "@/lib/session";
import { Icon } from "../Icon";
import { ThemeToggle } from "../ThemeToggle";
import { AdminPayments } from "./AdminPayments";
import { AdminNotifyTest } from "./AdminNotifyTest";
import { AdminReset } from "./AdminReset";
import { ChangePassword } from "./ChangePassword";
import { LoginForm } from "./LoginForm";
import { AdminDeleteAccount, DeleteMyAccount } from "./DeleteAccount";
import { ReferralCard } from "./Referral";
import { AdminDaily } from "./AdminDaily";
import { displayAccount } from "@/lib/phone";

type Me = {
  email: string;
  premium: boolean;
  premiumUntil: string | null;
  admin: boolean;
  payments: { id: string; plan: string; amount: number; status: string; created_at: string }[];
  referral?: { code: string; invited: number; rewarded: number };
};

let lastMe: { email: string; me: Me } | null = null;

/** Charge les informations du compte à l'avance (à l'ouverture de l'app), pour un « Mon compte » instantané. */
export function prefetchAccount(email: string) {
  if (lastMe?.email === email) return;
  api<Me>("/api/me")
    .then((m) => {
      lastMe = { email, me: m };
    })
    .catch(() => {});
}

const date = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
const STATUS: Record<string, string> = { accepted: "Payé", pending: "En attente", review: "En vérification", refused: "Refusé" };

/** Compte : connexion, offre en cours, renouvellement et historique des paiements. */
export function AccountView({ email, refreshKey, onUnlock }: { email: string | null; refreshKey: number; onUnlock: () => void }) {
  // Dernières informations connues du compte, affichées tout de suite à la réouverture, puis rafraîchies.
  const [me, setMe] = useState<Me | null>(() => (email && lastMe?.email === email ? lastMe.me : null));

  useEffect(() => {
    if (!email) return setMe(null);
    api<Me>("/api/me")
      .then((m) => {
        lastMe = { email, me: m };
        setMe(m);
      })
      .catch(() => {});
  }, [email, refreshKey]);

  if (!email) {
    return (
      <div className="mx-auto max-w-md rounded-3xl bg-surface p-5">
        <h2 className="mb-1 font-display text-3xl font-bold">Connexion</h2>
        <LoginForm defaultMode="login" intro="Ton numéro (ou ton email) et ton mot de passe te permettent de retrouver ton abonnement et ton suivi sur tous tes appareils." />
      </div>
    );
  }

  // Tant que l'offre n'est pas connue, on n'affiche pas « Gratuit » par erreur.
  if (!me)
    return (
      <div className="mx-auto max-w-md space-y-4">
        <div className="skeleton h-40 rounded-3xl" />
        <div className="skeleton h-24 rounded-3xl" />
      </div>
    );

  const premiumActive = me?.premium;
  return (
    <div className="mx-auto max-w-md space-y-4">
      <section className={`rounded-3xl p-5 ${premiumActive ? "bg-accent text-white" : "bg-surface"}`}>
        <p className={`text-[0.875rem] ${premiumActive ? "text-white/70" : "text-muted"}`}>{displayAccount(email)}</p>
        <div className="mt-1 flex items-center gap-2">
          {premiumActive && <Icon name="crown" className="h-6 w-6 text-accent" />}
          <h2 className="font-display text-3xl font-bold">{premiumActive ? "Premium" : "Gratuit"}</h2>
        </div>
        {premiumActive ? (
          <p className="mt-1 text-[0.9375rem] text-white/85">
            {me?.admin && !me.premiumUntil ? "Accès administrateur" : me?.premiumUntil ? `Actif jusqu'au ${date(me.premiumUntil)}` : "Actif"}
          </p>
        ) : (
          <p className="mt-1 text-[0.9375rem] text-muted">Tu vois le coupon sûr du jour et quelques pronostics.</p>
        )}
        {!(me?.admin && !me.premiumUntil) && (
        <button
          onClick={onUnlock}
          className={`mt-4 w-full rounded-full py-3 font-semibold ${premiumActive ? "bg-white text-accent" : "bg-accent text-white"}`}
        >
          {premiumActive ? "Prolonger mon abonnement" : `Passer en Premium dès ${fcfa(PLANS[0].price)}`}
        </button>
        )}
      </section>

      {me?.referral && <ReferralCard {...me.referral} />}

      {me?.admin && <AdminDaily />}
      {me?.admin && <AdminPayments />}
      {me?.admin && <AdminReset />}
      {me?.admin && <AdminNotifyTest />}
      {me?.admin && <AdminDeleteAccount />}

      {me && me.payments.length > 0 && (
        <section className="rounded-3xl bg-surface p-5">
          <h3 className="mb-3 font-display text-xl font-bold">Mes paiements</h3>
          <ul className="divide-y divide-border">
            {me.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5 text-[0.9375rem]">
                <span>
                  {PLANS.find((x) => x.id === p.plan)?.label ?? p.plan}
                  <span className="block text-[0.8125rem] text-muted">{date(p.created_at)}</span>
                </span>
                <span className="text-right">
                  <span className="font-display text-lg font-bold">{fcfa(p.amount)}</span>
                  <span className={`block text-[0.8125rem] ${p.status === "accepted" ? "text-success" : p.status === "refused" ? "text-danger" : "text-muted"}`}>
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
        <span className="rounded-full bg-accent">
          <ThemeToggle />
        </span>
      </section>

      <ChangePassword />

      <button onClick={() => signOut()} className="w-full rounded-full border-2 border-border py-3 font-semibold text-muted">
        Me déconnecter
      </button>

      {me && !me.admin && <DeleteMyAccount />}
    </div>
  );
}
