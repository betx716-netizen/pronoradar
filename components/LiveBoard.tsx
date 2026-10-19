"use client";

import { useState } from "react";
import { useLiveScores, type LiveMatch } from "@/lib/live";
import { LiveAnalysisSheet } from "./LiveAnalysisSheet";
import { LeagueLogo } from "./LeagueLogo";
import { TeamLogo } from "./TeamLogo";

export function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
    </span>
  );
}

function Row({ m, onAnalyze }: { m: LiveMatch; onAnalyze: (m: LiveMatch) => void }) {
  const live = m.state === "in";
  const score = (n: number | null) => (n == null ? "–" : n);
  const winner = m.state === "post" && m.homeScore != null && m.awayScore != null ? Math.sign(m.homeScore - m.awayScore) : 0;
  return (
    <li className={`flex items-center gap-3 rounded-2xl border bg-surface p-3 ${live ? "border-danger/40" : "border-border"}`}>
      <div className="w-14 shrink-0 text-center">
        {live ? (
          <span className="flex items-center justify-center gap-1.5 text-sm font-bold text-danger">
            <LiveDot />
            {m.clock}
          </span>
        ) : (
          <span className={`text-xs font-semibold ${m.state === "post" ? "text-muted" : "text-text"}`}>{m.clock}</span>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {(["home", "away"] as const).map((side) => {
          const name = side === "home" ? m.home : m.away;
          const sc = side === "home" ? m.homeScore : m.awayScore;
          const bold = (side === "home" && winner > 0) || (side === "away" && winner < 0);
          return (
            <div key={side} className="flex items-center gap-2">
              <TeamLogo name={name} size={20} />
              <span className={`min-w-0 flex-1 break-words text-sm ${bold ? "font-bold" : ""}`}>{name}</span>
              <span className={`font-display text-2xl leading-none tabular-nums ${live ? "text-danger" : ""}`}>{score(sc)}</span>
            </div>
          );
        })}
        {live && (
          <button
            onClick={() => onAnalyze(m)}
            className="mt-1 w-full rounded-xl bg-accent py-1.5 text-xs font-bold text-on-accent transition active:scale-95"
          >
            Analyser en direct
          </button>
        )}
      </div>
    </li>
  );
}

/** Onglet Direct : matchs en cours, terminés et à venir des championnats choisis, rafraîchis toutes les 30 secondes. */
export function LiveBoard({ leagues, priorFor }: { leagues: string[]; priorFor: (home: string, away: string) => string | null }) {
  const { matches, worldMatches, updatedAt, fullCoverage } = useLiveScores(leagues, true);
  const [analyzing, setAnalyzing] = useState<LiveMatch | null>(null);

  if (!updatedAt) return <div className="skeleton h-40 rounded-2xl" />;

  const groups: [string, LiveMatch[]][] = [
    ["En direct", matches.filter((m) => m.state === "in")],
    ["À venir aujourd'hui et demain", matches.filter((m) => m.state === "pre").sort((a, b) => a.date.localeCompare(b.date))],
    ["Terminés", matches.filter((m) => m.state === "post").sort((a, b) => b.date.localeCompare(a.date))],
  ];

  // Autres championnats en cours dans le monde, regroupés par compétition.
  const worldLeagues = [...new Set(worldMatches.map((m) => m.competition))];

  return (
    <div className="space-y-8">
      {analyzing && (
        <LiveAnalysisSheet match={analyzing} prior={priorFor(analyzing.home, analyzing.away)} onClose={() => setAnalyzing(null)} />
      )}
      <p className={`rounded-xl p-3 text-xs ${fullCoverage ? "bg-success-soft text-success" : "bg-warn-bg text-warn-text"}`}>
        {fullCoverage
          ? "✓ Couverture mondiale : tous les matchs en cours dans le monde."
          : "Couverture limitée : la source mondiale bloque le serveur, seuls les ~75 principaux championnats sont affichés."}
      </p>
      <p className="text-xs text-muted">Mis à jour à {new Date(updatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · actualisation toutes les 30 secondes</p>
      {matches.length === 0 && worldMatches.length === 0 && <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">Aucun match hier, aujourd&apos;hui ou demain dans ces championnats.</p>}
      {groups.map(([title, list]) =>
        list.length === 0 ? null : (
          <section key={title}>
            <h2 className="mb-3 flex items-center gap-2 font-display text-3xl leading-none">
              {title === "En direct" && <LiveDot />}
              {title} <span className="text-base text-muted">({list.length})</span>
            </h2>
            {leagues
              .filter((l) => list.some((m) => m.competition === l))
              .map((l) => (
                <div key={l} className="mb-4">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted">
                    <LeagueLogo name={l} size={18} />
                    {l}
                  </p>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {list
                      .filter((m) => m.competition === l)
                      .map((m) => (
                        <Row key={m.id} m={m} onAnalyze={setAnalyzing} />
                      ))}
                  </ul>
                </div>
              ))}
          </section>
        ),
      )}
      {worldMatches.length > 0 && (
        <section>
          <h2 className="mb-1 flex items-center gap-2 font-display text-3xl leading-none">
            <LiveDot /> En direct dans le monde <span className="text-base text-muted">({worldMatches.length})</span>
          </h2>
          <p className="mb-3 text-xs text-muted">Les autres championnats qui se jouent en ce moment.</p>
          {worldLeagues.map((l) => (
            <div key={l} className="mb-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted">
                <LeagueLogo name={l} size={18} />
                {l}
              </p>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {worldMatches
                  .filter((m) => m.competition === l)
                  .map((m) => (
                    <Row key={m.id} m={m} onAnalyze={setAnalyzing} />
                  ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
