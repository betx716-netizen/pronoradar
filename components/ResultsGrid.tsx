"use client";

import { useState } from "react";
import { CATEGORY_LABELS } from "@/lib/coupon";
import type { Job } from "@/lib/jobs";
import type { Outcome } from "@/lib/schemas";

const LEVEL_STYLES: Record<string, string> = {
  fort: "bg-accent-soft text-accent",
  modéré: "bg-surface-3 text-text",
  partagé: "bg-warn-bg text-warn-text",
  insuffisant: "bg-warn-bg text-warn-text",
};

const outcomeName = (o: Outcome | null, home: string, away: string) =>
  !o ? "—" : o === "home" ? home : o === "away" ? away : "Nul";

/** Anneau de confiance : part du vote pondéré en faveur de l'issue retenue. */
function Ring({ value }: { value: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const color = value >= 75 ? "var(--accent)" : value >= 55 ? "var(--gold)" : "var(--draw)";
  return (
    <svg viewBox="0 0 44 44" className="h-12 w-12 shrink-0 -rotate-90">
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="4" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} />
      <text x="22" y="22" transform="rotate(90 22 22)" textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="700" fill="var(--text)">
        {value.toFixed(0)}
      </text>
    </svg>
  );
}

function ResultCard({ job, onOpen }: { job: Job; onOpen: () => void }) {
  const { fixture: f, result } = job;
  if (job.status !== "done" || !result) {
    return (
      <li className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs text-muted">{f.competition}</p>
        <p className="font-semibold">
          {f.home} – {f.away}
        </p>
        {job.status === "running" ? (
          <>
            <div className="skeleton mt-3 h-2 rounded-full" />
            <p className="mt-2 truncate text-xs text-muted">{job.message}</p>
          </>
        ) : (
          <p className={`mt-3 text-sm ${job.status === "error" ? "text-danger" : "text-muted"}`}>{job.message}</p>
        )}
      </li>
    );
  }
  const c = result.consensus;
  const ai = result.analysis.ai_analysis;
  const calc = result.engine === "calcul";
  const topPicks = [...(result.picks ?? [])]
    .filter((p) => p.category !== "resultat")
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 3);

  return (
    <li>
      <button
        onClick={onOpen}
        className="group h-full w-full rounded-2xl border border-border bg-surface p-4 text-left transition hover:border-accent/60 hover:bg-surface-2"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted">
              {f.competition} · {f.date}
              {f.time ? ` · ${f.time}` : ""}
            </p>
            <p className="truncate font-semibold">
              {f.home} <span className="text-muted">–</span> {f.away}
            </p>
          </div>
          <Ring value={c.agreement} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-surface-2 p-2.5">
            <p className="text-xs text-muted">Consensus</p>
            <p className="truncate font-semibold">{outcomeName(c.pick, f.home, f.away)}</p>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${LEVEL_STYLES[c.level]}`}>{c.level}</span>
          </div>
          <div className="rounded-xl bg-surface-2 p-2.5">
            <p className="text-xs text-muted">{calc ? "Calcul" : "IA"}</p>
            <p className="truncate font-semibold">{outcomeName(ai.predicted_outcome, f.home, f.away)}</p>
            <p className="mt-1 text-[11px] text-muted">
              {calc ? "" : `${ai.score_prediction} · `}confiance {ai.confidence}
            </p>
          </div>
        </div>
        {topPicks.length > 0 && (
          <ul className="mt-3 space-y-1">
            {topPicks.map((p) => (
              <li key={p.selection} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate">
                  <span className="text-muted">{CATEGORY_LABELS[p.category]} · </span>
                  {p.selection}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{p.probability.toFixed(0)} %</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs font-semibold text-accent opacity-80 group-hover:opacity-100">Voir l&apos;analyse complète →</p>
      </button>
    </li>
  );
}

type Sort = "order" | "consensus";

export function ResultsGrid({
  jobs,
  running,
  onOpen,
  onStop,
  onResume,
  onClear,
}: {
  jobs: Job[];
  running: boolean;
  onOpen: (job: Job) => void;
  onStop: () => void;
  onResume: () => void;
  onClear: () => void;
}) {
  const [sort, setSort] = useState<Sort>("order");
  const done = jobs.filter((j) => j.status === "done").length;
  const remaining = jobs.filter((j) => j.status === "pending" || j.status === "error" || j.status === "cancelled").length;
  const sorted =
    sort === "order" ? jobs : [...jobs].sort((a, b) => (b.result?.consensus.agreement ?? -1) - (a.result?.consensus.agreement ?? -1));

  if (jobs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
        Aucune analyse pour l&apos;instant. Sélectionnez des matchs dans l&apos;onglet « Matchs ».
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            {done} / {jobs.length} analysés
          </p>
          {running && <div className="skeleton mt-1 h-1 w-40 rounded-full" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
            aria-label="Trier"
          >
            <option value="order">Ordre de lancement</option>
            <option value="consensus">Consensus le plus fort</option>
          </select>
          {running ? (
            <button onClick={onStop} className="rounded-lg border border-danger px-3 py-1.5 text-sm font-semibold text-danger">
              Arrêter
            </button>
          ) : (
            <>
              {remaining > 0 && (
                <button onClick={onResume} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-black">
                  Relancer les {remaining} restants
                </button>
              )}
              <button onClick={onClear} className="rounded-lg border border-border px-3 py-1.5 text-sm">
                Vider
              </button>
            </>
          )}
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((j) => (
          <ResultCard key={j.id} job={j} onOpen={() => onOpen(j)} />
        ))}
      </ul>
    </div>
  );
}
