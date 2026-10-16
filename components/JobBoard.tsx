"use client";

import { useState } from "react";
import type { Job } from "@/lib/jobs";
import type { Outcome } from "@/lib/schemas";

const LEVEL_STYLES: Record<string, string> = {
  fort: "bg-accent-soft text-accent",
  modéré: "bg-surface-2 text-text",
  partagé: "bg-warn-bg text-warn-text",
  insuffisant: "bg-warn-bg text-warn-text",
};

function outcomeName(o: Outcome | null, home: string, away: string) {
  if (!o) return "—";
  return o === "home" ? home : o === "away" ? away : "Nul";
}

function JobRow({ job, onOpen, active }: { job: Job; onOpen: () => void; active: boolean }) {
  const { fixture: f, result } = job;
  const c = result?.consensus;
  const ai = result?.analysis.ai_analysis;
  const agree = c?.pick && ai && c.pick === ai.predicted_outcome;
  const calc = result?.engine === "calcul";

  return (
    <li className={`rounded-lg border bg-surface p-3 ${active ? "border-accent" : "border-border"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">
            {f.home} – {f.away}
          </p>
          <p className="text-xs text-muted">
            {f.competition} · {f.date}
            {f.time ? ` à ${f.time}` : ""}
          </p>
        </div>
        {job.status === "done" && (
          <button onClick={onOpen} className="shrink-0 rounded-md border border-accent px-3 py-1 text-sm font-semibold text-accent">
            Détail
          </button>
        )}
      </div>

      {job.status === "done" && c && ai ? (
        <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted">Pronostics : </span>
            <strong>{outcomeName(c.pick, f.home, f.away)}</strong>{" "}
            <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${LEVEL_STYLES[c.level]}`}>
              {c.agreement.toFixed(0)} % · {c.level}
            </span>
          </p>
          <p>
            <span className="text-muted">{calc ? "Calcul : " : "IA : "}</span>
            <strong>{outcomeName(ai.predicted_outcome, f.home, f.away)}</strong>{" "}
            <span className="text-xs text-muted">
              ({calc ? "" : `${ai.score_prediction}, `}confiance {ai.confidence})
            </span>
            {c.pick && (
              <span className={`ml-1 text-xs font-semibold ${agree ? "text-accent" : "text-warn-text"}`}>
                {agree ? "✓ d'accord" : "≠ désaccord"}
              </span>
            )}
          </p>
        </div>
      ) : (
        <p className={`mt-2 flex items-center gap-2 text-sm ${job.status === "error" ? "text-danger" : "text-muted"}`}>
          {job.status === "running" && (
            <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          )}
          <span className="truncate">{job.message}</span>
        </p>
      )}
    </li>
  );
}

type Sort = "order" | "consensus";

export function JobBoard({
  jobs,
  running,
  activeId,
  onOpen,
  onStop,
  onResume,
  onClear,
}: {
  jobs: Job[];
  running: boolean;
  activeId: string | null;
  onOpen: (job: Job) => void;
  onStop: () => void;
  onResume: () => void;
  onClear: () => void;
}) {
  const [sort, setSort] = useState<Sort>("order");
  const done = jobs.filter((j) => j.status === "done");
  const remaining = jobs.filter((j) => j.status === "pending" || j.status === "error" || j.status === "cancelled").length;
  const geminiRequests = done.reduce((s, j) => s + (j.result?.usage.geminiRequests ?? 0), 0);

  const sorted =
    sort === "order"
      ? jobs
      : [...jobs].sort((a, b) => (b.result?.consensus.agreement ?? -1) - (a.result?.consensus.agreement ?? -1));

  return (
    <section className="mt-6 rounded-xl border border-border bg-surface-2 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Récapitulatif</h2>
          <p className="text-sm text-muted">
            {done.length} / {jobs.length} matchs analysés
            {geminiRequests > 0 ? ` · ${geminiRequests} requêtes Gemini utilisées` : ""}
          </p>
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
                <button onClick={onResume} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white dark:text-black">
                  Analyser les {remaining} restants
                </button>
              )}
              <button onClick={onClear} className="rounded-lg border border-border px-3 py-1.5 text-sm">
                Vider
              </button>
            </>
          )}
        </div>
      </div>
      {running && (
        <p className="mt-2 text-xs text-muted">
          Deux matchs sont analysés à la fois. « Arrêter » laisse finir les analyses en cours et n&apos;en lance pas d&apos;autres.
        </p>
      )}
      <ul className="mt-4 grid gap-2">
        {sorted.map((j) => (
          <JobRow key={j.id} job={j} active={j.id === activeId} onOpen={() => onOpen(j)} />
        ))}
      </ul>
    </section>
  );
}
