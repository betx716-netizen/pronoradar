"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { MANUAL_PAYMENT, PLANS, PREMIUM_PERKS, fcfa, type ManualMethod, type PlanId } from "@/lib/plans";
import { loadConfig } from "@/lib/session";
import { displayAccount } from "@/lib/phone";
import { Icon } from "../Icon";
import { LoginForm } from "./LoginForm";
import { Sheet } from "./Sheet";

/**
 * Offres Premium et paiement. Mode principal : Mobile Money manuel (le client envoie l'argent sur le numéro
 * de PronoRadar puis saisit la référence, l'administrateur valide). CinetPay est proposé en plus s'il est configuré.
 */
export function Paywall({ signedIn, email, onClose }: { signedIn: boolean; email: string | null; onClose: () => void }) {
  const [plan, setPlan] = useState<PlanId>("mois");
  const [method, setMethod] = useState<ManualMethod>("wave");
  const [phone, setPhone] = useState(() => (displayAccount(email).startsWith("0") ? displayAccount(email) : ""));
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ reference: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [cinetpay, setCinetpay] = useState(false);
  const chosen = PLANS.find((p) => p.id === plan)!;
  const how = MANUAL_PAYMENT.methods.find((m) => m.id === method)!;

  useEffect(() => {
    loadConfig().then((c) => setCinetpay(Boolean(c.cinetpay)));
  }, []);

  // Connexion faite depuis cette fenêtre : le numéro du compte pré-remplit le numéro payeur.
  useEffect(() => {
    const own = displayAccount(email);
    if (own.startsWith("0")) setPhone((p) => p || own);
  }, [email]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/pay/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, method, reference, payerPhone: phone }),
      });
      setSent({ reference: reference.trim().toUpperCase() });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  }

  async function payOnline() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api<{ url: string }>("/api/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  function copyNumber() {
    navigator.clipboard?.writeText(MANUAL_PAYMENT.number.replace(/\s/g, "")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (sent) {
    const message = `Bonjour, je viens de payer PronoRadar Premium (${chosen.label}, ${fcfa(chosen.price)}) par ${how.label}. Référence : ${sent.reference}. Compte : ${displayAccount(email)}`;
    return (
      <Sheet title="Demande envoyée" onClose={onClose}>
        <div className="space-y-4 pb-2">
          <div className="flex gap-3 rounded-2xl bg-success-soft p-4 text-success">
            <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-[15px] leading-relaxed">
              Ton paiement de {fcfa(chosen.price)} est en vérification. Premium s&apos;active sur ton compte dès qu&apos;il est validé : tu n&apos;as rien d&apos;autre à faire.
            </p>
          </div>
          <p className="text-[15px] text-muted">Pour une activation plus rapide, préviens-nous sur WhatsApp :</p>
          <a
            href={`https://wa.me/${MANUAL_PAYMENT.whatsapp}?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-full bg-[#1f9d55] py-3.5 text-center font-semibold text-white"
          >
            Prévenir sur WhatsApp
          </a>
          <button onClick={onClose} className="w-full rounded-full border-2 border-border py-3 font-semibold">
            Fermer
          </button>
        </div>
      </Sheet>
    );
  }

  const input = "w-full rounded-2xl border-2 border-border bg-surface px-4 py-3 outline-none focus:border-accent";

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
            <label key={p.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 bg-surface px-4 py-3 transition ${on ? "border-accent" : "border-transparent"}`}>
              <input type="radio" name="plan" value={p.id} checked={on} onChange={() => setPlan(p.id)} className="sr-only" />
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-accent" : "border-border"}`}>
                {on && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
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
        {!signedIn ? (
          <div className="rounded-2xl bg-surface p-4">
            <p className="mb-3 font-semibold">Crée ton compte ou connecte-toi pour payer</p>
            <LoginForm intro="Ton abonnement sera lié à ton compte (numéro ou email) : tu le retrouves sur tous tes appareils." />
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 rounded-2xl bg-surface p-4">
            <div className="flex rounded-full bg-surface-3 p-1 text-[15px] font-semibold" role="radiogroup" aria-label="Moyen de paiement">
              {MANUAL_PAYMENT.methods.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  role="radio"
                  aria-checked={method === m.id}
                  onClick={() => setMethod(m.id)}
                  className={`flex-1 rounded-full py-2 ${method === m.id ? "bg-surface shadow-sm" : "text-muted"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <ol className="space-y-3 text-[15px]">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-white">1</span>
                <div className="flex-1">
                  <p>
                    Envoie <strong>{fcfa(chosen.price)}</strong> par {how.label} au
                  </p>
                  <button type="button" onClick={copyNumber} className="mt-1 flex w-full items-center justify-between rounded-xl bg-accent-soft px-3 py-2">
                    <span className="font-display text-2xl font-bold tracking-wide text-accent">{MANUAL_PAYMENT.number}</span>
                    <span className="text-[13px] font-semibold text-accent">{copied ? "Copié" : "Copier"}</span>
                  </button>
                  <p className="mt-1 text-[13px] text-muted">{how.hint}</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-white">2</span>
                <p className="flex-1">Garde le SMS de confirmation : il contient la référence de la transaction.</p>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-white">3</span>
                <p className="flex-1">Remplis ces deux champs et envoie ta demande.</p>
              </li>
            </ol>

            <label className="block">
              <span className="mb-1 block text-[14px] font-medium">Numéro qui a envoyé l&apos;argent</span>
              <input inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07 00 00 00 00" className={input} required />
            </label>
            <label className="block">
              <span className="mb-1 block text-[14px] font-medium">Référence de la transaction</span>
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex. MP251025.1302.A12345" className={input} autoCapitalize="characters" required />
            </label>
            {error && <p className="text-[14px] text-danger">{error}</p>}
            <button disabled={busy} className="w-full rounded-full bg-accent py-4 text-[17px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)] disabled:opacity-60">
              {busy ? "Envoi…" : "J'ai payé, activer mon Premium"}
            </button>
            {cinetpay && (
              <button type="button" onClick={payOnline} disabled={busy} className="w-full py-1 text-[14px] font-semibold text-accent">
                Ou payer en ligne (carte, Moov, MTN)
              </button>
            )}
          </form>
        )}
      </div>

      <p className="mt-5 pb-2 text-center text-[12px] leading-relaxed text-muted">
        Paiement unique, sans renouvellement automatique. Les pronostics sont des analyses, pas des garanties de gain. Jeu interdit aux moins de 18 ans.
      </p>
    </Sheet>
  );
}
