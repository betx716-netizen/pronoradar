"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { CATEGORY_LABELS } from "@/lib/coupon";
import type { Ticket } from "@/lib/ticket";
import type { AnalysisResult, MarketCategory, MarketPick } from "@/lib/schemas";
import type { MatchCard } from "@/lib/view";
import { AnalysisView } from "../AnalysisView";
import { Icon } from "../Icon";
import { Sheet } from "./Sheet";

const odds = (n: number) => n.toFixed(2).replace(".", ",");
const RELIABILITY: Record<string, string> = { fiable: "Fiable", moyenne: "Moyen", fragile: "Risqué" };

/** Tous les paris proposés pour un match, à ajouter au ticket, puis l'analyse complète de l'IA. */
export function MatchSheet({
  match,
  premium,
  ticket,
  onClose,
  onUnlock,
}: {
  match: MatchCard;
  premium: boolean;
  ticket: Ticket;
  onClose: () => void;
  onUnlock: () => void;
}) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    api<{ result: AnalysisResult }>(`/api/match?id=${encodeURIComponent(match.id)}`)
      .then((d) => setResult(d.result))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [match.id]);

  const groups = useMemo(() => {
    const picks = result?.picks ?? [];
    const map = new Map<MarketCategory, MarketPick[]>();
    for (const p of [...picks].sort((a, b) => b.probability - a.probability)) map.set(p.category, [...(map.get(p.category) ?? []), p]);
    return [...map.entries()];
  }, [result]);

  const matchName = `${match.home} – ${match.away}`;
  const add = (p: MarketPick) =>
    premium ? ticket.toggle({ match: matchName, competition: match.competition, date: match.date, pick: p, matchId: match.id }) : onUnlock();

  const ai = result?.analysis.ai_analysis;

  return (
    <Sheet title={matchName} onClose={onClose} wide>
      <p className="-mt-1 mb-4 text-[14px] text-muted">
        {match.competition}
        {match.time ? ` · ${match.time}` : ""}
      </p>

      {error && <p className="rounded-2xl bg-warn-bg p-4 text-warn-text">{error}</p>}
      {!result && !error && (
        <div className="space-y-3">
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-40 rounded-2xl" />
        </div>
      )}

      {result && ai && (
        <div className="space-y-5 pb-4">
          <section className="rounded-2xl bg-surface p-4">
            <div className="flex h-2.5 overflow-hidden rounded-full">
              <span className="bg-home" style={{ width: `${ai.prob_home}%` }} />
              {ai.prob_draw > 0 && <span className="bg-draw" style={{ width: `${ai.prob_draw}%` }} />}
              <span className="bg-away" style={{ width: `${ai.prob_away}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[13px] text-muted">
              <span>{match.home} {Math.round(ai.prob_home)} %</span>
              {ai.prob_draw > 0 && <span>Nul {Math.round(ai.prob_draw)} %</span>}
              <span>{match.away} {Math.round(ai.prob_away)} %</span>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed">{ai.summary}</p>
            <p className="mt-2 text-[13px] text-muted">
              Score probable {ai.score_prediction} · confiance {ai.confidence}
            </p>
          </section>

          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="font-display text-xl font-bold">Paris proposés par l&apos;IA</h3>
              {!premium && (
                <button onClick={onUnlock} className="inline-flex items-center gap-1 text-[13px] font-semibold text-orange-strong">
                  <Icon name="lock" className="h-3.5 w-3.5" />
                  Composer mon ticket
                </button>
              )}
            </div>
            <div className="space-y-4">
              {groups.map(([cat, picks]) => (
                <div key={cat}>
                  <p className="mb-1.5 text-[13px] font-medium text-muted">{CATEGORY_LABELS[cat]}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {picks.map((p) => {
                      const on = ticket.has(match.id, p.selection);
                      return (
                        <button
                          key={p.selection}
                          onClick={() => add(p)}
                          aria-pressed={on}
                          className={`flex min-h-[64px] flex-col justify-between rounded-xl border-2 px-3 py-2 text-left transition active:scale-[0.98] ${
                            on ? "border-orange bg-orange-soft" : "border-transparent bg-surface"
                          }`}
                        >
                          <span className="text-[14px] font-semibold leading-tight">{p.selection}</span>
                          <span className="mt-1 flex items-baseline justify-between text-[12px] text-muted">
                            <span>
                              {Math.round(p.probability)} %{p.reliability ? ` · ${RELIABILITY[p.reliability]}` : ""}
                            </span>
                            <span className="font-display text-[17px] font-bold text-text">
                              {p.oddsSource === "estimée" && <span className="text-gold" title="Cote estimée">≈</span>}
                              {odds(p.odds)}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-muted">≈ cote estimée par l&apos;IA quand aucun bookmaker ne la propose.</p>
          </section>

          {showFull ? (
            <AnalysisView result={result} />
          ) : (
            <button onClick={() => setShowFull(true)} className="w-full rounded-full border-2 border-border py-3 font-semibold">
              Voir l&apos;analyse complète
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}
