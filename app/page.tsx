"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnalysisView } from "@/components/AnalysisView";
import { CouponBuilder } from "@/components/CouponBuilder";
import { AiCoupons } from "@/components/AiCoupons";
import { BetTracker } from "@/components/BetTracker";
import { ResultsGrid } from "@/components/ResultsGrid";
import { OddsButton } from "@/components/OddsButton";
import { TopPicks } from "@/components/TopPicks";
import { TeamLogo } from "@/components/TeamLogo";
import { LeagueLogo } from "@/components/LeagueLogo";
import { Icon, type IconName } from "@/components/Icon";
import { HeroBanner } from "@/components/HeroBanner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SettingsPanel } from "@/components/SettingsPanel";
import { ScrollRow } from "@/components/ScrollRow";
import { isValueBet } from "@/lib/value";
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
import type {
  AnalysisMode,
  AnalysisResult,
  Fixture,
  ServicesStatus,
  Sport,
  Usage,
} from "@/lib/schemas";

const MAX_HISTORY = 60;
const CONCURRENCY = 2;
const CONFIRM_ABOVE_MATCHES = 30;
const COUPON_HISTORY_HOURS = 48;

// Championnats chargés à la première visite, avant que l'utilisateur ait choisi les siens.
const DEFAULT_FAVORITES: Record<Sport, string[]> = {
  football: ["Ligue des Champions", "Ligue 1", "Premier League"],
  tennis: ["ATP", "WTA"],
};

type Tab = "matchs" | "analyses" | "coupon" | "suivi";
type LeagueFixtures = {
  status: "loading" | "done" | "error";
  fixtures: Fixture[];
  error?: string;
  notes?: string[];
};
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

// Toujours le jour et la date (« Lundi 19 octobre »), sans « aujourd'hui » ni « demain » qui peuvent tromper.
function dayLabel(date: string) {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  const name = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Pari « résultat » prêt pour le panier, à partir des cotes réelles du match.
function resultLeg(f: Fixture, selection: string, odds: number, pct: number) {
  return {
    match: `${f.home} – ${f.away}`,
    competition: f.competition,
    date: f.date,
    pick: {
      category: "resultat" as const,
      selection,
      probability: pct,
      odds,
      oddsSource: "bookmaker" as const,
      basis: "cotes" as const,
      reasoning: "",
    },
  };
}

function MatchCard({
  f,
  checked,
  onToggle,
}: {
  f: Fixture;
  checked: boolean;
  onToggle: () => void;
}) {
  const pct = impliedPercents(f);
  const tennis = f.odds ? f.odds.draw === null : false;
  return (
    <li className="fade-in">
      <div
        className={`rounded-2xl border p-3.5 transition ${
          checked
            ? "border-accent bg-accent-soft/40"
            : "border-border bg-surface hover:border-muted"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted">
              {f.competition}
              {f.time ? ` · ${f.time}` : ""}
            </p>
            <p className="mt-1 flex items-center gap-2 font-semibold">
              <TeamLogo name={f.home} sport={tennis ? "tennis" : "football"} />
              <span className="truncate">{f.home}</span>
            </p>
            <p className="mt-1 flex items-center gap-2 font-semibold">
              <TeamLogo name={f.away} sport={tennis ? "tennis" : "football"} />
              <span className="truncate">{f.away}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={checked}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold transition active:scale-95 ${
              checked
                ? "border-accent bg-accent text-on-accent"
                : "border-border text-muted hover:text-text"
            }`}
          >
            {checked ? "✓ À analyser" : "＋ Analyser"}
          </button>
        </div>
        {f.odds && pct ? (
          <div className="mt-3 flex gap-1.5">
            <OddsButton
              leg={resultLeg(f, `Victoire ${f.home}`, f.odds.home, pct[0])}
              label="1"
              sub={`${pct[0]} %`}
            />
            {!tennis && f.odds.draw && (
              <OddsButton
                leg={resultLeg(f, "Match nul", f.odds.draw, pct[1])}
                label="N"
                sub={`${pct[1]} %`}
              />
            )}
            <OddsButton
              leg={resultLeg(f, `Victoire ${f.away}`, f.odds.away, pct[2])}
              label="2"
              sub={`${pct[2]} %`}
            />
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted">Cotes indisponibles</p>
        )}
        {f.odds?.totals && (
          <p className="mt-2 text-xs text-muted">
            {tennis ? "Jeux" : "Buts"}{" "}
            {String(f.odds.totals.point).replace(".", ",")} : plus{" "}
            {f.odds.totals.over.toFixed(2)} · moins{" "}
            {f.odds.totals.under.toFixed(2)}
          </p>
        )}
      </div>
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
  const [autoCoupons, setAutoCoupons] = useState(0);
  const stopRef = useRef(false);
  // Annule les analyses en cours quand on appuie sur « Arrêter ».
  const abortRef = useRef<AbortController | null>(null);

  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({
    home: "",
    away: "",
    competition: "",
    date: "",
  });
  const [needPassword, setNeedPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [quotas, setQuotas] = useState<Quotas>({
    odds: null,
    apiFootball: null,
  });
  const [services, setServices] = useState<ServicesStatus | null>(null);

  const [detail, setDetail] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);

  useEffect(() => setHistory(loadHistory<AnalysisResult>()), []);
  // Date à laquelle le coupon a été vidé : les analyses plus anciennes n'y entrent plus (elles restent dans l'historique).
  const [couponClearedAt, setCouponClearedAt] = useState(0);
  useEffect(() => {
    try {
      setCouponClearedAt(
        Number(localStorage.getItem("pronoradar.couponClearedAt")) || 0,
      );
    } catch {}
  }, []);
  function clearCoupon() {
    const now = Date.now();
    setCouponClearedAt(now);
    try {
      localStorage.setItem("pronoradar.couponClearedAt", String(now));
    } catch {}
  }
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
  const selectedFixtures = allFixtures.filter((f) =>
    selected.has(fixtureId(f)),
  );
  const gemini = services?.gemini ?? true;
  const doneJobs = jobs.filter((j) => j.status === "done" && j.result);

  // Matchs regroupés par championnat (dans l'ordre choisi), puis par jour.
  const byLeagueDay = useMemo(
    () =>
      leagues
        .map((l) => {
          const days = new Map<string, Fixture[]>();
          for (const f of [...(byLeague[l]?.fixtures ?? [])].sort((a, b) =>
            (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")),
          )) {
            days.set(f.date, [...(days.get(f.date) ?? []), f]);
          }
          return [l, [...days.entries()]] as const;
        })
        .filter(([, days]) => days.length > 0),
    [leagues, byLeague],
  );

  // Le coupon puise dans les analyses de la session et dans celles des dernières 48 heures.
  const couponResults = useMemo(() => {
    const limit = Math.max(
      Date.now() - COUPON_HISTORY_HOURS * 3600000,
      couponClearedAt,
    );
    const seen = new Set<string>();
    const recent = (r: AnalysisResult) =>
      new Date(r.createdAt).getTime() >= limit;
    // Les plus récentes d'abord : une nouvelle analyse d'un match remplace l'ancienne.
    return [...doneJobs.map((j) => j.result!), ...history]
      .filter(recent)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((r) => {
        const key = `${r.analysis.match.competition}|${r.analysis.match.home}|${r.analysis.match.away}`;
        if (seen.has(key) || !r.picks?.length) return false;
        seen.add(key);
        return true;
      });
  }, [doneJobs, history, couponClearedAt]);

  function trackQuotas(u: Usage) {
    setQuotas((q) => ({
      odds: u.oddsRequestsRemaining ?? q.odds,
      apiFootball: u.apiFootballRequestsRemaining ?? q.apiFootball,
    }));
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

  async function findFixtures(
    list: string[] = leagues,
    forSport: Sport = sport,
  ) {
    if (list.length === 0) return;
    saveFavorites(forSport, list);
    setError(null);
    setSelected(new Set());
    setByLeague(
      Object.fromEntries(
        list.map((l) => [l, { status: "loading", fixtures: [] }]),
      ),
    );
    await Promise.all(
      list.map(async (league) => {
        try {
          const { fixtures, usage, notes } = await callStreaming<{
            fixtures: Fixture[];
            usage?: Usage;
            notes: string[];
          }>(
            "/api/fixtures",
            { sport: forSport, competition: league },
            () => {},
          );
          if (usage) trackQuotas(usage);
          setByLeague((prev) => ({
            ...prev,
            [league]: { status: "done", fixtures, notes },
          }));
        } catch (e) {
          if (e instanceof UnauthorizedError) handleError(e);
          setByLeague((prev) => ({
            ...prev,
            [league]: {
              status: "error",
              fixtures: [],
              error: e instanceof Error ? e.message : String(e),
            },
          }));
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
    const next = leagues.includes(l)
      ? leagues.filter((x) => x !== l)
      : leagues.length < MAX_LEAGUES
        ? [...leagues, l]
        : leagues;
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

  const updateJob = (id: string, patch: Partial<Job>) =>
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));

  async function runJobs(toRun: Job[]) {
    let succeeded = 0;
    if (toRun.length === 0) return;
    stopRef.current = false;
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    setRunning(true);
    setError(null);
    await runPool(
      toRun,
      CONCURRENCY,
      () => stopRef.current,
      async (job) => {
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
            signal,
          );
          trackQuotas(result.usage);
          updateJob(job.id, { status: "done", message: "Terminé", result });
          succeeded++;
          setHistory((prev) => {
            // Une nouvelle analyse d'un match remplace l'ancienne dans l'historique.
            const key = (r: AnalysisResult) =>
              `${r.analysis.match.competition}|${r.analysis.match.home}|${r.analysis.match.away}`;
            const next = [
              result,
              ...prev.filter((r) => key(r) !== key(result)),
            ].slice(0, MAX_HISTORY);
            saveHistory(next);
            return next;
          });
        } catch (e) {
          if (signal.aborted) {
            updateJob(job.id, { status: "cancelled", message: "Arrêté" });
            return;
          }
          handleError(e);
          updateJob(job.id, {
            status: e instanceof UnauthorizedError ? "pending" : "error",
            message:
              e instanceof UnauthorizedError
                ? "En attente du mot de passe"
                : e instanceof Error
                  ? e.message
                  : String(e),
          });
        }
      },
    );
    setJobs((prev) =>
      prev.map((j) =>
        j.status === "pending" && stopRef.current
          ? { ...j, status: "cancelled", message: "Non lancé" }
          : j,
      ),
    );
    setRunning(false);
    // Série d'analyses terminée avec au moins un succès : l'IA refait les coupons.
    if (succeeded > 0) setAutoCoupons((k) => k + 1);
  }

  function enqueue(fixtures: Fixture[]) {
    const existing = new Set(
      jobs
        .filter((j) => j.status !== "error" && j.status !== "cancelled")
        .map((j) => j.id),
    );
    const fresh: Job[] = fixtures
      .filter((f) => !existing.has(fixtureId(f)))
      .map((f) => ({
        id: fixtureId(f),
        fixture: f,
        status: "pending",
        message: "En attente",
      }));
    const freshIds = new Set(fresh.map((j) => j.id));
    setJobs((prev) => [...prev.filter((j) => !freshIds.has(j.id)), ...fresh]);
    return fresh;
  }

  function launchSelected() {
    if (
      selectedFixtures.length > CONFIRM_ABOVE_MATCHES &&
      !window.confirm(`Analyser ${selectedFixtures.length} matchs ?`)
    )
      return;
    const fresh = enqueue(selectedFixtures);
    setSelected(new Set());
    setTab("analyses");
    runJobs(fresh);
  }

  function launchManual(e: React.FormEvent) {
    e.preventDefault();
    const f: Fixture = {
      ...manual,
      competition: manual.competition || "Match",
      time: null,
      stage: null,
      odds: null,
      apiFootballId: null,
    };
    setTab("analyses");
    runJobs(enqueue([f]));
  }

  function resume() {
    const toRun = jobs
      .filter(
        (j) =>
          j.status === "pending" ||
          j.status === "error" ||
          j.status === "cancelled",
      )
      .map((j) => ({
        ...j,
        status: "pending" as const,
        message: "En attente",
      }));
    setJobs((prev) => prev.map((j) => toRun.find((t) => t.id === j.id) ?? j));
    runJobs(toRun);
  }

  const tabs: { id: Tab; label: string; icon: IconName; count?: number }[] = [
    {
      id: "matchs",
      label: "Matchs",
      icon: "matchs",
      count: allFixtures.length || undefined,
    },
    {
      id: "analyses",
      label: "Analyses",
      icon: "analyses",
      count: jobs.length || undefined,
    },
    {
      id: "coupon",
      label: "Coupon",
      icon: "coupon",
      count: couponResults.length || undefined,
    },
    { id: "suivi", label: "Suivi", icon: "suivi" },
  ];
  const selectionBar = tab === "matchs" && selectedFixtures.length > 0;

  function goTo(t: Tab) {
    setTab(t);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="min-h-screen pb-44 lg:pb-32">
      <header className="sticky top-0 z-30 bg-gradient-to-r from-accent-strong via-accent to-accent text-on-accent shadow-lg shadow-accent/20">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 -skew-x-6 items-center justify-center rounded-lg bg-white font-display text-2xl text-accent shadow">
              P
            </div>
            <div>
              <p className="font-display text-[1.7rem] leading-none tracking-wide">
                PRONO<span className="text-white/75">RADAR</span>
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/80">
                Pronostics · Analyse IA
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <nav
              className="hidden rounded-xl bg-black/15 p-1 lg:flex"
              role="tablist"
            >
              {tabs.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => goTo(t.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                    tab === t.id
                      ? "bg-white text-accent"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  <Icon name={t.icon} className="h-4 w-4" />
                  {t.label}
                  {t.count !== undefined && (
                    <span
                      className={`rounded-full px-1.5 text-[11px] ${tab === t.id ? "bg-accent text-on-accent" : "bg-white/20 text-white"}`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <ThemeToggle />
            <SettingsPanel services={services} quotas={quotas} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-6">
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
              <input
                id="pw"
                type="password"
                className={inputClass}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
              />
              <button className="rounded-xl bg-accent px-4 font-semibold text-on-accent">
                Valider
              </button>
            </div>
          </form>
        )}

        {error && (
          <p
            className="mb-4 rounded-2xl border border-danger/40 bg-surface p-4 text-danger"
            role="alert"
          >
            {error}
          </p>
        )}

        {tab === "matchs" && (
          <section className="fade-in">
            <HeroBanner
              matches={allFixtures.length}
              analyses={couponResults.length}
              values={
                couponResults.filter((r) => r.picks?.some(isValueBet)).length
              }
              loading={searching}
            />
            <TopPicks results={couponResults} onOpen={setDetail} />
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Matchs de la semaine
                </h1>
                <p className="text-sm text-muted">
                  Sélectionnez les rencontres à analyser. Liste mise à jour
                  toutes les 2 heures.
                </p>
              </div>
              <div className="flex rounded-xl border border-border bg-surface p-1">
                {(["football", "tennis"] as Sport[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => switchSport(s)}
                    disabled={running}
                    className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold ${sport === s ? "bg-accent text-on-accent" : "text-muted hover:text-text"}`}
                  >
                    {s === "football" ? "⚽ Football" : "🎾 Tennis"}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <ScrollRow className="-mx-4 gap-2 px-4 pb-1 sm:mx-0 sm:px-12">
                {LEAGUES[sport].map(({ name: l }) => {
                  const on = leagues.includes(l);
                  const lf = byLeague[l];
                  return (
                    <button
                      key={l}
                      onClick={() => toggleLeague(l)}
                      disabled={
                        (!on && leagues.length >= MAX_LEAGUES) || running
                      }
                      aria-pressed={on}
                      className={`flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1.5 pr-3.5 text-sm font-medium transition disabled:opacity-40 ${
                        on
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-border bg-surface text-muted hover:text-text"
                      }`}
                    >
                      <LeagueLogo name={l} size={20} />
                      {l}
                      {on && lf?.status === "done" && (
                        <span className="ml-1.5 text-xs opacity-80">
                          {lf.fixtures.length}
                        </span>
                      )}
                      {on && lf?.status === "loading" && (
                        <span className="ml-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
                      )}
                    </button>
                  );
                })}
              </ScrollRow>
            </div>

            {leagues
              .map((l) => byLeague[l])
              .some((lf) => lf?.notes?.length || lf?.error) && (
              <div className="mb-4 space-y-1">
                {leagues.map((l) =>
                  [
                    ...(byLeague[l]?.notes ?? []),
                    ...(byLeague[l]?.error ? [byLeague[l].error!] : []),
                  ].map((n) => (
                    <p key={l + n} className="text-xs text-warn-text">
                      {l} : {n}
                    </p>
                  )),
                )}
              </div>
            )}

            {searching && allFixtures.length === 0 ? (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <li key={i} className="skeleton h-36 rounded-2xl" />
                ))}
              </ul>
            ) : byLeagueDay.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
                Aucun match trouvé pour ces championnats dans les 7 prochains
                jours.
              </div>
            ) : (
              <div className="space-y-10">
                {byLeagueDay.map(([league, days]) => {
                  const ids = days.flatMap(([, fx]) => fx.map(fixtureId));
                  const allOn = ids.every((id) => selected.has(id));
                  return (
                    <section key={league} className="fade-in">
                      <div className="sticky top-[4.25rem] z-20 -mx-4 mb-3 flex items-center gap-3 border-b-2 border-accent bg-bg/95 px-4 py-2.5 backdrop-blur">
                        <LeagueLogo name={league} size={32} />
                        <div className="min-w-0 flex-1">
                          <h2 className="font-display text-[1.65rem] leading-none sm:text-3xl">{league}</h2>
                          <p className="text-xs text-muted">
                            {ids.length} match{ids.length > 1 ? "s" : ""}
                          </p>
                        </div>
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
                          className="shrink-0 text-xs font-semibold text-accent"
                        >
                          {allOn ? "Tout désélectionner" : "Tout sélectionner"}
                        </button>
                      </div>
                      <div className="space-y-5">
                        {days.map(([day, fixtures]) => (
                          <div key={day}>
                            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{dayLabel(day)}</h3>
                            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              {fixtures.map((f) => (
                                <MatchCard
                                  key={fixtureId(f)}
                                  f={f}
                                  checked={selected.has(fixtureId(f))}
                                  onToggle={() => toggleFixture(fixtureId(f))}
                                />
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}

            <div className="mt-8 rounded-2xl border border-border bg-surface">
              <button
                onClick={() => setManualOpen((o) => !o)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold"
              >
                Analyser un match qui n&apos;est pas dans la liste
                <span className="text-muted">{manualOpen ? "−" : "+"}</span>
              </button>
              {manualOpen && (
                <form
                  className="grid grid-cols-1 gap-2 border-t border-border p-4 sm:grid-cols-2"
                  onSubmit={launchManual}
                >
                  <input
                    className={inputClass}
                    value={manual.home}
                    onChange={(e) =>
                      setManual({ ...manual, home: e.target.value })
                    }
                    placeholder={
                      sport === "tennis" ? "Joueur 1" : "Équipe à domicile"
                    }
                    aria-label="Équipe ou joueur 1"
                  />
                  <input
                    className={inputClass}
                    value={manual.away}
                    onChange={(e) =>
                      setManual({ ...manual, away: e.target.value })
                    }
                    placeholder={
                      sport === "tennis" ? "Joueur 2" : "Équipe à l'extérieur"
                    }
                    aria-label="Équipe ou joueur 2"
                  />
                  <input
                    className={inputClass}
                    value={manual.competition}
                    onChange={(e) =>
                      setManual({ ...manual, competition: e.target.value })
                    }
                    placeholder="Compétition (facultatif)"
                    aria-label="Compétition"
                  />
                  <input
                    className={inputClass}
                    value={manual.date}
                    onChange={(e) =>
                      setManual({ ...manual, date: e.target.value })
                    }
                    placeholder="Date (facultatif)"
                    aria-label="Date"
                  />
                  <p className="text-xs text-muted sm:col-span-2">
                    {gemini
                      ? "Analyse par l'IA, sans cotes de bookmakers."
                      : "Nécessite l'analyse IA, indisponible pour le moment."}
                  </p>
                  <button
                    disabled={
                      running ||
                      manual.home.trim().length < 2 ||
                      manual.away.trim().length < 2
                    }
                    className="rounded-xl bg-accent py-2.5 font-semibold text-on-accent disabled:opacity-40 sm:col-span-2"
                  >
                    Analyser ce match
                  </button>
                </form>
              )}
            </div>
          </section>
        )}

        {tab === "analyses" && (
          <section className="fade-in">
            <h1 className="mb-4 text-2xl font-bold tracking-tight">Analyses</h1>
            <ResultsGrid
              jobs={jobs}
              running={running}
              onOpen={(j) => j.result && setDetail(j.result)}
              onStop={() => {
                stopRef.current = true;
                abortRef.current?.abort();
              }}
              onResume={resume}
              onClear={() => setJobs([])}
            />
            {history.length > 0 && (
              <div className="mt-10">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
                  Historique
                </h2>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {history.map((r) => (
                    <li key={r.createdAt + r.analysis.match.home}>
                      <button
                        onClick={() => setDetail(r)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-left hover:border-accent/60"
                      >
                        <span className="min-w-0 truncate text-sm font-medium">
                          {r.analysis.match.sport === "tennis" ? "🎾" : "⚽"}{" "}
                          {r.analysis.match.home} – {r.analysis.match.away}
                        </span>
                        <span className="shrink-0 text-xs text-muted">
                          {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {tab === "coupon" && (
          <section className="fade-in">
            <AiCoupons results={couponResults} autoKey={autoCoupons} />
            <h2 className="font-display text-3xl leading-none">
              Générateur manuel
            </h2>
            <p className="mb-4 text-sm text-muted">
              Construit à partir de vos analyses des dernières{" "}
              {COUPON_HISTORY_HOURS} heures ({couponResults.length} matchs).
            </p>
            <CouponBuilder results={couponResults} onClear={clearCoupon} />
          </section>
        )}

        {tab === "suivi" && (
          <section className="fade-in">
            <h1 className="text-2xl font-bold tracking-tight">
              Suivi des paris
            </h1>
            <p className="mb-4 text-sm text-muted">
              Vos coupons joués et leurs résultats, pour savoir si les analyses
              rapportent vraiment.
            </p>
            <BetTracker />
          </section>
        )}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.12)] backdrop-blur-xl lg:hidden"
        role="tablist"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => goTo(t.id)}
            className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition active:scale-95 ${tab === t.id ? "text-accent" : "text-muted"}`}
          >
            <span
              className={`flex h-8 w-12 items-center justify-center rounded-full transition ${tab === t.id ? "bg-accent-soft" : ""}`}
            >
              <Icon name={t.icon} />
            </span>
            {t.label}
            {t.count !== undefined && (
              <span className="absolute right-[18%] top-1 min-w-4 rounded-full bg-accent px-1 text-[10px] leading-4 text-on-accent">
                {t.count > 99 ? "99+" : t.count}
              </span>
            )}
          </button>
        ))}
      </nav>

      {selectionBar && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-bg/90 backdrop-blur-xl lg:bottom-0">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <p className="text-sm">
              <strong className="text-accent">{selectedFixtures.length}</strong>{" "}
              match{selectedFixtures.length > 1 ? "s" : ""} sélectionné
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
              <button
                onClick={launchSelected}
                disabled={running}
                className="rounded-xl bg-accent px-5 py-2.5 font-bold text-on-accent shadow-lg shadow-accent/20 disabled:opacity-40"
              >
                Analyser →
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button
            aria-label="Fermer"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDetail(null)}
          />
          <div className="drawer relative h-full w-full max-w-3xl overflow-y-auto border-l border-border bg-bg p-4 sm:p-6">
            <button
              onClick={() => setDetail(null)}
              className="mb-4 rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-text"
            >
              ← Fermer
            </button>
            <AnalysisView key={detail.createdAt + detail.analysis.match.home} result={detail} />
          </div>
        </div>
      )}
    </div>
  );
}
