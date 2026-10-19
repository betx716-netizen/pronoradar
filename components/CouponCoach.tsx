"use client";

import { useEffect, useState } from "react";
import { callStreaming } from "@/lib/client";
import type { CoachRequest, CoachReview, CoachStyle } from "@/lib/coach";
import { CATEGORY_LABELS, type Coupon } from "@/lib/coupon";
import type { AnalysisResult } from "@/lib/schemas";

const VERDICTS: Record<CoachReview["verdict"], { label: string; className: string }> = {
  solide: { label: "Coupon solide", className: "bg-success text-on-accent" },
  jouable: { label: "Jouable", className: "bg-gold text-on-accent" },
  a_eviter: { label: "À éviter", className: "bg-danger text-on-accent" },
};

const matchName = (r: AnalysisResult) => `${r.analysis.match.home} – ${r.analysis.match.away}`;

/** Gemini relit le coupon proposé : verdict, maillon faible, sélections à garder ou retirer. */
export function CouponCoach({
  coupon,
  results,
  profileLabel,
  onExclude,
}: {
  coupon: Coupon;
  results: AnalysisResult[];
  profileLabel: string;
  onExclude: (matches: string[]) => void;
}) {
  const [style, setStyle] = useState<CoachStyle>("prudent");
  const [review, setReview] = useState<CoachReview | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Un avis ne vaut que pour le coupon qu'il a relu.
  const signature = coupon.legs.map((l) => l.match + l.pick.selection).join("|");
  useEffect(() => setReview(null), [signature, style]);

  async function ask() {
    setLoading("Le coach relit votre coupon…");
    setError(null);
    const body: CoachRequest = {
      style,
      profile: profileLabel,
      legs: coupon.legs.map((l) => {
        const r = results.find((x) => matchName(x) === l.match);
        const ai = r?.analysis.ai_analysis;
        return {
          match: l.match,
          competition: l.competition,
          date: l.date,
          selection: l.pick.selection,
          category: CATEGORY_LABELS[l.pick.category],
          odds: l.pick.odds,
          probability: l.pick.probability,
          oddsSource: l.pick.oddsSource,
          confidence: ai?.confidence ?? null,
          summary: (ai?.summary ?? "").slice(0, 1500),
          risks: (ai?.risks ?? []).slice(0, 8).map((x) => x.slice(0, 300)),
          alternatives: (r?.picks ?? [])
            .filter((p) => p.selection !== l.pick.selection && p.probability >= 40)
            .sort((a, b) => b.probability * b.odds - a.probability * a.odds)
            .slice(0, 6)
            .map((p) => `${p.selection} @ ${p.odds.toFixed(2)} (${p.probability.toFixed(0)} %)`.slice(0, 160)),
        };
      }),
    };
    try {
      setReview(await callStreaming<CoachReview>("/api/coach", body, setLoading));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(null);
  }

  if (coupon.legs.length === 0) return null;
  const toRemove = review?.legs.filter((l) => !l.keep).map((l) => l.match) ?? [];

  return (
    <section className="mt-4 rounded-2xl border border-border bg-surface-2 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">🧠 Avis du coach IA</h3>
        <div className="flex rounded-xl border border-border bg-surface p-1 text-sm">
          {(["prudent", "agressif"] as CoachStyle[]).map((s) => (
            <button
              key={s}
              onClick={() => setStyle(s)}
              className={`rounded-lg px-3 py-1 font-semibold ${style === s ? "bg-surface-3 text-text" : "text-muted"}`}
            >
              {s === "prudent" ? "🛡️ Prudent" : "⚡ Agressif"}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-xs text-muted">
        {style === "prudent"
          ? "Protège la bankroll : retire tout ce qui est douteux, et peut conseiller de ne pas jouer."
          : "Cherche le meilleur rapport gain / risque : propose toujours un coupon jouable, quitte à remplacer des sélections."}
      </p>

      {!review && (
        <button
          onClick={ask}
          disabled={Boolean(loading)}
          className="w-full rounded-xl border border-accent py-2.5 font-semibold text-accent transition active:scale-[0.98] disabled:opacity-50"
        >
          {loading ?? "Demander l'avis du coach"}
        </button>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {review && (
        <div className="fade-in space-y-3">
          <div className="flex items-start gap-2">
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-black ${VERDICTS[review.verdict].className}`}>{VERDICTS[review.verdict].label}</span>
            <p className="text-sm font-semibold">{review.headline}</p>
          </div>
          <p className="text-sm">
            <span className="text-warn-text">Maillon faible : </span>
            {review.weakest_link}
          </p>
          <ul className="space-y-1.5">
            {review.legs.map((l) => (
              <li key={l.match} className="rounded-xl bg-surface p-2.5 text-sm">
                <p className="font-semibold">
                  {l.keep ? "✅" : "❌"} {l.match}
                </p>
                <p className="text-muted">{l.reason}</p>
                {l.replacement && <p className="text-accent">↪ Plutôt : {l.replacement}</p>}
              </li>
            ))}
          </ul>
          {review.correlations.length > 0 && (
            <p className="text-xs text-muted">
              <span className="font-semibold text-text">Risques liés : </span>
              {review.correlations.join(" · ")}
            </p>
          )}
          <p className="rounded-xl bg-surface p-3 text-sm">
            <span className="font-semibold">Conseil : </span>
            {review.advice} <span className="text-muted">(mise : {review.suggested_stake_percent} % de la bankroll)</span>
          </p>
          <div className="flex gap-2">
            {toRemove.length > 0 && (
              <button onClick={() => onExclude(toRemove)} className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-bold text-on-accent active:scale-[0.98]">
                Retirer les {toRemove.length} sélection{toRemove.length > 1 ? "s" : ""} déconseillée{toRemove.length > 1 ? "s" : ""}
              </button>
            )}
            <button onClick={ask} className="rounded-xl border border-border px-3 py-2.5 text-sm">
              Redemander
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
