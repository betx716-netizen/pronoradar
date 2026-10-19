"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABELS } from "@/lib/coupon";
import { loadHistory, profit, removeBet, syncHistory, updateBet, type BetStatus, type SavedBet, type SyncState } from "@/lib/history";

const STATUS_LABELS: Record<BetStatus, string> = { en_cours: "En cours", gagne: "Gagné", perdu: "Perdu", rembourse: "Remboursé" };
const STATUS_STYLES: Record<BetStatus, string> = {
  en_cours: "border-border text-muted",
  gagne: "border-success bg-success-soft text-success",
  perdu: "border-danger/60 bg-danger/10 text-danger",
  rembourse: "border-draw/60 text-draw",
};

const euros = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)} €`;

/** Historique des coupons joués : statut à renseigner, bilan global et réussite par marché. */
export function BetTracker() {
  const [bets, setBets] = useState<SavedBet[]>([]);
  const [sync, setSync] = useState<SyncState | "loading">("loading");

  useEffect(() => {
    const refresh = () => setBets(loadHistory());
    refresh();
    syncHistory().then(setSync);
    window.addEventListener("pronoradar-history", refresh);
    return () => window.removeEventListener("pronoradar-history", refresh);
  }, []);

  const update = (id: string, status: BetStatus) => updateBet(id, { status });
  const remove = (id: string) => {
    if (confirm("Supprimer ce coupon du suivi ?")) removeBet(id);
  };
  const syncNote = {
    loading: "Synchronisation…",
    synced: "Historique sauvegardé en ligne, disponible sur tous vos appareils.",
    local: "Sauvegarde en ligne non configurée : l'historique est gardé dans ce navigateur uniquement.",
    error: "Sauvegarde en ligne injoignable : l'historique local est affiché, il sera envoyé à la prochaine synchronisation.",
  }[sync];

  if (bets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
        {sync === "loading" ? "Chargement de l'historique…" : "Aucun coupon enregistré. Dans l'onglet Coupon, touchez « J'ai joué ce coupon » pour commencer le suivi."}
      </div>
    );
  }

  const settled = bets.filter((b) => b.status === "gagne" || b.status === "perdu");
  const staked = settled.reduce((t, b) => t + b.stake, 0);
  const net = settled.reduce((t, b) => t + profit(b), 0);
  const won = settled.filter((b) => b.status === "gagne").length;
  const expected = settled.reduce((t, b) => t + b.probability / 100, 0);

  // Réussite par marché : uniquement les coupons d'une seule sélection, où le résultat dit si ce pari précis est passé.
  const byMarket = new Map<string, { won: number; total: number }>();
  for (const b of settled.filter((x) => x.legs.length === 1)) {
    const key = CATEGORY_LABELS[b.legs[0].pick.category];
    const m = byMarket.get(key) ?? { won: 0, total: 0 };
    m.total++;
    if (b.status === "gagne") m.won++;
    byMarket.set(key, m);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Bénéfice" value={euros(net)} tone={net >= 0 ? "text-success" : "text-danger"} />
        <Stat label="Rentabilité (ROI)" value={staked ? `${((net / staked) * 100).toFixed(1)} %` : "—"} tone={net >= 0 ? "text-success" : "text-danger"} />
        <Stat label="Coupons gagnés" value={`${won} / ${settled.length}`} />
        <Stat label="Gains attendus" value={settled.length ? `${expected.toFixed(1)}` : "—"} hint="Nombre de coupons qui auraient dû passer selon nos probabilités" />
      </div>
      {settled.length > 0 && settled.length < 30 && (
        <p className="text-xs text-muted">Moins de 30 coupons terminés : trop peu pour juger la fiabilité des analyses, la chance pèse encore beaucoup.</p>
      )}
      {settled.length >= 10 && won < expected * 0.8 && (
        <p className="rounded-lg bg-warn-bg p-2 text-xs text-warn-text">
          Vous gagnez nettement moins que prévu : nos probabilités semblent trop optimistes. Réduisez les mises ou préférez le profil Sûr.
        </p>
      )}

      {byMarket.size > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Réussite par marché (paris simples)</h3>
          <ul className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
            {[...byMarket].map(([k, m]) => (
              <li key={k} className="flex justify-between">
                <span>{k}</span>
                <span className="tabular-nums text-muted">
                  {m.won}/{m.total} · {((m.won / m.total) * 100).toFixed(0)} %
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="space-y-3">
        {bets.map((b) => (
          <li key={b.id} className="rounded-2xl border border-border bg-surface p-4">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="text-muted">
                {new Date(b.createdAt).toLocaleDateString("fr-FR")} · {b.profile} · mise {b.stake.toFixed(2)} €
              </span>
              <span className="font-bold tabular-nums text-gold">
                @ {b.totalOdds.toFixed(2)} · {b.probability.toFixed(1)} %
              </span>
            </div>
            <ul className="mb-3 space-y-1 text-sm">
              {b.legs.map((l) => (
                <li key={l.match} className="truncate">
                  <span className="text-muted">{l.match} :</span> {l.pick.selection} <span className="text-muted">@ {l.pick.odds.toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(STATUS_LABELS) as BetStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => update(b.id, s)}
                  className={`rounded-full border px-3 py-1 text-xs ${b.status === s ? STATUS_STYLES[s] : "border-border text-muted"}`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
              {(b.status === "gagne" || b.status === "perdu") && (
                <span className={`ml-auto text-sm font-semibold tabular-nums ${profit(b) >= 0 ? "text-success" : "text-danger"}`}>{euros(profit(b))}</span>
              )}
              <button onClick={() => remove(b.id)} className="text-xs text-muted hover:text-danger" aria-label="Supprimer">
                Supprimer
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">{syncNote}</p>
    </div>
  );
}

function Stat({ label, value, tone = "", hint }: { label: string; value: string; tone?: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3" title={hint}>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
