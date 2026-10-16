"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnalysisView } from "@/components/AnalysisView";
import { CouponBuilder } from "@/components/CouponBuilder";
import { ResultsGrid } from "@/components/ResultsGrid";
import {
  QuotaError,
  UnauthorizedError,
  callStreaming,
  loadFavorites,
  loadHistory,
  saveFavorites,
  saveHistory,
  setPassword,
} from "@/lib/client";
import { fixtureId, runPool, type Job } from "@/lib/jobs";
import { LEAGUES, MAX_LEAGUES, MODES } from "@/lib/leagues";
import type { AnalysisMode, AnalysisResult, Fixture, ServicesStatus, Sport, Usage } from "@/lib/schemas";

const MAX_HISTORY = 60;
const CONCURRENCY = 2;
const CONFIRM_ABOVE_MATCHES = 30;
const COUPON_HISTORY_HOURS = 48;

// Championnats chargés à la première visite, avant que l'utilisateur ait choisi les siens.
const DEFAULT_FAVORITES: Record<Sport, string[]> = {
  football: ["Ligue des Champions", "Ligue 1", "Premier League"],
  tennis: ["ATP", "WTA"],
};

type Tab = "matchs" | "analyses" | "coupon";
type LeagueFixtures = { status: "loading" | "done" | "error"; fixtures: Fixture[]; error?: string; notes?: string[] };
type Quotas = { odds: number | null; apiFootball: number | null };

const inputClass =
  "w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-base outline-none placeholder:text-muted focus:border-accent";

// Probabilités implicites des cotes 1/N/2, marge retirée, pour l'aperçu des cartes de match.
function impliedPercents(f: Fixture) {
  const o = f.odds;
  if (!o) return null;
  const inv = [1 / o.home, o.draw ? 1 / o.draw : 0, 1 / o.away];
  const total = inv.reduce((s, x) => s + x, 0);
  return inv.map((x) => Math.round((x / total) * 100));
}

function dayLabel(date: string) {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  const today = new Date();
  const diff = Math.round((d.getTime() - new Date(today.toDateString()).getTime()) / 86400000);
  const name = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(d);
  return diff === 0 ? `Aujourd'hui · ${name}` : diff === 1 ? `Demain · ${name}` : name.charAt(0).toUpperCase() + name.slice(1);
}

function OddsPill({ label, odd, pct }: { label: string; odd: number | null | undefined; pct?: number }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col items-center rounded-lg bg-surface-3 px-2 py-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
      <span className="text-sm font-bold tabular-nums">{odd ? odd.toFixed(2) : "—"}</span>
      {pct !== undefined && <span className="text-[10px] text-muted tabular-nums">{pct} %</span>}
    </span>
  );
}

function MatchCard({ f, checked, onToggle }: { f: Fixture; checked: boolean; onToggle: () => void }) {
  const pct = impliedPercents(f);
  const tennis = f.odds ? f.odds.draw === null : false;
  return (
    <li>
      <label
        className={`block cursor-pointer rounded-2xl border p-3.5 transition ${
          checked ? "border-accent bg-accent-soft/40" : "border-border bg-surface hover:border-muted"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted">
              {f.competition}
              {f.time ? ` · ${f.time}` : ""}
            </p>
            <p className="mt-0.5 truncate font-semibold">{f.home}</p>
            <p className="truncate font-semibold">{f.away}</p>
          </div>
          <input type="checkbox" checked={checked} onChange={onToggle} className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]" />
        </div>
        {f.odds ? (
          <div className="mt-3 flex gap-1.5">
            <OddsPill label="1" odd={f.odds.home} pct={pct?.[0]} />
            {!tennis && <OddsPill label="N" odd={f.odds.draw} pct={pct?.[1]} />}
            <OddsPill label="2" odd={f.odds.away} pct={pct?.[2]} />
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted">Cotes indisponibles</p>
        )}
        {f.odds?.totals && (
          <p className="mt-2 text-xs text-muted">
            {tennis ? "Jeux" : "Buts"} {String(f.odds.totals.point).replace(".", ",")} : plus {f.odds.totals.over.toFixed(2)} · moins{" "}
            {f.odds.totals.under.toFixed(2)}
          </p>
        )}
      </label>
    </li>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("matchs");
  const [sport, setSport] = useState<Sport>("football");
  const [leagues, setLeagues] = useState<string[]>([]);
  const [byLeague, setByLeague] = useState<Record<string, LeagueFixtures>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<AnalysisMode>("rapide");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [running, setRunning] = useState(false);
  const stopRef = useRef(false);

  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ home: "", away: "", competition: "", date: "" });
  const [needPassword, setNeedPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [quotas, setQuotas] = useState<Quotas>({ odds: null, apiFootball: null });
  const [services, setServices] = useState<ServicesStatus | null>(null);

  const [detail, setDetail] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);

  useEffect(() => setHistory(loadHistory<AnalysisResult>()), []);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(setServices)
      .catch(() => {});
  }, []);
  // À l'ouverture : les matchs de la semaine des championnats favoris s'affichent tout seuls.
  useEffect(() => {
    const favorites = loadFavorites("football", DEFAULT_FAVORITES.football);
    setLeagues(favorites);
    findFixtures(favorites, "football");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    document.body.style.overflow = detail ? "hidden" : "";
  }, [detail]);

  const searching = Object.values(byLeague).some((l) => l.status === "loading");
  const allFixtures = leagues.flatMap((l) => byLeague[l]?.fixtures ?? []);
  const selectedFixtures = allFixtures.filter((f) => selected.has(fixtureId(f)));
  const gemini = services?.gemini ?? true;
  const doneJobs = jobs.filter((j) => j.status === "done" && j.result);

  const byDay = useMemo(() => {
    const groups = new Map<string, Fixture[]>();
    for (const f of [...allFixtures].sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")))) {
      groups.set(f.date, [...(groups.get(f.date) ?? []), f]);
    }
    return [...groups.entries()];
  }, [allFixtures]);

  // Le coupon puise dans les analyses de la session et dans celles des dernières 48 heures.
  const couponResults = useMemo(() => {
    const limit = Date.now() - COUPON_HISTORY_HOURS * 3600000;
    const seen = new Set<string>();
    return [...doneJobs.map((j) => j.result!), ...history.filter((r) => new Date(r.createdAt).getTime() >= limit)].filter((r) => {
      const key = `${r.analysis.match.competition}|${r.analysis.match.home}|${r.analysis.match.away}`;
      if (seen.has(key) || !r.picks?.length) return false;
      seen.add(key);
      return true;
    });
  }, [doneJobs, history]);

  function trackQuotas(u: Usage) {
    setQuotas((q) => ({ odds: u.oddsRequestsRemaining ?? q.odds, apiFootball: u.apiFootballRequestsRemaining ?? q.apiFootball }));
  }

  function handleError(e: unknown) {
    if (e instanceof UnauthorizedError) {
      setNeedPassword(true);
      stopRef.current = true;
    } else if (e instanceof QuotaError) {
      stopRef.current = true;
      setError(e.message);
    } else {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function findFixtures(list: string[] = leagues, forSport: Sport = sport) {
    if (list.length === 0) return;
    saveFavorites(forSport, list);
    setError(null);
    setSelected(new Set());
    setByLeague(Object.fromEntries(list.map((l) => [l, { status: "loading", fixtures: [] }])));
    await Promise.all(
      list.map(async (league) => {
        try {
          const { fixtures, usage, notes } = await callStreaming<{ fixtures: Fixture[]; usage?: Usage; notes: string[] }>(
            "/api/fixtures",
            { sport: forSport, competition: league },
            () => {},
          );
          if (usage) trackQuotas(usage);
          setByLeague((prev) => ({ ...prev, [league]: { status: "done", fixtures, notes } }));
        } catch (e) {
          if (e instanceof UnauthorizedError) handleError(e);
          setByLeague((prev) => ({ ...prev, [league]: { status: "error", fixtures: [], error: e instanceof Error ? e.message : String(e) } }));
        }
      }),
    );
  }

  function switchSport(next: Sport) {
    if (next === sport) return;
    setSport(next);
    const favorites = loadFavorites(next, DEFAULT_FAVORITES[next]);
    setLeagues(favorites);
    setByLeague({});
    findFixtures(favorites, next);
  }

  function toggleLeague(l: string) {
    const next = leagues.includes(l) ? leagues.filter((x) => x !== l) : leagues.length < MAX_LEAGUES ? [...leagues, l] : leagues;
    setLeagues(next);
    if (next.length) findFixtures(next);
  }

  function toggleFixture(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const updateJob = (id: string, patch: Partial<Job>) => setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));

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
          {
            sport,
            mode,
            home: job.fixture.home,
            away: job.fixture.away,
            competition: job.fixture.competition,
            date: job.fixture.date,
            odds: job.fixture.odds ?? null,
            apiFootballId: job.fixture.apiFootballId ?? null,
          },
          (message) => updateJob(job.id, { message }),
        );
        trackQuotas(result.usage);
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
    if (selectedFixtures.length > CONFIRM_ABOVE_MATCHES && !window.confirm(`Analyser ${selectedFixtures.length} matchs ?`)) return;
    const fresh = enqueue(selectedFixtures);
    setSelected(new Set());
    setTab("analyses");
    runJobs(fresh);
  }

  function launchManual(e: React.FormEvent) {
    e.preventDefault();
    const f: Fixture = { ...manual, competition: manual.competition || "Match", time: null, stage: null, odds: null, apiFootballId: null };
    setTab("analyses");
    runJobs(enqueue([f]));
  }

  function resume() {
    const toRun = jobs
      .filter((j) => j.status === "pending" || j.status === "error" || j.status === "cancelled")
      .map((j) => ({ ...j, status: "pending" as const, message: "En attente" }));
    setJobs((prev) => prev.map((j) => toRun.find((t) => t.id === j.id) ?? j));
    runJobs(toRun);
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "matchs", label: "Matchs", count: allFixtures.length || undefined },
    { id: "analyses", label: "Analyses", count: jobs.length || undefined },
    { id: "coupon", label: "Coupon", count: couponResults.length || undefined },
  ];

  return (
    <div className="min-h-screen pb-32">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-home text-lg font-black text-black">P</div>
            <div>
              <p className="text-lg font-bold leading-none tracking-tight">
                Prono<span className="text-accent">Radar</span>
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold">Premium</p>
            </div>
          </div>
          <nav className="flex rounded-xl border border-border bg-surface p-1" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                  tab === t.id ? "bg-surface-3 text-text" : "text-muted hover:text-text"
                }`}
              >
                {t.label}
                {t.count !== undefined && (
                  <span className={`rounded-full px-1.5 text-[11px] ${t.id === "coupon" ? "bg-gold-soft text-gold" : "bg-accent-soft text-accent"}`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-6">
        {services && !services.demo && (
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            {(
              [
                ["Gemini", services.gemini],
                ["The Odds API", services.odds],
                ["API-Football", services.apiFootball],
              ] as const
            ).map(([label, on]) => (
              <span key={label} className={`rounded-full border px-2.5 py-1 ${on ? "border-accent/40 text-accent" : "border-border text-muted line-through"}`}>
                {on ? "●" : "○"} {label}
              </span>
            ))}
            {quotas.odds !== null && <span className="rounded-full border border-border px-2.5 py-1 text-muted">Cotes : {quotas.odds} requêtes restantes ce mois-ci</span>}
          </div>
        )}

        {needPassword && (
          <form
            className="mb-6 rounded-2xl border border-accent bg-surface p-4"
            onSubmit={(e) => {
              e.preventDefault();
              setPassword(passwordInput);
              setNeedPassword(false);
              findFixtures();
            }}
          >
            <label className="mb-2 block text-sm font-semibold" htmlFor="pw">
              Application protégée : entrez le mot de passe.
            </label>
            <div className="flex gap-2">
              <input id="pw" type="password" className={inputClass} value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} />
              <button className="rounded-xl bg-accent px-4 font-semibold text-black">Valider</button>
            </div>
          </form>
        )}

        {error && (
          <p className="mb-4 rounded-2xl border border-danger/40 bg-surface p-4 text-danger" role="alert">
            {error}
          </p>
        )}

        {tab === "matchs" && (
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Matchs de la semaine</h1>
                <p className="text-sm text-muted">Sélectionnez les rencontres à analyser. Liste mise à jour toutes les 2 heures.</p>
              </div>
              <div className="flex rounded-xl border border-border bg-surface p-1">
                {(["football", "tennis"] as Sport[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => switchSport(s)}
                    disabled={running}
                    className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold ${sport === s ? "bg-accent text-black" : "text-muted hover:text-text"}`}
                  >
                    {s === "football" ? "⚽ Football" : "🎾 Tennis"}
                  </button>
                ))}
              </div>
            </div>

            <div className="scrollbar-none -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1">
              {LEAGUES[sport].map(({ name: l }) => {
                const on = leagues.includes(l);
                const lf = byLeague[l];
                return (
                  <button
                    key={l}
                    onClick={() => toggleLeague(l)}
                    disabled={(!on && leagues.length >= MAX_LEAGUES) || running}
                    aria-pressed={on}
                    className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition disabled:opacity-40 ${
                      on ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-muted hover:text-text"
                    }`}
                  >
                    {l}
                    {on && lf?.status === "done" && <span className="ml-1.5 text-xs opacity-80">{lf.fixtures.length}</span>}
                    {on && lf?.status === "loading" && <span className="ml-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />}
                  </button>
                );
              })}
            </div>

            {leagues.map((l) => byLeague[l]).some((lf) => lf?.notes?.length || lf?.error) && (
              <div className="mb-4 space-y-1">
                {leagues.map((l) =>
                  [...(byLeague[l]?.notes ?? []), ...(byLeague[l]?.error ? [byLeague[l].error!] : [])].map((n) => (
                    <p key={l + n} className="text-xs text-warn-text">
                      {l} : {n}
                    </p>
                  )),
                )}
              </div>
            )}

            {searching && allFixtures.length === 0 ? (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <li key={i} className="skeleton h-36 rounded-2xl" />
                ))}
              </ul>
            ) : byDay.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
                Aucun match trouvé pour ces championnats dans les 7 prochains jours.
              </div>
            ) : (
              <div className="space-y-6">
                {byDay.map(([day, fixtures]) => {
                  const ids = fixtures.map(fixtureId);
                  const allOn = ids.every((id) => selected.has(id));
                  return (
                    <div key={day}>
                      <div className="mb-2 flex items-center justify-between">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{dayLabel(day)}</h2>
                        <button
                          onClick={() =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              for (const id of ids) {
                                if (allOn) next.delete(id);
                                else next.add(id);
                              }
                              return next;
                            })
                          }
                          className="text-xs font-semibold text-accent"
                        >
                          {allOn ? "Tout désélectionner" : "Tout sélectionner"}
                        </button>
                      </div>
                      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {fixtures.map((f) => (
                          <MatchCard key={fixtureId(f)} f={f} checked={selected.has(fixtureId(f))} onToggle={() => toggleFixture(fixtureId(f))} />
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-8 rounded-2xl border border-border bg-surface">
              <button onClick={() => setManualOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold">
                Analyser un match qui n&apos;est pas dans la liste
                <span className="text-muted">{manualOpen ? "−" : "+"}</span>
              </button>
              {manualOpen && (
                <form className="grid gap-2 border-t border-border p-4 sm:grid-cols-2" onSubmit={launchManual}>
                  <input className={inputClass} value={manual.home} onChange={(e) => setManual({ ...manual, home: e.target.value })} placeholder={sport === "tennis" ? "Joueur 1" : "Équipe à domicile"} aria-label="Équipe ou joueur 1" />
                  <input className={inputClass} value={manual.away} onChange={(e) => setManual({ ...manual, away: e.target.value })} placeholder={sport === "tennis" ? "Joueur 2" : "Équipe à l'extérieur"} aria-label="Équipe ou joueur 2" />
                  <input className={inputClass} value={manual.competition} onChange={(e) => setManual({ ...manual, competition: e.target.value })} placeholder="Compétition (facultatif)" aria-label="Compétition" />
                  <input className={inputClass} value={manual.date} onChange={(e) => setManual({ ...manual, date: e.target.value })} placeholder="Date (facultatif)" aria-label="Date" />
                  <p className="text-xs text-muted sm:col-span-2">{gemini ? "Analyse par Gemini, sans cotes de bookmakers." : "Nécessite la clé Gemini."}</p>
                  <button disabled={running || manual.home.trim().length < 2 || manual.away.trim().length < 2} className="rounded-xl bg-accent py-2.5 font-semibold text-black disabled:opacity-40 sm:col-span-2">
                    Analyser ce match
                  </button>
                </form>
              )}
            </div>
          </section>
        )}

        {tab === "analyses" && (
          <section>
            <h1 className="mb-4 text-2xl font-bold tracking-tight">Analyses</h1>
            <ResultsGrid
              jobs={jobs}
              running={running}
              onOpen={(j) => j.result && setDetail(j.result)}
              onStop={() => (stopRef.current = true)}
              onResume={resume}
              onClear={() => setJobs([])}
            />
            {history.length > 0 && (
              <div className="mt-10">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Historique</h2>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {history.map((r) => (
                    <li key={r.createdAt + r.analysis.match.home}>
                      <button onClick={() => setDetail(r)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-left hover:border-accent/60">
                        <span className="min-w-0 truncate text-sm font-medium">
                          {r.analysis.match.sport === "tennis" ? "🎾" : "⚽"} {r.analysis.match.home} – {r.analysis.match.away}
                        </span>
                        <span className="shrink-0 text-xs text-muted">{new Date(r.createdAt).toLocaleDateString("fr-FR")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {tab === "coupon" && (
          <section>
            <h1 className="text-2xl font-bold tracking-tight">Générateur de coupon</h1>
            <p className="mb-4 text-sm text-muted">Construit à partir de vos analyses des dernières {COUPON_HISTORY_HOURS} heures ({couponResults.length} matchs).</p>
            <CouponBuilder results={couponResults} />
          </section>
        )}
      </main>

      {tab === "matchs" && selectedFixtures.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <p className="text-sm">
              <strong className="text-accent">{selectedFixtures.length}</strong> match{selectedFixtures.length > 1 ? "s" : ""} sélectionné
              {selectedFixtures.length > 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <div className="flex rounded-xl border border-border bg-surface p-1">
                {(Object.keys(MODES) as AnalysisMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    title={MODES[m].description}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${mode === m ? "bg-surface-3 text-text" : "text-muted"}`}
                  >
                    {MODES[m].label}
                  </button>
                ))}
              </div>
              <button onClick={launchSelected} disabled={running} className="rounded-xl bg-accent px-5 py-2.5 font-bold text-black shadow-lg shadow-accent/20 disabled:opacity-40">
                Analyser →
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button aria-label="Fermer" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetail(null)} />
          <div className="drawer relative h-full w-full max-w-3xl overflow-y-auto border-l border-border bg-bg p-4 sm:p-6">
            <button onClick={() => setDetail(null)} className="mb-4 rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-text">
              ← Fermer
            </button>
            <AnalysisView result={detail} />
          </div>
        </div>
      )}
    </div>
  );
}
