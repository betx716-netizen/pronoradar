"use client";

import { useEffect, useRef, useState } from "react";
import { AnalysisView } from "@/components/AnalysisView";
import { UnauthorizedError, callStreaming, loadHistory, saveHistory, setPassword } from "@/lib/client";
import type { AnalysisResult, Fixture, Sport } from "@/lib/schemas";

const COMPETITIONS: Record<Sport, string[]> = {
  football: ["Ligue des Champions", "Ligue Europa", "Ligue 1", "Premier League", "LaLiga", "Serie A", "Bundesliga", "CAN"],
  tennis: ["ATP", "WTA", "Masters 1000", "Grand Chelem"],
};

const MAX_HISTORY = 15;

type Status = "idle" | "fixtures" | "analyzing";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";
const buttonClass =
  "rounded-lg bg-accent px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:text-black";

export default function Home() {
  const [sport, setSport] = useState<Sport>("football");
  const [competitionSearch, setCompetitionSearch] = useState("Ligue des Champions");
  const [fixtures, setFixtures] = useState<Fixture[] | null>(null);

  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [competition, setCompetition] = useState("");
  const [date, setDate] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [needPassword, setNeedPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => setHistory(loadHistory<AnalysisResult>()), []);

  useEffect(() => {
    if (status === "idle") return;
    const start = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [status]);

  const busy = status !== "idle";
  const isTennis = sport === "tennis";

  function switchSport(next: Sport) {
    setSport(next);
    setCompetitionSearch(COMPETITIONS[next][0]);
    setFixtures(null);
  }

  async function run<T>(kind: Status, url: string, body: unknown): Promise<T | null> {
    setStatus(kind);
    setProgress([]);
    setError(null);
    try {
      return await callStreaming<T>(url, body, (m) => setProgress((p) => [...p, m]));
    } catch (e) {
      if (e instanceof UnauthorizedError) setNeedPassword(true);
      else setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setStatus("idle");
    }
  }

  async function searchFixtures(e: React.FormEvent) {
    e.preventDefault();
    const data = await run<{ fixtures: Fixture[] }>("fixtures", "/api/fixtures", { sport, competition: competitionSearch });
    if (data) setFixtures(data.fixtures);
  }

  async function analyze(input: { home: string; away: string; competition: string; date: string }) {
    setResult(null);
    const data = await run<AnalysisResult>("analyzing", "/api/analyze", { sport, ...input });
    if (!data) return;
    setResult(data);
    const next = [data, ...history].slice(0, MAX_HISTORY);
    setHistory(next);
    saveHistory(next);
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  function analyzeFixture(f: Fixture) {
    setHome(f.home);
    setAway(f.away);
    setCompetition(f.competition);
    setDate(f.date);
    analyze({ home: f.home, away: f.away, competition: f.competition, date: f.date });
  }

  function openFromHistory(r: AnalysisResult) {
    setSport(r.analysis.match.sport);
    setResult(r);
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }));
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
            disabled={busy}
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
          className="mb-6 rounded-xl border border-border bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setPassword(passwordInput);
            setNeedPassword(false);
          }}
        >
          <label className="mb-2 block text-sm font-semibold" htmlFor="pw">
            Cette application est protégée. Entrez le mot de passe :
          </label>
          <div className="flex gap-2">
            <input id="pw" type="password" className={inputClass} value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} />
            <button className={buttonClass}>Valider</button>
          </div>
        </form>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <h2 className="text-lg font-semibold">1. Trouver les prochains matchs</h2>
          <form onSubmit={searchFixtures} className="mt-3 flex gap-2">
            <input
              className={inputClass}
              list="competitions"
              value={competitionSearch}
              onChange={(e) => setCompetitionSearch(e.target.value)}
              placeholder="Compétition"
              aria-label="Compétition"
            />
            <datalist id="competitions">
              {COMPETITIONS[sport].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <button className={buttonClass} disabled={busy || competitionSearch.trim().length < 2}>
              Chercher
            </button>
          </form>
          {fixtures && (
            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {fixtures.length === 0 && <li className="text-sm text-muted">Aucun match trouvé pour les 7 prochains jours.</li>}
              {fixtures.map((f, i) => (
                <li key={`${f.home}-${f.away}-${i}`} className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {f.home} – {f.away}
                    </p>
                    <p className="text-xs text-muted">
                      {f.date}
                      {f.time ? ` à ${f.time}` : ""}
                      {f.stage ? ` · ${f.stage}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => analyzeFixture(f)}
                    disabled={busy}
                    className="shrink-0 rounded-md border border-accent px-3 py-1.5 text-sm font-semibold text-accent disabled:opacity-50"
                  >
                    Analyser
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <h2 className="text-lg font-semibold">2. Ou analyser un match précis</h2>
          <form
            className="mt-3 grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              analyze({ home, away, competition, date });
            }}
          >
            <div className="grid grid-cols-2 gap-2">
              <input
                className={inputClass}
                value={home}
                onChange={(e) => setHome(e.target.value)}
                placeholder={isTennis ? "Joueur 1" : "Équipe à domicile"}
                aria-label={isTennis ? "Joueur 1" : "Équipe à domicile"}
              />
              <input
                className={inputClass}
                value={away}
                onChange={(e) => setAway(e.target.value)}
                placeholder={isTennis ? "Joueur 2" : "Équipe à l'extérieur"}
                aria-label={isTennis ? "Joueur 2" : "Équipe à l'extérieur"}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                className={inputClass}
                value={competition}
                onChange={(e) => setCompetition(e.target.value)}
                placeholder="Compétition (facultatif)"
                aria-label="Compétition"
              />
              <input
                className={inputClass}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="Date (facultatif)"
                aria-label="Date"
              />
            </div>
            <button className={buttonClass} disabled={busy || home.trim().length < 2 || away.trim().length < 2}>
              Lancer l&apos;analyse
            </button>
          </form>
        </section>
      </div>

      {busy && (
        <section className="mt-6 rounded-xl border border-border bg-surface p-4 sm:p-5" aria-live="polite">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 font-semibold">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              {status === "analyzing" ? "Analyse en cours" : "Recherche des matchs"}
            </p>
            <span className="text-sm tabular-nums text-muted">{elapsed} s</span>
          </div>
          {status === "analyzing" && (
            <p className="mt-1 text-sm text-muted">L&apos;IA parcourt le web : comptez 1 à 4 minutes.</p>
          )}
          <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto text-sm text-muted">
            {progress.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <p className="mt-6 rounded-xl border border-danger/40 bg-surface p-4 text-danger" role="alert">
          {error}
        </p>
      )}

      <div ref={resultRef} className="mt-8 scroll-mt-4">
        {result && <AnalysisView result={result} />}
      </div>

      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Analyses précédentes</h2>
          <ul className="space-y-2">
            {history.map((r) => (
              <li key={r.createdAt}>
                <button
                  onClick={() => openFromHistory(r)}
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
