"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnalysisView } from "@/components/AnalysisView";
import { CouponBuilder } from "@/components/CouponBuilder";
import { AiCoupons } from "@/components/AiCoupons";
import { BetTracker } from "@/components/BetTracker";
import { ResultsGrid } from "@/components/ResultsGrid";
import { OddsButton } from "@/components/OddsButton";
import { TopPicks } from "@/components/TopPicks";
import { TopScorers } from "@/components/TopScorers";
import { TopCoupons } from "@/components/TopCoupons";
import { DailyCoupons, type DailyResult } from "@/components/DailyCoupons";
import { TeamLogo } from "@/components/TeamLogo";
import { LeagueLogo } from "@/components/LeagueLogo";
import { useClubColors } from "@/lib/teamColors";
import { Icon, type IconName } from "@/components/Icon";
import { HeroBanner } from "@/components/HeroBanner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SettingsPanel } from "@/components/SettingsPanel";
import { ScrollRow } from "@/components/ScrollRow";
import { Paywall } from "@/components/app/Paywall";
import { FREE_ANALYSES_LABEL } from "@/lib/plans";
import { AccountView } from "@/components/app/AccountView";
import { Sheet } from "@/components/app/Sheet";
import { useSession } from "@/lib/session";
import { LiveBoard, LiveDot } from "@/components/LiveBoard";
import { findLive, sameTeam, useLiveScores, type LiveMatch } from "@/lib/live";

const findPriorAnalysis = (history: AnalysisResult[], home: string, away: string) =>
  history.find((r) => sameTeam(r.analysis.match.home, home) && sameTeam(r.analysis.match.away, away)) ?? null;
import { isValueBet } from "@/lib/value";
import {
  PremiumError,
  QuotaError,
  UnauthorizedError,
  api,
  callStreaming,
  loadFavorites,
  loadHistory,
  saveFavorites,
  saveHistory,
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
const COUPON_HISTORY_HOURS = 7 * 24;
// Une analyse reste affichée tant que son match n'est pas passé : jusqu'à la fin du jour du match (heure de Paris).
// Sans date connue, elle reste 2 jours.
function matchOver(r: AnalysisResult, now: number) {
  const date = r.analysis.match.date;
  const end =
    date && /^\d{4}-\d{2}-\d{2}/.test(date)
      ? new Date(`${date.slice(0, 10)}T23:59:59+02:00`).getTime()
      : NaN;
  return Number.isFinite(end)
    ? now > end
    : now - new Date(r.createdAt).getTime() > 2 * 86400_000;
}

// Championnats chargés à la première visite, avant que l'utilisateur ait choisi les siens.
const DEFAULT_FAVORITES: Record<Sport, string[]> = {
  football: ["Ligue des Champions", "Ligue 1", "Premier League"],
  tennis: ["ATP", "WTA"],
};

type Tab = "matchs" | "direct" | "analyses" | "coupon" | "suivi";
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
  live,
}: {
  f: Fixture;
  checked: boolean;
  onToggle: () => void;
  live?: LiveMatch | null;
}) {
  const pct = impliedPercents(f);
  const tennis = f.odds ? f.odds.draw === null : false;
  // Affiche du match : dégradé aux couleurs des deux clubs, assombri pour que le texte reste lisible.
  const homeColors = useClubColors(tennis ? null : f.home);
  const awayColors = useClubColors(tennis ? null : f.away);
  const from = homeColors?.shirt ?? "#1e293b";
  const to = awayColors?.shirt ?? "#334155";
  const playing = live && live.state !== "pre" ? live : null;

  const team = (name: string) => (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
      <span className="rounded-full bg-white p-1.5 shadow-lg">
        <TeamLogo name={name} sport={tennis ? "tennis" : "football"} size={40} />
      </span>
      <span className="line-clamp-2 font-display text-lg leading-none text-white drop-shadow sm:text-xl">{name}</span>
    </div>
  );

  return (
    <li className="fade-in">
      <div className={`overflow-hidden rounded-3xl shadow-lg transition ${checked ? "ring-4 ring-accent" : ""}`}>
        <div
          className="relative px-3 pb-3 pt-2.5"
          style={{ background: `linear-gradient(115deg, ${from} 0%, ${from} 35%, ${to} 65%, ${to} 100%)` }}
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-black/45 to-black/70" />
          <div className="relative">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-white/80">{f.competition}</p>
              <button
                type="button"
                onClick={onToggle}
                aria-pressed={checked}
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold transition active:scale-95 ${
                  checked ? "bg-accent text-on-accent" : "bg-white/20 text-white backdrop-blur hover:bg-white/30"
                }`}
              >
                {checked ? "✓ À analyser" : "＋ Analyser"}
              </button>
            </div>
            <div className="flex items-center gap-2">
              {team(f.home)}
              <div className="shrink-0 text-center">
                {playing ? (
                  <>
                    <p className={`flex items-center justify-center gap-1 text-[11px] font-bold ${playing.state === "in" ? "text-[#fca5a5]" : "text-white/70"}`}>
                      {playing.state === "in" && <LiveDot />}
                      {playing.state === "in" ? playing.clock : "Terminé"}
                    </p>
                    <p className="font-display text-4xl leading-none text-white tabular-nums">
                      {playing.homeScore}-{playing.awayScore}
                    </p>
                  </>
                ) : (
                  <p className="font-display text-3xl leading-none text-white">{f.time ?? "—"}</p>
                )}
              </div>
              {team(f.away)}
            </div>
          </div>
        </div>
        <div className="bg-surface p-2.5">
          {f.odds && pct ? (
            <div className="flex gap-2">
              {(
                [
                  ["1", f.odds.home, pct[0], f.home],
                  ...(!tennis && f.odds.draw ? [["N", f.odds.draw, pct[1], "Nul"]] : []),
                  ["2", f.odds.away, pct[2], f.away],
                ] as [string, number, number, string][]
              ).map(([label, odd, p, name]) => (
                <div key={label} className="flex min-w-0 flex-1 flex-col items-center rounded-xl bg-surface-3 px-1 py-1.5">
                  <span className="max-w-full truncate text-[10px] font-semibold uppercase text-muted">{label === "N" ? "Nul" : name}</span>
                  <span className="font-display text-2xl leading-none tabular-nums">{odd.toFixed(2)}</span>
                  <span className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface">
                    <span className="block h-full bg-accent" style={{ width: `${p}%` }} />
                  </span>
                  <span className="text-[10px] tabular-nums text-muted">{p} %</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-1 text-center text-xs text-muted">Cotes indisponibles</p>
          )}
          {f.odds?.totals && (
            <p className="mt-2 text-center text-xs text-muted">
              {tennis ? "Jeux" : "Buts"} {String(f.odds.totals.point).replace(".", ",")} : plus {f.odds.totals.over.toFixed(2)} · moins{" "}
              {f.odds.totals.under.toFixed(2)}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function App() {
  const [tab, setTab] = useState<Tab>("matchs");
  const [sport, setSport] = useState<Sport>("football");
  const [leagues, setLeagues] = useState<string[]>([]);
  const [byLeague, setByLeague] = useState<Record<string, LeagueFixtures>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<AnalysisMode>("rapide");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [running, setRunning] = useState(false);
  const [autoCoupons, setAutoCoupons] = useState(0);
  const [couponTab, setCouponTab] = useState<"ia" | "manuel">("ia");
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
  // Comptes et Premium.
  const session = useSession();
  const [me, setMe] = useState<{ premium: boolean; admin: boolean; premiumUntil: string | null } | null>(null);
  const [paywall, setPaywall] = useState(false);
  const [account, setAccount] = useState(false);
  const [accountKey, setAccountKey] = useState(0);
  useEffect(() => {
    if (!session.ready) return;
    if (!session.email) return setMe(null);
    api<{ premium: boolean; admin: boolean; premiumUntil: string | null }>("/api/me")
      .then(setMe)
      .catch(() => setMe(null));
  }, [session.ready, session.email, accountKey]);
  const premium = me?.premium ?? false;
  const unlock = () => (session.email ? setPaywall(true) : setAccount(true));
  const [error, setError] = useState<string | null>(null);
  const [quotas, setQuotas] = useState<Quotas>({
    odds: null,
    apiFootball: null,
  });
  const [services, setServices] = useState<ServicesStatus | null>(null);

  const [detail, setDetail] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);

  // Les analyses restent affichées 2 heures (même après rechargement), puis passent dans l'historique.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const isRecent = (r: AnalysisResult) => !matchOver(r, now);
  const [analysesClearedAt, setAnalysesClearedAt] = useState(0);
  useEffect(() => {
    const saved = loadHistory<AnalysisResult>();
    setHistory(saved);
    // Une analyse retirée de la liste ne revient pas au rechargement : seules les plus récentes que l'effacement réapparaissent.
    let cleared = 0;
    try {
      cleared =
        Number(localStorage.getItem("pronoradar.analysesClearedAt")) || 0;
    } catch {}
    setAnalysesClearedAt(cleared);
    const recent = saved.filter(
      (r) =>
        new Date(r.createdAt).getTime() > cleared && !matchOver(r, Date.now()),
    );
    setJobs((prev) =>
      prev.length
        ? prev
        : recent.map((r) => {
            const fixture: Fixture = {
              home: r.analysis.match.home,
              away: r.analysis.match.away,
              competition: r.analysis.match.competition,
              date: r.analysis.match.date ?? "",
              time: null,
              stage: null,
              odds: null,
              apiFootballId: null,
            };
            return {
              id: fixtureId(fixture),
              fixture,
              status: "done" as const,
              message: "Terminé",
              result: r,
            };
          }),
    );
  }, []);
  // Analyses faites le matin par le serveur pour les coupons du jour : versées dans l'onglet Analyses
  // (et donc disponibles pour les coupons de l'IA et le générateur manuel), sans écraser une analyse plus récente.
  const importDaily = useCallback((items: DailyResult[]) => {
    const key = (r: AnalysisResult) => `${r.analysis.match.competition}|${r.analysis.match.home}|${r.analysis.match.away}`;
    setJobs((prev) => {
      const have = new Set(prev.map((j) => j.id));
      const added = items.flatMap(({ fixture, result }) => {
        const { sport: _sport, ...f } = fixture;
        const id = fixtureId(f);
        return have.has(id) ? [] : [{ id, fixture: f, status: "done" as const, message: "Analysé par l'IA ce matin", result }];
      });
      return added.length ? [...prev, ...added] : prev;
    });
    setHistory((prev) => {
      const known = new Set(prev.map(key));
      const fresh = items.map((i) => i.result).filter((r) => !known.has(key(r)));
      if (!fresh.length) return prev;
      const next = [...prev, ...fresh].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, []);
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
  // À l'ouverture : tout le programme de football de la semaine se charge d'un coup (affichage : le jour choisi).
  useEffect(() => {
    loadWeek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    document.body.style.overflow = detail ? "hidden" : "";
  }, [detail]);

  // Football : programme de la semaine pour tous les championnats, sans sélection manuelle.
  const [weekMode, setWeekMode] = useState(false);
  const [weekLoading, setWeekLoading] = useState(false);
  const auto = sport === "football" && weekMode;
  const searching = weekLoading || Object.values(byLeague).some((l) => l.status === "loading");
  const allFixtures = auto
    ? LEAGUES.football.flatMap((l) => byLeague[l.name]?.fixtures ?? [])
    : leagues.flatMap((l) => byLeague[l]?.fixtures ?? []);
  const selectedFixtures = allFixtures.filter((f) =>
    selected.has(fixtureId(f)),
  );
  const gemini = services?.gemini ?? true;
  const doneJobs = jobs.filter((j) => j.status === "done" && j.result);

  // Matchs regroupés par championnat (dans l'ordre choisi), puis par jour.
  // Onglets des jours : d'aujourd'hui au même jour la semaine suivante (8 jours, heure de Paris).
  const weekDays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });
    return Array.from({ length: 8 }, (_, i) => fmt.format(new Date(Date.now() + i * 86400000)));
  }, []);
  const countByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of allFixtures) m.set(f.date, (m.get(f.date) ?? 0) + 1);
    return m;
  }, [allFixtures]);
  // Jour affiché : aujourd'hui par défaut, ou le jour touché dans la barre des jours.
  const [day, setDay] = useState<string | null>(null);
  const activeDay = day ?? weekDays[0];
  // Les championnats qui jouent le jour choisi se sélectionnent tout seuls, dans l'ordre habituel.
  useEffect(() => {
    if (!auto) return;
    setLeagues(LEAGUES.football.map((l) => l.name).filter((l) => (byLeague[l]?.fixtures ?? []).some((f) => f.date === activeDay)));
  }, [auto, byLeague, activeDay]);
  // Nombre de matchs par championnat et par jour (annuaire gratuit, tous les championnats, même non choisis).
  const [dayCounts, setDayCounts] = useState<Record<string, Record<string, number>>>({});
  useEffect(() => {
    fetch("/api/today-leagues")
      .then((r) => r.json())
      .then((d: { days?: Record<string, Record<string, number>> }) => setDayCounts(d.days ?? {}))
      .catch(() => {});
  }, []);
  // Matchs d'un championnat le jour choisi : ses matchs chargés s'il est sélectionné, sinon l'annuaire.
  const countOn = (l: string, d: string) =>
    byLeague[l]?.status === "done" ? (byLeague[l]?.fixtures ?? []).filter((f) => f.date === d).length : dayCounts[d]?.[l];
  // Total du jour pour la barre des jours : tous les championnats de la liste.
  const totalOn = (d: string) => {
    const known = LEAGUES[sport].map((l) => countOn(l.name, d)).filter((n): n is number => n !== undefined);
    return known.length ? known.reduce((a, b) => a + b, 0) : countByDay.get(d) ?? 0;
  };
  const dayCount = countByDay.get(activeDay) ?? 0;
  // Les championnats qui jouent le jour choisi passent en tête ; ensuite l'ordre habituel.
  const orderedLeagues = useMemo(() => {
    const list = LEAGUES[sport];
    const n = (name: string) =>
      byLeague[name]?.status === "done" ? (byLeague[name]?.fixtures ?? []).filter((f) => f.date === activeDay).length : dayCounts[activeDay]?.[name] ?? 0;
    return list.map((l, i) => ({ l, i, n: n(l.name) })).sort((a, b) => Number(b.n > 0) - Number(a.n > 0) || a.i - b.i).map((x) => x.l);
  }, [sport, byLeague, dayCounts, activeDay]);
  const playingElsewhere = orderedLeagues.filter((l) => !leagues.includes(l.name) && (countOn(l.name, activeDay) ?? 0) > 0).length;

  const byLeagueDay = useMemo(
    () =>
      leagues
        .map((l) => {
          const days = new Map<string, Fixture[]>();
          for (const f of [...(byLeague[l]?.fixtures ?? [])].filter((x) => x.date === activeDay).sort((a, b) =>
            (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")),
          )) {
            days.set(f.date, [...(days.get(f.date) ?? []), f]);
          }
          return [l, [...days.entries()]] as const;
        })
        .filter(([, days]) => days.length > 0),
    [leagues, byLeague, activeDay],
  );

  // Le coupon puise dans les analyses de la session et dans celles des dernières 48 heures.
  const couponResults = useMemo(() => {
    // Mêmes analyses que celles affichées dans l'onglet Analyses : ni vidées, ni de matchs déjà joués.
    const limit = Math.max(
      Date.now() - COUPON_HISTORY_HOURS * 3600000,
      couponClearedAt,
      analysesClearedAt,
    );
    const seen = new Set<string>();
    // Les matchs déjà joués ne sont plus proposés dans les coupons.
    const recent = (r: AnalysisResult) =>
      new Date(r.createdAt).getTime() >= limit && !matchOver(r, Date.now());
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
  }, [doneJobs, history, couponClearedAt, analysesClearedAt]);

  function trackQuotas(u: Usage) {
    setQuotas((q) => ({
      odds: u.oddsRequestsRemaining ?? q.odds,
      apiFootball: u.apiFootballRequestsRemaining ?? q.apiFootball,
    }));
  }

  function handleError(e: unknown) {
    if (e instanceof UnauthorizedError) {
      // Pas connecté : on propose de se connecter ou de créer un compte.
      setAccount(true);
      stopRef.current = true;
    } else if (e instanceof PremiumError) {
      setPaywall(true);
      stopRef.current = true;
    } else if (e instanceof QuotaError) {
      stopRef.current = true;
      setError(e.message);
    } else {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // Programme de la semaine (source gratuite, tous championnats). En cas d'échec : l'ancien chargement par championnat favori.
  async function loadWeek() {
    setWeekLoading(true);
    setError(null);
    setSelected(new Set());
    try {
      const res = await fetch("/api/week-fixtures");
      const d = (await res.json().catch(() => null)) as { fixtures?: Fixture[] } | null;
      const fixtures = res.ok ? d?.fixtures ?? [] : [];
      if (fixtures.length === 0) throw new Error("vide");
      setByLeague(
        Object.fromEntries(
          LEAGUES.football.map((l) => [l.name, { status: "done", fixtures: fixtures.filter((f) => f.competition === l.name) } as LeagueFixtures]),
        ),
      );
      setWeekMode(true);
    } catch {
      setWeekMode(false);
      const favorites = loadFavorites("football", DEFAULT_FAVORITES.football);
      setLeagues(favorites);
      findFixtures(favorites, "football");
    }
    setWeekLoading(false);
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
    setByLeague({});
    if (next === "football") {
      setLeagues([]);
      loadWeek();
      return;
    }
    setWeekMode(false);
    const favorites = loadFavorites(next, DEFAULT_FAVORITES[next]);
    setLeagues(favorites);
    findFixtures(favorites, next);
  }

  function toggleLeague(l: string) {
    // Football : tous les championnats du jour sont déjà affichés ; toucher un championnat amène à ses matchs.
    if (auto) {
      document.getElementById(`ligue-${l}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
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
            status: e instanceof UnauthorizedError || e instanceof PremiumError ? "pending" : "error",
            message:
              e instanceof UnauthorizedError
                ? "Connecte-toi pour lancer l'analyse"
                : e instanceof PremiumError
                ? e.message
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

  // Scores en direct des championnats de football choisis (gratuit), pour l'onglet Direct et les cartes de match.
  const live = useLiveScores(sport === "football" ? leagues : []);
  const liveCount = live.matches.filter((m) => m.state === "in").length;

  // Analyses visibles : celles en cours et celles terminées depuis moins de 2 heures.
  const visibleJobs = jobs.filter(
    (j) => j.status !== "done" || !j.result || isRecent(j.result),
  );
  const visibleResults = visibleJobs.flatMap((j) =>
    j.status === "done" && j.result ? [j.result] : [],
  );

  const tabs: { id: Tab; label: string; icon: IconName; count?: number }[] = [
    {
      id: "matchs",
      label: "Matchs",
      icon: "matchs",
      count: allFixtures.length || undefined,
    },
    {
      id: "direct",
      label: "Direct",
      icon: "direct",
      count: liveCount || undefined,
    },
    {
      id: "analyses",
      label: "Analyses",
      icon: "analyses",
      count: visibleJobs.length || undefined,
    },
    {
      id: "coupon",
      label: "Coupon",
      icon: "coupon",
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
      <header className="sticky top-0 z-30 bg-gradient-to-r from-header-from to-header-to text-on-accent shadow-lg shadow-black/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <img src="/logo-mark.png" alt="PronoRadar" className="h-10 w-10 rounded-lg bg-black object-cover shadow" />
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
            {premium ? (
              <button onClick={() => setAccount(true)} className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold text-white">
                <Icon name="crown" className="h-4 w-4" />
                Premium
              </button>
            ) : (
              <button onClick={unlock} className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-accent shadow">
                Passer Premium
              </button>
            )}
            <button onClick={() => setAccount(true)} aria-label="Mon compte" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white">
              <Icon name="compte" className="h-5 w-5" />
            </button>
            <ThemeToggle />
            {me?.admin && <SettingsPanel services={services} quotas={quotas} />}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-6">
        {needPassword && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent bg-surface p-4">
            <p className="text-sm font-semibold">
              Votre session a expiré : reconnectez-vous.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-accent px-4 py-2 font-semibold text-on-accent"
            >
              Se reconnecter
            </button>
          </div>
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
              matches={countByDay.get(weekDays[0]) ?? 0}
              analyses={visibleResults.length}
              values={
                visibleResults.filter((r) => r.picks?.some(isValueBet)).length
              }
              loading={searching}
            />
            <DailyCoupons onResults={importDaily} onOpen={setDetail} onUnlock={unlock} refreshKey={`${session.email}|${premium}`} />
            <TopCoupons refreshKey={autoCoupons + (tab === "matchs" ? 1 : 0)} onOpen={() => goTo("coupon")} />
            <TopPicks results={visibleResults} onOpen={setDetail} />
            <TopScorers results={visibleResults} onOpen={setDetail} locked={!premium} onUnlock={unlock} />
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {activeDay === weekDays[0] ? "Matchs du jour" : "Matchs du"}{" "}
                  {activeDay === weekDays[0] ? "" : new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric" }).format(new Date(`${activeDay}T12:00:00`))}
                </h1>
                <p className="text-sm text-muted">
                  {new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${activeDay}T12:00:00`))}
                  {" · "}
                  {dayCount} match{dayCount > 1 ? "s" : ""}{" "}
                  {auto ? `dans ${leagues.length} championnat${leagues.length > 1 ? "s" : ""}` : "dans tes championnats"}. Sélectionnez les rencontres à analyser.
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

            <div className="sticky top-[4.25rem] z-20 -mx-4 mb-5 bg-bg/95 px-4 py-2 backdrop-blur">
              <ScrollRow className="gap-2">
                {weekDays.map((d) => {
                  const date = new Date(`${d}T12:00:00`);
                  const n = totalOn(d);
                  const on = d === activeDay;
                  return (
                    <button
                      key={d}
                      onClick={() => setDay(d)}
                      aria-pressed={on}
                      className={`flex w-16 shrink-0 flex-col items-center rounded-2xl border py-2 transition active:scale-95 ${
                        on ? "border-accent bg-accent text-on-accent" : n ? "border-border bg-surface" : "border-border bg-surface opacity-50"
                      }`}
                    >
                      <span className="text-[11px] font-semibold uppercase">
                        {d === weekDays[0] ? "Auj." : new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(date).replace(".", "")}
                      </span>
                      <span className="font-display text-2xl leading-none">{date.getDate()}</span>
                      <span className={`text-[10px] ${on ? "text-on-accent/80" : "text-muted"}`}>
                        {n} match{n > 1 ? "s" : ""}
                      </span>
                    </button>
                  );
                })}
              </ScrollRow>
            </div>

            <div className="mb-5">
              <ScrollRow className="-mx-4 gap-2 px-4 pb-1 sm:mx-0 sm:px-12">
                {orderedLeagues.filter(({ name }) => !auto || (countOn(name, activeDay) ?? 0) > 0).map(({ name: l }) => {
                  const on = leagues.includes(l);
                  const lf = byLeague[l];
                  const count = countOn(l, activeDay);
                  return (
                    <button
                      key={l}
                      onClick={() => toggleLeague(l)}
                      disabled={
                        !auto && ((!on && leagues.length >= MAX_LEAGUES) || running)
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
                      {!(on && lf?.status === "loading") && count !== undefined && (
                        <span
                          className={`ml-1 rounded-full px-1.5 text-xs font-bold tabular-nums ${count > 0 ? "bg-accent text-on-accent" : "bg-surface-3 text-muted"}`}
                          title="Matchs ce jour-là"
                        >
                          {count}
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
                {searching
                  ? "Chargement des matchs…"
                  : playingElsewhere
                    ? `Aucun match ce jour-là dans tes championnats. ${playingElsewhere} autre${playingElsewhere > 1 ? "s" : ""} championnat${playingElsewhere > 1 ? "s jouent" : " joue"} : touche${playingElsewhere > 1 ? "-les" : "-le"} en tête de la liste ci-dessus.`
                    : auto
                      ? "Aucun match ce jour-là dans les championnats suivis."
                      : "Aucun match ce jour-là dans ces championnats."}
              </div>
            ) : (
              <div className="space-y-10">
                {byLeagueDay.map(([league, days]) => {
                  const ids = days.flatMap(([, fx]) => fx.map(fixtureId));
                  const allOn = ids.every((id) => selected.has(id));
                  return (
                    <section key={league} id={`ligue-${league}`} className="fade-in scroll-mt-40">
                      <div className="sticky top-[9.6rem] z-10 -mx-4 mb-3 flex items-center gap-3 border-b-2 border-accent bg-bg/95 px-4 py-2.5 backdrop-blur">
                        <LeagueLogo name={league} size={32} />
                        <div className="min-w-0 flex-1">
                          <h2 className="font-display text-[1.65rem] leading-none sm:text-3xl">
                            {league}
                          </h2>
                        </div>
                        {/* Nombre de matchs de ce championnat aujourd'hui. */}
                        <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-center text-xs font-bold leading-tight text-on-accent tabular-nums">
                          {ids.length}
                          <span className="block text-[10px] font-semibold opacity-80">
                            match{ids.length > 1 ? "s" : ""}
                          </span>
                        </span>
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
                            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              {fixtures.map((f) => (
                                <MatchCard
                                  key={fixtureId(f)}
                                  f={f}
                                  checked={selected.has(fixtureId(f))}
                                  onToggle={() => toggleFixture(fixtureId(f))}
                                  live={findLive(live.matches, f.home, f.away)}
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

        {tab === "direct" && (
          <section className="fade-in">
            <h1 className="mb-1 text-2xl font-bold tracking-tight">
              Scores en direct
            </h1>
            <p className="mb-5 text-sm text-muted">
              Les matchs de vos championnats de football, en direct.
            </p>
            <LiveBoard
              leagues={sport === "football" ? leagues : []}
              priorFor={(home, away) => {
                const r = findPriorAnalysis(history, home, away);
                return r ? r.analysis.ai_analysis.summary.slice(0, 1500) : null;
              }}
            />
          </section>
        )}

        {tab === "analyses" && (
          <section className="fade-in">
            <h1 className="mb-4 text-2xl font-bold tracking-tight">Analyses</h1>
            <ResultsGrid
              jobs={visibleJobs}
              running={running}
              onOpen={(j) => j.result && setDetail(j.result)}
              onStop={() => {
                stopRef.current = true;
                abortRef.current?.abort();
              }}
              onResume={resume}
              onClear={() => {
                setJobs([]);
                setAnalysesClearedAt(Date.now());
                try {
                  localStorage.setItem(
                    "pronoradar.analysesClearedAt",
                    String(Date.now()),
                  );
                } catch {}
              }}
            />
            {history.some((r) => !isRecent(r)) && (
              <div className="mt-10">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                    Historique
                  </h2>
                  <button
                    onClick={() => {
                      if (
                        !confirm(
                          "Effacer tout l'historique des analyses ? Les coupons basés dessus seront aussi vidés.",
                        )
                      )
                        return;
                      const keep = history.filter(isRecent);
                      setHistory(keep);
                      saveHistory(keep);
                    }}
                    className="text-xs font-semibold text-muted hover:text-danger"
                  >
                    Effacer l&apos;historique
                  </button>
                </div>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {history
                    .filter((r) => !isRecent(r))
                    .map((r) => (
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

        {/* Toujours monté (caché hors de l'onglet) : les coupons de l'IA se génèrent même depuis l'accueil. */}
        <section className={tab === "coupon" ? "fade-in" : "hidden"}>
            {/* Deux espaces séparés : les coupons faits par l'IA, et le générateur où l'on règle tout soi-même. */}
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border border-border bg-surface p-1">
              {(
                [
                  ["ia", "Coupons de l'IA"],
                  ["manuel", "Générateur manuel"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setCouponTab(id)}
                  className={`rounded-xl py-2.5 text-sm font-semibold transition ${couponTab === id ? "bg-accent text-on-accent" : "text-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Les deux restent montés pour que la génération automatique de l'IA se fasse même sur l'autre onglet. */}
            <div className={couponTab === "ia" ? "" : "hidden"}>
              {tab === "coupon" && (
                <DailyCoupons
                  title="Coupons du jour préparés par l'IA"
                  onResults={importDaily}
                  onOpen={setDetail}
                  onUnlock={unlock}
                  refreshKey={`${session.email}|${premium}`}
                />
              )}
              <h2 className="mb-2 font-display text-3xl leading-none">Coupons sur tes analyses</h2>
              <AiCoupons
                results={couponResults}
                autoKey={autoCoupons}
                clearedAt={couponClearedAt}
                onClearAll={clearCoupon}
              />
            </div>
            <div className={couponTab === "manuel" ? "" : "hidden"}>
              <p className="mb-4 text-sm text-muted">
                Vous choisissez l&apos;objectif, le nombre maximum de sélections
                et les marchés : le coupon se construit à partir de vos analyses
                de matchs pas encore joués ({couponResults.length} match
                {couponResults.length > 1 ? "s" : ""}).
              </p>
              <CouponBuilder results={couponResults} onClear={clearCoupon} />
            </div>
          </section>

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
        className="fixed inset-x-3 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-40 grid grid-cols-5 rounded-3xl border border-border bg-surface/95 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.25)] backdrop-blur-xl lg:hidden"
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
        <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-bg/90 backdrop-blur-xl lg:bottom-0">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <p className="text-sm">
              <strong className="text-accent">{selectedFixtures.length}</strong>{" "}
              match{selectedFixtures.length > 1 ? "s" : ""} sélectionné
              {selectedFixtures.length > 1 ? "s" : ""}
              {!premium && (
                <span className="block text-xs text-muted">
                  {session.email ? `Compte gratuit : ${FREE_ANALYSES_LABEL}.` : "Crée un compte gratuit pour 1 analyse par jour."}
                </span>
              )}
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

      {paywall && (
        <Paywall
          signedIn={Boolean(session.email)}
          email={session.email}
          onClose={() => {
            setPaywall(false);
            setAccountKey((k) => k + 1);
          }}
        />
      )}
      {account && (
        <Sheet title={session.email ? "Mon compte" : "Connexion"} onClose={() => setAccount(false)}>
          <div className="pb-4">
            <AccountView
              email={session.email}
              refreshKey={accountKey}
              onUnlock={() => {
                setAccount(false);
                setPaywall(true);
              }}
            />
          </div>
        </Sheet>
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
            <AnalysisView
              key={detail.createdAt + detail.analysis.match.home}
              result={detail}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Accès libre : tout le monde voit l'application ; les actions payantes demandent un compte Premium.
export default function Home() {
  return <App />;
}
