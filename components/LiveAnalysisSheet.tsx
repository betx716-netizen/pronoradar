"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { callStreaming } from "@/lib/client";
import type { LiveMatch } from "@/lib/live";
import type { LiveAnalysis } from "@/lib/liveAnalysis";
import { LiveDot } from "./LiveBoard";
import { parseSofaStats, sofaStatsUrl } from "@/lib/sofa";

/** Fenêtre d'analyse en direct d'un match en cours. */
export function LiveAnalysisSheet({ match, prior, onClose }: { match: LiveMatch; prior: string | null; onClose: () => void }) {
  const [result, setResult] = useState<LiveAnalysis | null>(null);
  const [progress, setProgress] = useState("Analyse en cours…");
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setResult(null);
    setError(null);
    // Matchs de la source mondiale : le téléphone récupère lui-même les statistiques (le serveur est souvent bloqué).
    let clientStats: string[] = [];
    if (match.slug === "sofa") {
      setProgress("Récupération des statistiques du match…");
      clientStats = await fetch(sofaStatsUrl(match.id))
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => (d ? parseSofaStats(d).slice(0, 40).map((x) => x.slice(0, 200)) : []))
        .catch(() => []);
    }
    try {
      setResult(
        await callStreaming<LiveAnalysis>(
          "/api/live-analysis",
          {
            slug: match.slug,
            id: match.id,
            competition: match.competition,
            home: match.home,
            away: match.away,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            clock: match.clock,
            prior,
            clientStats,
          },
          setProgress,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    run();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bar = (parts: [string, number, string][]) => (
    <>
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-3">
        {parts.map(([k, v, c]) => (
          <div key={k} className={c} style={{ width: `${Math.max(0, v)}%` }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between gap-2 text-xs tabular-nums text-muted">
        {parts.map(([k, v]) => (
          <span key={k}>
            {k} <strong className="text-text">{Math.round(v)} %</strong>
          </span>
        ))}
      </div>
    </>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center text-text sm:items-center">
      <button aria-label="Fermer" className="fade-in absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="sheet relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-surface pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl">
        <div className="rounded-t-3xl bg-[#121216] p-5 text-white">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#f87171]">
              <LiveDot /> Analyse en direct · {match.clock}
            </p>
            <button onClick={onClose} aria-label="Fermer" className="text-white/60 hover:text-white">
              ✕
            </button>
          </div>
          <p className="text-xs text-white/60">{match.competition}</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="flex-1 break-words font-display text-2xl leading-none">{match.home}</p>
            <p className="font-display text-5xl leading-none tabular-nums">
              {match.homeScore ?? 0}-{match.awayScore ?? 0}
            </p>
            <p className="flex-1 break-words text-right font-display text-2xl leading-none">{match.away}</p>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {!result && !error && (
            <div className="space-y-2">
              <div className="skeleton h-2 rounded-full" />
              <p className="text-sm text-muted">{progress}</p>
            </div>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          {result && (
            <div className="fade-in space-y-4">
              <p className="leading-relaxed">{result.summary}</p>
              <p className="text-sm">
                <span className="font-semibold">Domination : </span>
                {result.momentum === "home" ? match.home : result.momentum === "away" ? match.away : "équilibrée"}
              </p>
              <div>
                <p className="mb-1.5 text-sm font-semibold">Résultat final</p>
                {bar([
                  ["1", result.prob_home, "bg-home"],
                  ["Nul", result.prob_draw, "bg-draw"],
                  ["2", result.prob_away, "bg-away"],
                ])}
                <p className="mt-1 text-xs text-muted">Score final le plus probable : {result.expected_final_score}</p>
              </div>
              <div>
                <p className="mb-1.5 text-sm font-semibold">Prochain but</p>
                {bar([
                  [match.home, result.next_goal_home, "bg-home"],
                  ["Aucun", result.no_more_goal, "bg-draw"],
                  [match.away, result.next_goal_away, "bg-away"],
                ])}
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Paris en direct qui peuvent rapporter</p>
                <ul className="space-y-2">
                  {result.bets
                    .filter((b) => b.expected_odds >= 1.5)
                    .map((b, i) => {
                      // Cote à partir de laquelle le pari rapporte, d'après sa probabilité (avec une petite marge).
                      const minOdds = Math.ceil((100 / Math.max(b.probability, 1)) * 1.05 * 100) / 100;
                      const value = b.expected_odds >= minOdds;
                      return (
                        <li key={b.bet} className={`rounded-xl p-3 ${i === 0 ? "border-2 border-accent bg-accent-soft" : "bg-surface-2"}`}>
                          {i === 0 && <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-accent">Meilleure option</p>}
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="break-words font-semibold">{b.bet}</span>
                            <span className="shrink-0 font-display text-2xl leading-none tabular-nums text-accent">≈ {b.expected_odds.toFixed(2)}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted">{b.reasoning}</p>
                          <p className={`mt-1.5 text-xs font-semibold ${value ? "text-success" : "text-warn-text"}`}>
                            {Math.round(b.probability)} % de chances · à jouer si la cote est d&apos;au moins {minOdds.toFixed(2)}
                          </p>
                        </li>
                      );
                    })}
                </ul>
              </div>
              <p className="rounded-xl bg-warn-bg p-3 text-sm text-warn-text">{result.warning}</p>
              <button onClick={run} className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold">
                Réanalyser avec le score actuel
              </button>
              <p className="text-center text-[11px] text-muted">Les cotes en direct changent vite : vérifiez-les chez votre bookmaker. Aucun gain garanti.</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
