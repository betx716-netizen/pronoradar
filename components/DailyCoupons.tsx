"use client";

import { useCallback, useEffect, useState } from "react";
import { getPassword } from "@/lib/client";
import { CATEGORY_LABELS } from "@/lib/coupon";
import type { DailyCoupon } from "@/lib/dailyCoupons";
import type { DayFixture, RunStatus } from "@/lib/daily";
import { addBet } from "@/lib/history";
import type { AnalysisResult } from "@/lib/schemas";
import { ScrollRow } from "./ScrollRow";

// Vrai si le pari nomme déjà son marché (« … (remboursé si nul) », « Plus de 2,5 buts »…).
const repeats = (selection: string, market: string) =>
  market.toLowerCase().split(/[\s/+]+/).filter((w) => w.length > 3).some((w) => selection.toLowerCase().includes(w));

export type DailyResult = { id: string; fixture: DayFixture; result: AnalysisResult };
type Daily = {
  day: string;
  status: RunStatus | "none";
  progress: { done: number; total: number };
  coupons: DailyCoupon[];
  results: DailyResult[];
};

/**
 * Coupons préparés à l'avance par l'IA : chaque matin, le serveur analyse les matchs du jour et compose les coupons.
 * Les analyses de ces matchs sont versées dans l'application (onglet Analyses) pour être consultées et réutilisées.
 */
export function DailyCoupons({ onResults, onOpen }: { onResults: (r: DailyResult[]) => void; onOpen: (r: AnalysisResult) => void }) {
  const [data, setData] = useState<Daily | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [played, setPlayed] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/daily", { headers: { "x-app-password": getPassword() }, cache: "no-store" });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? `Erreur ${res.status}`);
      setData(d);
      setError(null);
      if (d.results?.length) onResults(d.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [onResults]);

  useEffect(() => {
    load();
  }, [load]);
  // Tant que la journée n'est pas prête, on revient voir toutes les 45 secondes.
  useEffect(() => {
    if (!data || data.status === "ready") return;
    const t = setInterval(load, 45_000);
    return () => clearInterval(t);
  }, [data, load]);

  if (error && !data) {
    return (
      <section className="mb-6 rounded-2xl border border-dashed border-border p-4 text-sm text-muted">
        <h2 className="mb-1 font-display text-3xl leading-none text-text">Coupons du jour</h2>
        {error}
      </section>
    );
  }
  if (!data) {
    return (
      <section className="mb-6">
        <h2 className="mb-2 font-display text-3xl leading-none">Coupons du jour</h2>
        <div className="skeleton h-40 rounded-3xl" />
      </section>
    );
  }

  const byId = new Map(data.results.map((r) => [r.id, r.result]));
  const ready = data.status === "ready";

  const card = (c: DailyCoupon, mobile: boolean) => (
    <article
      key={c.profile}
      className={`flex flex-col overflow-hidden rounded-3xl border border-border bg-surface text-left shadow-sm ${mobile ? "w-72 shrink-0 snap-start" : "h-full"}`}
    >
      <div className="flex items-center justify-between bg-[#050505] px-4 py-2 text-white">
        <span className="font-display text-2xl leading-none text-accent">{c.title}</span>
        <span className="text-xs font-semibold text-white/70">{c.subtitle}</span>
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
          Chance {c.probability.toFixed(0)} % · mise {c.stakePercent} %
        </span>
        <span className="rounded-xl bg-accent px-3 py-1 font-display text-2xl leading-none text-on-accent tabular-nums">{c.totalOdds.toFixed(2)}</span>
      </div>
      <button
        disabled={played.has(c.profile)}
        onClick={() => {
          addBet({ profile: `IA du jour · ${c.title}`, legs: c.legs, totalOdds: c.totalOdds, probability: c.probability, stake: 0 });
          setPlayed((p) => new Set(p).add(c.profile));
        }}
        className="m-3 mt-0 rounded-xl border border-border py-2 text-sm font-semibold transition active:scale-95 disabled:text-success"
      >
        {played.has(c.profile) ? "Ajouté au suivi" : "J'ai joué ce coupon"}
      </button>
    </article>
  );

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-3xl leading-none">Coupons du jour</h2>
        <span className="text-xs text-muted">
          {ready ? `Préparés par l'IA · ${data.results.length} match${data.results.length > 1 ? "s" : ""} analysé${data.results.length > 1 ? "s" : ""}` : ""}
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
        </>
      )}
    </section>
  );
}
