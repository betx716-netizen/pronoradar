"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/client";
import { CATEGORY_LABELS } from "@/lib/coupon";
import type { DailyCoupon } from "@/lib/dailyCoupons";
import type { DayFixture, RunStatus } from "@/lib/daily";
import { addBet } from "@/lib/history";
import type { AnalysisResult } from "@/lib/schemas";
import { Icon } from "./Icon";
import { ScrollRow } from "./ScrollRow";
import { ShareCouponButton } from "./ShareCoupon";

// Vrai si le pari nomme déjà son marché (« … (remboursé si nul) », « Plus de 2,5 buts »…).
const repeats = (selection: string, market: string) =>
  market.toLowerCase().split(/[\s/+]+/).filter((w) => w.length > 3).some((w) => selection.toLowerCase().includes(w));

export type DailyResult = { id: string; fixture: DayFixture; result: AnalysisResult };
type Coupon = DailyCoupon & { locked?: boolean; legsCount?: number };
type Daily = {
  premium?: boolean;
  total?: number;
  day: string;
  status: RunStatus | "none";
  progress: { done: number; total: number };
  coupons: Coupon[];
  results: DailyResult[];
};

/**
 * Coupons préparés à l'avance par l'IA : chaque matin, le serveur analyse les matchs du jour et compose les coupons.
 * Les analyses de ces matchs sont versées dans l'application (onglet Analyses) pour être consultées et réutilisées.
 */
export function DailyCoupons({
  onResults,
  onOpen,
  onUnlock,
  refreshKey,
  title = "Coupons du jour",
}: {
  onResults: (r: DailyResult[]) => void;
  onOpen: (r: AnalysisResult) => void;
  onUnlock: () => void;
  refreshKey: string;
  title?: string;
}) {
  const [data, setData] = useState<Daily | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [played, setPlayed] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await authFetch("/api/daily");
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? `Erreur ${res.status}`);
      setData(d);
      setError(null);
      if (d.results?.length) onResults(d.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [onResults]);

  // Rechargé à chaque connexion, déconnexion ou passage en Premium.
  useEffect(() => {
    load();
  }, [load, refreshKey]);
  // Tant que la journée n'est pas prête, on revient voir toutes les 45 secondes.
  useEffect(() => {
    if (!data || data.status === "ready") return;
    const t = setInterval(load, 45_000);
    return () => clearInterval(t);
  }, [data, load]);

  if (error && !data) {
    return (
      <section className="mb-6 rounded-2xl border border-dashed border-border p-4 text-sm text-muted">
        <h2 className="mb-1 font-display text-3xl leading-none text-text">{title}</h2>
        {error}
      </section>
    );
  }
  if (!data) {
    return (
      <section className="mb-6">
        <h2 className="mb-2 font-display text-3xl leading-none">{title}</h2>
        <div className="skeleton h-40 rounded-3xl" />
      </section>
    );
  }

  const byId = new Map(data.results.map((r) => [r.id, r.result]));
  const ready = data.status === "ready";

  const card = (c: Coupon, mobile: boolean) =>
    c.locked ? (
      <article
        key={c.profile}
        className={`flex flex-col overflow-hidden rounded-3xl border border-border bg-surface text-left shadow-sm ${mobile ? "w-72 shrink-0 snap-start" : "h-full"}`}
      >
        <div className="flex items-center justify-between bg-[#050505] px-4 py-2 text-white">
          <span className="font-display text-2xl leading-none text-accent">{c.title}</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-6 text-center">
          <Icon name="lock" className="h-7 w-7 text-muted" />
          <p className="text-sm font-semibold">
            {c.legsCount} sélection{(c.legsCount ?? 0) > 1 ? "s" : ""} choisie{(c.legsCount ?? 0) > 1 ? "s" : ""} par l&apos;IA
          </p>
          <span className="rounded-xl bg-surface-3 px-3 py-1 font-display text-2xl leading-none tabular-nums">Cote {c.totalOdds.toFixed(2)}</span>
        </div>
        <button onClick={onUnlock} className="m-3 mt-0 rounded-xl bg-accent py-2 text-sm font-semibold text-on-accent transition active:scale-95">
          Débloquer avec Premium
        </button>
      </article>
    ) : (
    <article
      key={c.profile}
      className={`flex flex-col overflow-hidden rounded-3xl border border-border bg-surface text-left shadow-sm ${mobile ? "w-72 shrink-0 snap-start" : "h-full"}`}
    >
      <div className="flex items-center justify-between bg-[#050505] px-4 py-2 text-white">
        <span className="font-display text-2xl leading-none text-accent">{c.title}</span>
      </div>
      <ul className="flex-1 divide-y divide-border">
        {c.legs.map((l) => {
          const r = byId.get(l.matchId);
          return (
            <li key={l.match}>
              <button onClick={() => r && onOpen(r)} disabled={!r} className="w-full px-4 py-2 text-left">
                <p className="truncate text-[11px] text-muted">{l.match}</p>
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 break-words text-sm font-semibold leading-snug">
                    {l.pick.selection}
                    {!repeats(l.pick.selection, CATEGORY_LABELS[l.pick.category]) && (
                      <span className="font-normal text-muted"> · {CATEGORY_LABELS[l.pick.category]}</span>
                    )}
                  </p>
                  <span className="shrink-0 font-bold tabular-nums">{l.pick.odds.toFixed(2)}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {c.comment && <p className="border-t border-border px-4 py-2 text-xs leading-relaxed text-muted">{c.comment}</p>}
      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5">
        <span className="text-xs text-muted">
          {"L'analyse est faite par IA, aucun coupon n'est garanti à 100 %."}
        </span>
        <span className="rounded-xl bg-accent px-3 py-1 font-display text-2xl leading-none text-on-accent tabular-nums">{c.totalOdds.toFixed(2)}</span>
      </div>
      <div className="m-3 mt-0 flex gap-2">
        <button
          disabled={played.has(c.profile)}
          onClick={() => {
            addBet({ profile: `IA du jour · ${c.title}`, legs: c.legs, totalOdds: c.totalOdds, probability: c.probability, stake: 0 });
            setPlayed((p) => new Set(p).add(c.profile));
          }}
          className="flex-1 rounded-xl border border-border py-2 text-sm font-semibold transition active:scale-95 disabled:text-success"
        >
          {played.has(c.profile) ? "Ajouté au suivi" : "J'ai joué ce coupon"}
        </button>
        <ShareCouponButton title={c.title} legs={c.legs} totalOdds={c.totalOdds} className="px-4" />
      </div>
    </article>
    );

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-3xl leading-none">{title}</h2>
        <span className="text-xs text-muted">
          {ready ? `Préparés par l'IA · ${data.total ?? data.results.length} match${(data.total ?? data.results.length) > 1 ? "s" : ""} analysé${(data.total ?? data.results.length) > 1 ? "s" : ""}` : ""}
        </span>
      </div>
      {!ready ? (
        <div className="rounded-3xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold">L&apos;IA prépare les coupons du jour</p>
          <p className="mt-1 text-sm text-muted">
            {data.progress.total ? `${data.progress.done} match${data.progress.done > 1 ? "s" : ""} analysé${data.progress.done > 1 ? "s" : ""} sur ${data.progress.total}.` : "Recherche des matchs du jour…"} Les coupons
            apparaissent ici dès la fin, sans rien à faire.
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${data.progress.total ? Math.max(5, (data.progress.done / data.progress.total) * 100) : 5}%` }} />
          </div>
        </div>
      ) : data.coupons.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border p-4 text-sm text-muted">Pas de match aujourd&apos;hui dans les championnats suivis. Nouveaux coupons demain matin.</p>
      ) : (
        <>
          <div className="sm:hidden">
            <ScrollRow className="-mx-4 snap-x snap-mandatory items-stretch gap-3 px-4 pb-2">{data.coupons.map((c) => card(c, true))}</ScrollRow>
          </div>
          <div className="hidden grid-cols-2 gap-4 sm:grid lg:grid-cols-3">{data.coupons.map((c) => card(c, false))}</div>
          {!data.premium && (
            <button onClick={onUnlock} className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-accent bg-accent-soft px-4 py-3 text-left">
              <span className="text-sm">
                <strong>Passe en Premium</strong> pour les {data.coupons.length} coupons, l&apos;analyse de tous les matchs ({data.total ?? 0}) et tes propres analyses.
              </span>
              <span className="shrink-0 rounded-xl bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent">Voir les offres</span>
            </button>
          )}
        </>
      )}
    </section>
  );
}
