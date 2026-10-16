"use client";

import { useEffect, useRef, useState } from "react";
import { AnalysisView } from "@/components/AnalysisView";
import { JobBoard } from "@/components/JobBoard";
import { UnauthorizedError, callStreaming, loadHistory, saveHistory, setPassword } from "@/lib/client";
import { fixtureId, runPool, type Job } from "@/lib/jobs";
import { LEAGUES, MAX_LEAGUES, MODES, estimateCost } from "@/lib/leagues";
import type { AnalysisMode, AnalysisResult, Fixture, Sport } from "@/lib/schemas";

const MAX_HISTORY = 60;
const CONCURRENCY = 2;
const CONFIRM_ABOVE_USD = 10;

type LeagueFixtures = { status: "loading" | "done" | "error"; fixtures: Fixture[]; error?: string };

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";
const buttonClass =
  "rounded-lg bg-accent px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:text-black";
const cardClass = "rounded-xl border border-border bg-surface p-4 sm:p-5";

export default function Home() {
  const [sport, setSport] = useState<Sport>("football");
  const [leagues, setLeagues] = useState<string[]>([]);
  const [byLeague, setByLeague] = useState<Record<string, LeagueFixtures>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<AnalysisMode>("rapide");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [running, setRunning] = useState(false);
  const stopRef = useRef(false);

  const [manual, setManual] = useState({ home: "", away: "", competition: "", date: "" });
  const [needPassword, setNeedPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<{ id: string; result: AnalysisResult } | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => setHistory(loadHistory<AnalysisResult>()), []);

  const searching = Object.values(byLeague).some((l) => l.status === "loading");
  const allFixtures = leagues.flatMap((l) => byLeague[l]?.fixtures ?? []);
  const selectedFixtures = allFixtures.filter((f) => selected.has(fixtureId(f)));
  const estimate = estimateCost(mode, selectedFixtures.length);

  function switchSport(next: Sport) {
    if (next === sport) return;
    setSport(next);
    setLeagues([]);
    setByLeague({});
    setSelected(new Set());
  }

  function toggleLeague(l: string) {
    setLeagues((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : prev.length < MAX_LEAGUES ? [...prev, l] : prev));
  }

  function handleError(e: unknown) {
    if (e instanceof UnauthorizedError) {
      setNeedPassword(true);
      stopRef.current = true;
    } else {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function findFixtures() {
    setError(null);
    setSelected(new Set());
    setByLeague(Object.fromEntries(leagues.map((l) => [l, { status: "loading", fixtures: [] }])));
    await Promise.all(
      leagues.map(async (league) => {
        try {
          const { fixtures } = await callStreaming<{ fixtures: Fixture[] }>(
            "/api/fixtures",
            { sport, competition: league },
            () => {},
          );
          const tagged = fixtures.map((f) => ({ ...f, competition: league }));
          setByLeague((prev) => ({ ...prev, [league]: { status: "done", fixtures: tagged } }));
          setSelected((prev) => new Set([...prev, ...tagged.map(fixtureId)]));
        } catch (e) {
          if (e instanceof UnauthorizedError) handleError(e);
          setByLeague((prev) => ({
            ...prev,
            [league]: { status: "error", fixtures: [], error: e instanceof Error ? e.message : String(e) },
          }));
        }
      }),
    );
  }

  function toggleFixture(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setLeagueSelection(league: string, on: boolean) {
    const ids = (byLeague[league]?.fixtures ?? []).map(fixtureId);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  const updateJob = (id: string, patch: Partial<Job>) =>
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));

  async function runJobs(toRun: Job[]) {
    if (toRun.length === 0) return;
    stopRef.current = false;
    setRunning(true);
    setError(null);
    await runPool(toRun, CONCURRENCY, () => stopRef.current, async (job) => {
      updateJob(job.id, { status: "running", message: "Démarrage…" });
      try {
        const result = await callStreaming<AnalysisResult>(
          "/api/analyze",
          { sport, mode, home: job.fixture.home, away: job.fixture.away, competition: job.fixture.competition, date: job.fixture.date },
          (message) => updateJob(job.id, { message }),
        );
        updateJob(job.id, { status: "done", message: "Terminé", result });
        setHistory((prev) => {
          const next = [result, ...prev].slice(0, MAX_HISTORY);
          saveHistory(next);
          return next;
        });
      } catch (e) {
        handleError(e);
        updateJob(job.id, {
          status: e instanceof UnauthorizedError ? "pending" : "error",
          message: e instanceof UnauthorizedError ? "En attente du mot de passe" : e instanceof Error ? e.message : String(e),
        });
      }
    });
    setJobs((prev) => prev.map((j) => (j.status === "pending" && stopRef.current ? { ...j, status: "cancelled", message: "Non lancé" } : j)));
    setRunning(false);
  }

  function enqueue(fixtures: Fixture[]) {
    const existing = new Set(jobs.filter((j) => j.status !== "error" && j.status !== "cancelled").map((j) => j.id));
    const fresh: Job[] = fixtures
      .filter((f) => !existing.has(fixtureId(f)))
      .map((f) => ({ id: fixtureId(f), fixture: f, status: "pending", message: "En attente" }));
    const freshIds = new Set(fresh.map((j) => j.id));
    setJobs((prev) => [...prev.filter((j) => !freshIds.has(j.id)), ...fresh]);
    return fresh;
  }

  function launchSelected() {
    if (
      estimate.max >= CONFIRM_ABOVE_USD &&
      !window.confirm(
        `Vous allez analyser ${selectedFixtures.length} matchs. Coût estimé : ${estimate.min.toFixed(0)} à ${estimate.max.toFixed(0)} $. Continuer ?`,
      )
    ) {
      return;
    }
    runJobs(enqueue(selectedFixtures));
  }

  function launchManual(e: React.FormEvent) {
    e.preventDefault();
    const f: Fixture = { ...manual, competition: manual.competition || "Match", time: null, stage: null };
    runJobs(enqueue([f]));
  }

  function resume() {
    const toRun = jobs
      .filter((j) => j.status === "pending" || j.status === "error" || j.status === "cancelled")
      .map((j) => ({ ...j, status: "pending" as const, message: "En attente" }));
    setJobs((prev) => prev.map((j) => toRun.find((t) => t.id === j.id) ?? j));
    runJobs(toRun);
  }

  function openDetail(id: string, result: AnalysisResult) {
    setDetail({ id, result });
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Prono<span className="text-accent">Radar</span>
        </h1>
        <p className="mt-2 text-muted">
          L&apos;IA recense les pronostics publiés sur le web, les compare et vous dit ce qui en ressort, avec sa propre analyse.
        </p>
      </header>

      <div className="mb-6 inline-flex rounded-lg border border-border bg-surface p-1" role="tablist">
        {(["football", "tennis"] as Sport[]).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={sport === s}
            disabled={running || searching}
            onClick={() => switchSport(s)}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
              sport === s ? "bg-accent text-white dark:text-black" : "text-muted hover:text-text"
            }`}
          >
            {s === "football" ? "⚽ Football" : "🎾 Tennis"}
          </button>
        ))}
      </div>

      {needPassword && (
        <form
          className="mb-6 rounded-xl border border-accent bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setPassword(passwordInput);
            setNeedPassword(false);
          }}
        >
          <label className="mb-2 block text-sm font-semibold" htmlFor="pw">
            Cette application est protégée. Entrez le mot de passe, puis relancez :
          </label>
          <div className="flex gap-2">
            <input id="pw" type="password" className={inputClass} value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} />
            <button className={buttonClass}>Valider</button>
          </div>
        </form>
      )}

      <section className={cardClass}>
        <h2 className="text-lg font-semibold">1. Choisissez vos championnats</h2>
        <p className="mt-1 text-sm text-muted">
          Jusqu&apos;à {MAX_LEAGUES} · {leagues.length} sélectionné{leagues.length > 1 ? "s" : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {LEAGUES[sport].map((l) => {
            const on = leagues.includes(l);
            const full = !on && leagues.length >= MAX_LEAGUES;
            return (
              <button
                key={l}
                onClick={() => toggleLeague(l)}
                disabled={full || searching || running}
                aria-pressed={on}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition disabled:opacity-40 ${
                  on ? "border-accent bg-accent-soft text-accent" : "border-border hover:border-accent"
                }`}
              >
                {on ? "✓ " : ""}
                {l}
              </button>
            );
          })}
        </div>
        <button onClick={findFixtures} disabled={leagues.length === 0 || searching || running} className={`${buttonClass} mt-4 w-full sm:w-auto`}>
          {searching ? "Recherche des matchs…" : "Trouver les matchs des 7 prochains jours"}
        </button>
      </section>

      {leagues.some((l) => byLeague[l]) && (
        <section className={`${cardClass} mt-4`}>
          <h2 className="text-lg font-semibold">2. Choisissez les matchs à analyser</h2>
          <div className="mt-3 space-y-4">
            {leagues.map((league) => {
              const lf = byLeague[league];
              if (!lf) return null;
              const ids = lf.fixtures.map(fixtureId);
              const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
              return (
                <div key={league}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{league}</h3>
                    {lf.status === "done" && ids.length > 0 && (
                      <button onClick={() => setLeagueSelection(league, !allOn)} className="text-sm text-accent hover:underline">
                        {allOn ? "Tout décocher" : "Tout cocher"}
                      </button>
                    )}
                  </div>
                  {lf.status === "loading" && (
                    <p className="flex items-center gap-2 text-sm text-muted">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                      Recherche du programme…
                    </p>
                  )}
                  {lf.status === "error" && <p className="text-sm text-danger">{lf.error}</p>}
                  {lf.status === "done" && lf.fixtures.length === 0 && (
                    <p className="text-sm text-muted">Aucun match dans les 7 prochains jours.</p>
                  )}
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {lf.fixtures.map((f) => {
                      const id = fixtureId(f);
                      return (
                        <li key={id}>
                          <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-surface-2 px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selected.has(id)}
                              onChange={() => toggleFixture(id)}
                              className="mt-1 h-4 w-4 accent-[var(--accent)]"
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">
                                {f.home} – {f.away}
                              </span>
                              <span className="text-xs text-muted">
                                {f.date}
                                {f.time ? ` à ${f.time}` : ""}
                                {f.stage ? ` · ${f.stage}` : ""}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <h3 className="mb-2 font-semibold">3. Type d&apos;analyse</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(MODES) as AnalysisMode[]).map((m) => (
                <label
                  key={m}
                  className={`flex cursor-pointer gap-2 rounded-lg border p-3 ${mode === m ? "border-accent bg-accent-soft" : "border-border"}`}
                >
                  <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} className="mt-1 accent-[var(--accent)]" />
                  <span>
                    <span className="block font-semibold">{MODES[m].label}</span>
                    <span className="text-xs text-muted">
                      {MODES[m].description} · ≈ {MODES[m].costMin.toFixed(2)}–{MODES[m].costMax.toFixed(2)} $ / match
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">
                <strong>{selectedFixtures.length}</strong> match{selectedFixtures.length > 1 ? "s" : ""} sélectionné
                {selectedFixtures.length > 1 ? "s" : ""}
                {selectedFixtures.length > 0 && (
                  <span className="text-muted">
                    {" "}
                    · coût estimé {estimate.min.toFixed(2)} à {estimate.max.toFixed(2)} $
                  </span>
                )}
              </p>
              <button onClick={launchSelected} disabled={selectedFixtures.length === 0 || running || searching} className={buttonClass}>
                Lancer l&apos;analyse
              </button>
            </div>
          </div>
        </section>
      )}

      <details className={`${cardClass} mt-4`}>
        <summary className="cursor-pointer font-semibold">Ou analyser un match précis</summary>
        <form className="mt-3 grid gap-2" onSubmit={launchManual}>
          <div className="grid grid-cols-2 gap-2">
            <input
              className={inputClass}
              value={manual.home}
              onChange={(e) => setManual({ ...manual, home: e.target.value })}
              placeholder={sport === "tennis" ? "Joueur 1" : "Équipe à domicile"}
              aria-label={sport === "tennis" ? "Joueur 1" : "Équipe à domicile"}
            />
            <input
              className={inputClass}
              value={manual.away}
              onChange={(e) => setManual({ ...manual, away: e.target.value })}
              placeholder={sport === "tennis" ? "Joueur 2" : "Équipe à l'extérieur"}
              aria-label={sport === "tennis" ? "Joueur 2" : "Équipe à l'extérieur"}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              className={inputClass}
              value={manual.competition}
              onChange={(e) => setManual({ ...manual, competition: e.target.value })}
              placeholder="Compétition (facultatif)"
              aria-label="Compétition"
            />
            <input
              className={inputClass}
              value={manual.date}
              onChange={(e) => setManual({ ...manual, date: e.target.value })}
              placeholder="Date (facultatif)"
              aria-label="Date"
            />
          </div>
          <p className="text-xs text-muted">Utilise le type d&apos;analyse choisi à l&apos;étape 3 ({MODES[mode].label}).</p>
          <button className={buttonClass} disabled={running || manual.home.trim().length < 2 || manual.away.trim().length < 2}>
            Analyser ce match
          </button>
        </form>
      </details>

      {error && (
        <p className="mt-6 rounded-xl border border-danger/40 bg-surface p-4 text-danger" role="alert">
          {error}
        </p>
      )}

      {jobs.length > 0 && (
        <JobBoard
          jobs={jobs}
          running={running}
          activeId={detail?.id ?? null}
          onOpen={(j) => j.result && openDetail(j.id, j.result)}
          onStop={() => (stopRef.current = true)}
          onResume={resume}
          onClear={() => {
            setJobs([]);
            setDetail(null);
          }}
        />
      )}

      <div ref={detailRef} className="mt-8 scroll-mt-4">
        {detail && <AnalysisView result={detail.result} />}
      </div>

      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Analyses précédentes</h2>
          <ul className="space-y-2">
            {history.map((r) => (
              <li key={r.createdAt + r.analysis.match.home}>
                <button
                  onClick={() => openDetail(r.createdAt, r)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-left hover:border-accent"
                >
                  <span className="min-w-0 truncate font-medium">
                    {r.analysis.match.sport === "tennis" ? "🎾" : "⚽"} {r.analysis.match.home} – {r.analysis.match.away}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{new Date(r.createdAt).toLocaleDateString("fr-FR")}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
