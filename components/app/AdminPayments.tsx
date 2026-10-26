"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminPayment } from "@/app/api/admin/payments/route";
import { api } from "@/lib/client";
import { PLANS, fcfa } from "@/lib/plans";
import { displayAccount } from "@/lib/phone";

const when = (iso: string) =>
  iso ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" }).format(new Date(iso)) : "";

/**
 * Administrateur : demandes de paiement Mobile Money à valider. Compare la référence et le montant
 * avec les SMS reçus sur ton téléphone avant de valider.
 */
export function AdminPayments() {
  const [list, setList] = useState<AdminPayment[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(() => {
    api<{ payments: AdminPayment[] }>("/api/admin/payments")
      .then((d) => setList(d.payments))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function act(id: string, action: "approve" | "reject") {
    if (action === "reject" && !window.confirm("Refuser ce paiement ? Le client ne sera pas activé.")) return;
    setBusy(id);
    setError(null);
    try {
      await api("/api/admin/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(null);
  }

  const pending = (list ?? []).filter((p) => p.status === "review");
  const done = (list ?? []).filter((p) => p.status !== "review");

  return (
    <section className="rounded-3xl border-2 border-accent bg-surface p-5">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="font-display text-2xl font-bold">Paiements à valider</h3>
        <span className="font-display text-2xl font-bold text-accent">{pending.length}</span>
      </div>
      <p className="mb-4 text-[14px] text-muted">Vérifie la référence et le montant dans tes SMS Wave ou Orange Money avant de valider.</p>
      {error && <p className="mb-3 text-[14px] text-danger">{error}</p>}
      {!list && <div className="skeleton h-24 rounded-2xl" />}
      {list && pending.length === 0 && <p className="rounded-2xl bg-surface-2 p-4 text-center text-[15px] text-muted">Aucune demande en attente.</p>}
      <ul className="space-y-3">
        {pending.map((p) => (
          <li key={p.id} className="rounded-2xl bg-surface-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.email ? displayAccount(p.email) : "Compte inconnu"}</p>
                <p className="text-[13px] text-muted">
                  {PLANS.find((x) => x.id === p.plan)?.label ?? p.plan} · {p.method} · {when(p.created_at)}
                </p>
              </div>
              <p className="shrink-0 whitespace-nowrap font-display text-2xl font-bold">{fcfa(p.amount)}</p>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-[14px]">
              <div>
                <dt className="text-[12px] text-muted">Référence</dt>
                <dd className="break-all font-semibold">{p.reference}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">Envoyé depuis</dt>
                <dd className="font-semibold">{p.payer_phone}</dd>
              </div>
            </dl>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button disabled={busy === p.id} onClick={() => act(p.id, "reject")} className="rounded-full border-2 border-border py-2.5 font-semibold text-muted disabled:opacity-50">
                Refuser
              </button>
              <button disabled={busy === p.id} onClick={() => act(p.id, "approve")} className="rounded-full bg-accent py-2.5 font-semibold text-white disabled:opacity-50">
                {busy === p.id ? "…" : "Valider"}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {done.length > 0 && (
        <div className="mt-4">
          <button onClick={() => setShowAll(!showAll)} className="text-[14px] font-semibold text-accent">
            {showAll ? "Masquer l'historique" : `Voir l'historique (${done.length})`}
          </button>
          {showAll && (
            <ul className="mt-2 divide-y divide-border text-[14px]">
              {done.map((p) => (
                <li key={p.id} className="flex justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">
                    {displayAccount(p.email)} · {p.reference}
                  </span>
                  <span className={p.status === "accepted" ? "text-success" : "text-danger"}>{p.status === "accepted" ? "Validé" : "Refusé"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
