"use client";

import {
  SOURCE_WEIGHTS,
  sourceDistribution,
  sourcePick,
  type Consensus,
  type Distribution,
} from "@/lib/consensus";
import type {
  PastGame,
  AnalysisResult,
  Outcome,
  Source,
  SourceType,
} from "@/lib/schemas";
import { MarketsPanel } from "./MarketsPanel";
import { useEffect, useState } from "react";
import { Pitch } from "./Pitch";
import { LiveDot } from "./LiveBoard";
import { findLive, sameTeam, useLiveScores } from "@/lib/live";
import { TeamLogo } from "./TeamLogo";

const TYPE_LABELS: Record<SourceType, string> = {
  bookmaker: "Bookmaker",
  exchange: "Bourse de paris",
  stats_model: "Modèle statistique",
  tipster: "Pronostiqueur",
  media: "Média",
};

const LEVEL_STYLES: Record<Consensus["level"], string> = {
  fort: "bg-success-soft text-success",
  modéré: "bg-surface-2 text-text",
  partagé: "bg-warn-bg text-warn-text",
  insuffisant: "bg-warn-bg text-warn-text",
};

const OUTCOME_COLORS: Record<Outcome, string> = {
  home: "bg-home",
  draw: "bg-draw",
  away: "bg-away",
};

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-border bg-surface p-4 sm:p-5 ${className}`}
    >
      {title && (
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

function ProbBar({
  label,
  hint,
  dist,
  outcomes,
  name,
}: {
  label: string;
  hint?: string;
  dist: Distribution | null;
  outcomes: Outcome[];
  name: (o: Outcome) => string;
}) {
  return (
    <div className="py-2">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {dist ? (
        <>
          <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
            {outcomes.map((o) => (
              <div
                key={o}
                className={OUTCOME_COLORS[o]}
                style={{ width: `${dist[o]}%` }}
                title={`${name(o)} : ${dist[o].toFixed(0)} %`}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between gap-2 text-xs tabular-nums text-muted">
            {outcomes.map((o) => (
              <span key={o}>
                {name(o)}{" "}
                <strong className="text-text">{dist[o].toFixed(0)} %</strong>
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="text-xs text-muted">
          Aucune donnée trouvée pour cette catégorie.
        </p>
      )}
    </div>
  );
}

function SourceCard({
  s,
  name,
  sport,
}: {
  s: Source;
  name: (o: Outcome) => string;
  sport: "football" | "tennis";
}) {
  const pick = sourcePick(s, sport);
  const dist = sourceDistribution(s, sport);
  const hasOdds = s.odds_home != null && s.odds_away != null;
  let host = "";
  try {
    host = new URL(s.url).hostname.replace(/^www\./, "");
  } catch {}

  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {host ? (
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent hover:underline"
          >
            {s.name}
          </a>
        ) : (
          <span className="font-medium">{s.name}</span>
        )}
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
          {TYPE_LABELS[s.type]} · poids {SOURCE_WEIGHTS[s.type]}
        </span>
      </div>
      {(host || s.published) && (
        <p className="mt-0.5 truncate text-xs text-muted">
          {[host, s.published].filter(Boolean).join(" · ")}
        </p>
      )}
      <p className="mt-2 text-sm">
        Pronostic :{" "}
        {pick ? (
          <strong className="inline-flex items-center gap-1.5">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${OUTCOME_COLORS[pick]}`}
            />
            {name(pick)}
          </strong>
        ) : (
          <span className="text-muted">ne tranche pas</span>
        )}
        {dist && (
          <span className="ml-2 text-xs tabular-nums text-muted">
            ({hasOdds ? "cotes " : ""}
            {hasOdds
              ? [s.odds_home, s.odds_draw, s.odds_away]
                  .filter((v) => v != null)
                  .join(" / ")
              : [s.prob_home, s.prob_draw, s.prob_away]
                  .filter((v) => v != null)
                  .map((v) => `${v} %`)
                  .join(" / ")}
            )
          </span>
        )}
      </p>
      {s.reasoning && <p className="mt-1 text-sm text-muted">{s.reasoning}</p>}
      {s.other_tips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {s.other_tips.map((t) => (
            <span
              key={t}
              className="rounded-md bg-surface-2 px-2 py-0.5 text-xs"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

type Tab = "resume" | "compos" | "marches" | "sources";

export function AnalysisView({ result }: { result: AnalysisResult }) {
  const { analysis, consensus, usage, consultedPages } = result;
  const { match, ai_analysis: ai, context } = analysis;
  const sport = match.sport;
  const name = (o: Outcome) =>
    o === "home" ? match.home : o === "away" ? match.away : "Nul";
  const aiRaw: Distribution = {
    home: ai.prob_home,
    draw: ai.prob_draw,
    away: ai.prob_away,
  };
  const aiTotal = consensus.outcomes.reduce((s, o) => s + aiRaw[o], 0) || 1;
  const aiDist: Distribution = { home: 0, draw: 0, away: 0 };
  for (const o of consensus.outcomes) aiDist[o] = (aiRaw[o] / aiTotal) * 100;
  const totalSources = analysis.sources.length;
  const calc = result.engine === "calcul";
  // Compositions officielles (publiées environ une heure avant le match) en priorité, sinon celles de l'analyse.
  const [official, setOfficial] = useState<NonNullable<
    typeof analysis.lineups
  > | null>(null);
  const [checking, setChecking] = useState(false);
  const lineups = official ?? analysis.lineups ?? null;

  const [tab, setTab] = useState<Tab>("resume");
  // Score en direct si le match a commencé (football).
  const live = findLive(
    useLiveScores(sport === "football" ? [match.competition] : []).matches,
    match.home,
    match.away,
  );
  const playing = live && live.state !== "pre" ? live : null;
  const [side, setSide] = useState<"home" | "away">("home");
  // Toucher une équipe ouvre sa composition probable.
  const openTeam = (s: "home" | "away") => {
    setSide(s);
    setTab("compos");
  };

  useEffect(() => {
    if (tab !== "compos" || sport !== "football" || official) return;
    let alive = true;
    const check = () => {
      setChecking(true);
      const q = new URLSearchParams({
        competition: match.competition,
        home: match.home,
        away: match.away,
        date: match.date ?? "",
      });
      fetch(`/api/lineups?${q}`)
        .then((res) => res.json())
        .then((d) => alive && d.lineups && setOfficial(d.lineups))
        .catch(() => {})
        .finally(() => alive && setChecking(false));
    };
    check();
    // Tant que l'onglet est ouvert, on revérifie toutes les 5 minutes : l'officiel peut tomber à tout moment.
    const t = setInterval(check, 5 * 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [
    tab,
    sport,
    official,
    match.competition,
    match.home,
    match.away,
    match.date,
  ]);

  const tabs: { id: Tab; label: string; hidden?: boolean }[] = [
    { id: "resume", label: "Résumé" },
    { id: "compos", label: "Compositions", hidden: sport !== "football" },
    { id: "marches", label: "Paris", hidden: !result.picks?.length },
    { id: "sources", label: `Sources (${totalSources})` },
  ];

  const team = (s: "home" | "away") => (
    <button
      onClick={() => openTeam(s)}
      className="group flex min-w-0 flex-1 flex-col items-center gap-2 rounded-2xl p-2 text-center transition hover:bg-white/10 active:scale-95"
      title="Voir la composition probable"
    >
      <span className="rounded-full bg-white p-1.5 shadow">
        <TeamLogo
          name={s === "home" ? match.home : match.away}
          sport={sport}
          size={44}
        />
      </span>
      <span className="line-clamp-2 font-display text-xl leading-none sm:text-2xl">
        {s === "home" ? match.home : match.away}
      </span>
      {sport === "football" && (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60 group-hover:text-white">
          Voir la compo
        </span>
      )}
    </button>
  );

  return (
    <div className="space-y-4">
      {result.demo && (
        <p className="rounded-lg bg-warn-bg px-4 py-2 text-sm text-warn-text">
          Mode démonstration : les sources et les chiffres ci-dessous sont
          fictifs.
        </p>
      )}
      {(calc || result.notice) && (
        <p className={`rounded-lg px-4 py-2 text-sm ${result.offline ? "bg-warn-bg font-medium text-warn-text" : "bg-surface-2 text-muted"}`}>
          {result.notice ??
            "Analyse calculée sans IA : elle repose uniquement sur les cotes et les statistiques."}
        </p>
      )}

      {/* En-tête façon tableau d'affichage : les deux équipes, le score prédit au centre. */}
      <header className="overflow-hidden rounded-3xl bg-[#121216] text-white">
        <div className="bg-gradient-to-r from-accent-strong to-accent px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider">
          {match.competition}
          {match.date ? ` · ${match.date}` : ""}
          {match.venue_or_surface ? ` · ${match.venue_or_surface}` : ""}
        </div>
        <div className="flex items-center gap-2 px-3 py-4">
          {team("home")}
          <div className="shrink-0 text-center">
            {playing ? (
              <>
                <p
                  className={`flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${playing.state === "in" ? "text-[#f87171]" : "text-white/60"}`}
                >
                  {playing.state === "in" && <LiveDot />}
                  {playing.state === "in"
                    ? `En direct · ${playing.clock}`
                    : "Terminé"}
                </p>
                <p className="font-display text-5xl leading-none tabular-nums">
                  {playing.homeScore}-{playing.awayScore}
                </p>
                <p className="mt-1 text-[11px] text-white/60">
                  Prédit :{" "}
                  {calc ? name(ai.predicted_outcome) : ai.score_prediction}
                </p>
              </>
            ) : (
              <>
                <p className="text-[10px] uppercase tracking-wider text-white/60">
                  {calc
                    ? "Pronostic"
                    : sport === "tennis"
                      ? "Sets probables"
                      : "Score probable"}
                </p>
                <p className="font-display text-4xl leading-none tabular-nums sm:text-5xl">
                  {calc ? name(ai.predicted_outcome) : ai.score_prediction}
                </p>
              </>
            )}
            <span className="mt-2 inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold">
              Confiance {ai.confidence}
            </span>
          </div>
          {team("away")}
        </div>
        {/* Probabilités de l'IA en une barre */}
        <div className="px-4 pb-4">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-white/10">
            {consensus.outcomes.map((o) => (
              <div
                key={o}
                className={OUTCOME_COLORS[o]}
                style={{ width: `${aiDist[o]}%` }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-xs tabular-nums text-white/80">
            {consensus.outcomes.map((o) => (
              <span key={o}>
                {o === "draw" ? "Nul" : o === "home" ? "1" : "2"}{" "}
                <strong className="text-white">{aiDist[o].toFixed(0)} %</strong>
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* Onglets de l'analyse */}
      <nav className="scrollbar-none sticky top-0 z-10 -mx-1 flex gap-1 overflow-x-auto rounded-2xl border border-border bg-surface p-1">
        {tabs
          .filter((t) => !t.hidden)
          .map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${tab === t.id ? "bg-accent text-on-accent" : "text-muted hover:text-text"}`}
            >
              {t.label}
            </button>
          ))}
      </nav>

      {tab === "resume" && (
        <div className="fade-in space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border-l-4 border-home bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Les pronostiqueurs
              </p>
              <p className="mt-1 font-display text-2xl leading-none">
                {consensus.pick ? name(consensus.pick) : "—"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {consensus.pick
                  ? `${consensus.agreement.toFixed(0)} % des votes · ${plural(totalSources, "source")}`
                  : "Pas assez de pronostics"}
              </p>
              <span
                className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${LEVEL_STYLES[consensus.level]}`}
              >
                Consensus {consensus.level}
              </span>
            </div>
            <div className="rounded-2xl border-l-4 border-accent bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {calc ? "Le calcul" : "L'IA"}
              </p>
              <p className="mt-1 font-display text-2xl leading-none">
                {name(ai.predicted_outcome)}
              </p>
              <p className="mt-1 text-xs text-muted">
                Confiance {ai.confidence}
              </p>
            </div>
          </div>

          <Card title={calc ? "Synthèse" : "L'avis de l'IA"}>
            <p className="leading-relaxed">{ai.summary}</p>
            {ai.consensus_comment && (
              <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm leading-relaxed text-muted">
                {ai.consensus_comment}
              </p>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <section className="rounded-2xl border border-success/30 bg-success-soft p-4">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-success">
                Points forts
              </h3>
              <ul className="space-y-1.5 text-sm">
                {ai.key_factors.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-success">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-2xl border border-danger/30 bg-accent-soft p-4">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-danger">
                Ce qui peut tout changer
              </h3>
              <ul className="space-y-1.5 text-sm">
                {ai.risks.map((r) => (
                  <li key={r} className="flex gap-2">
                    <span className="text-danger">!</span>
                    {r}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {consensus.divergences.length > 0 && (
            <section className="rounded-2xl bg-warn-bg p-4 text-warn-text">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide">
                Points de désaccord
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {consensus.divergences.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </section>
          )}

          <Card title="Forme et contexte">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border-l-4 border-home bg-surface-2 p-3">
                <p className="text-sm font-semibold">{match.home}</p>
                <p className="text-sm text-muted">{context.form_home}</p>
              </div>
              <div className="rounded-xl border-l-4 border-away bg-surface-2 p-3">
                <p className="text-sm font-semibold">{match.away}</p>
                <p className="text-sm text-muted">{context.form_away}</p>
              </div>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="font-semibold">Confrontations directes</dt>
                <dd className="text-muted">{context.head_to_head}</dd>
              </div>
              <div>
                <dt className="font-semibold">Absences</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {context.absences.length ? (
                    context.absences.map((a) => (
                      <span
                        key={a}
                        className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-danger"
                      >
                        {a}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted">Aucune signalée</span>
                  )}
                </dd>
              </div>
            </dl>
            {context.key_facts.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-muted">
                {context.key_facts.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
            )}
          </Card>

          {((context.recent_home?.length ?? 0) > 0 ||
            (context.recent_away?.length ?? 0) > 0 ||
            (context.h2h_games?.length ?? 0) > 0) && (
            <Card title="Derniers matchs et confrontations">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <GameList title={`Derniers matchs · ${match.home}`} team={match.home} games={context.recent_home} />
                <GameList title={`Derniers matchs · ${match.away}`} team={match.away} games={context.recent_away} />
              </div>
              <div className="mt-4">
                <GameList title="Confrontations directes" team={match.home} games={context.h2h_games} h2h />
              </div>
            </Card>
          )}

          <Card title="Comparaison des probabilités">
            <ProbBar
              label="Bookmakers"
              hint={`marge retirée · ${plural(consensus.counts.bookmaker + consensus.counts.exchange, "source")}`}
              dist={consensus.market}
              outcomes={consensus.outcomes}
              name={name}
            />
            <ProbBar
              label="Modèles statistiques"
              hint={plural(consensus.counts.stats_model, "source")}
              dist={consensus.models}
              outcomes={consensus.outcomes}
              name={name}
            />
            <ProbBar
              label="Vote de toutes les sources"
              hint="pondéré : cotes ×3, modèles ×2, avis ×1"
              dist={consensus.pick ? consensus.votes : null}
              outcomes={consensus.outcomes}
              name={name}
            />
            <ProbBar
              label={calc ? "Calcul automatique" : "Analyse de l'IA"}
              hint={calc ? "cotes 60 % + modèle 40 %" : undefined}
              dist={aiDist}
              outcomes={consensus.outcomes}
              name={name}
            />
          </Card>

          {analysis.secondary_trends.length > 0 && (
            <Card title="Tendances des pronostiqueurs">
              <ul className="space-y-1.5">
                {analysis.secondary_trends.map((t) => (
                  <li
                    key={t.market}
                    className="flex flex-wrap justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{t.market}</span>
                    <span className="text-muted">{t.verdict}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {tab === "compos" && (
        <div className="fade-in space-y-3">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-surface p-1">
            {(["home", "away"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={`flex items-center justify-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold transition ${
                  side === s
                    ? s === "home"
                      ? "bg-home text-white"
                      : "bg-away text-white"
                    : "text-muted"
                }`}
              >
                <TeamLogo
                  name={s === "home" ? match.home : match.away}
                  sport={sport}
                  size={20}
                />
                <span className="truncate">
                  {s === "home" ? match.home : match.away}
                </span>
              </button>
            ))}
          </div>
          {lineups ? (
            <>
              <div className="flex items-baseline justify-between">
                <p className="font-display text-3xl leading-none">
                  {lineups[side].formation}
                </p>
                {lineups[side].status === "officielle" ? (
                  <span className="rounded-full bg-success px-2.5 py-0.5 text-xs font-bold text-on-accent">
                    ✓ Composition officielle
                  </span>
                ) : (
                  <span className="rounded-full bg-warn-bg px-2.5 py-0.5 text-xs font-semibold text-warn-text">
                    Probable
                    {lineups[side].source ? ` · ${lineups[side].source}` : ""}
                  </span>
                )}
              </div>
              <Pitch
                lineup={lineups[side]}
                team={side === "home" ? match.home : match.away}
                fallback={side === "home" ? "#1d4ed8" : "#c2410c"}
              />
              {lineups[side].doubts.length > 0 && (
                <p className="rounded-xl bg-warn-bg p-3 text-sm text-warn-text">
                  <strong>Incertains : </strong>
                  {lineups[side].doubts.join(" · ")}
                </p>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
              {checking
                ? "Recherche de la composition officielle…"
                : "Aucune composition publiée trouvée pour ce match. L'officielle s'affichera ici dès sa publication (environ une heure avant le coup d'envoi) : la page vérifie toutes les 5 minutes."}
            </div>
          )}
        </div>
      )}

      {tab === "marches" && result.picks && (
        <div className="fade-in">
          <MarketsPanel picks={result.picks} />
        </div>
      )}

      {tab === "sources" && (
        <div className="fade-in space-y-4">
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {analysis.sources.map((s, i) => (
              <SourceCard
                key={`${s.url}-${i}`}
                s={s}
                name={name}
                sport={sport}
              />
            ))}
          </ul>
          {consultedPages.length > 0 && (
            <details className="rounded-2xl border border-border bg-surface p-4">
              <summary className="cursor-pointer text-sm font-semibold text-muted">
                {consultedPages.length} page
                {consultedPages.length > 1 ? "s" : ""} consultée
                {consultedPages.length > 1 ? "s" : ""}
              </summary>
              <ul className="mt-3 space-y-1 text-sm">
                {consultedPages.map((p) => (
                  <li key={p.url} className="truncate">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      {p.title || p.url}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <p className="text-xs text-muted">
        Analyse du {new Date(result.createdAt).toLocaleString("fr-FR")}
        {usage.geminiRequests > 0 &&
          ` · ${usage.geminiRequests} requêtes IA · ${usage.webSearches} recherches web`}
        . Aide à la réflexion, pas une garantie : aucun pronostic n&apos;est
        sûr. Pariez de façon responsable.
      </p>
    </div>
  );
}

const plain = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
// Côté de l'équipe dans le match : nom identique d'abord, puis nom approchant si un seul côté correspond.
function teamSide(team: string, g: PastGame): "home" | "away" | null {
  if (plain(g.home) === plain(team)) return "home";
  if (plain(g.away) === plain(team)) return "away";
  const h = sameTeam(g.home, team);
  const a = sameTeam(g.away, team);
  return h && !a ? "home" : a && !h ? "away" : null;
}

// Résultat d'un match du point de vue d'une équipe : V (victoire), N (nul), D (défaite).
function gameResult(team: string, g: PastGame): "V" | "N" | "D" | null {
  const [h, a] = g.score.split("-").map((x) => Number(x.trim()));
  if (!Number.isFinite(h) || !Number.isFinite(a)) return null;
  if (h === a) return "N";
  const side = teamSide(team, g);
  if (!side) return null;
  const isHome = side === "home";
  return (h > a) === isHome ? "V" : "D";
}

const RESULT_STYLE = { V: "bg-success text-white", N: "bg-draw text-white", D: "bg-danger text-white" } as const;

/** Liste des derniers matchs d'une équipe (avec V/N/D) ou des confrontations directes. */
function GameList({ title, team, games, h2h = false }: { title: string; team: string; games?: PastGame[]; h2h?: boolean }) {
  const list = games ?? [];
  const results = list.map((g) => gameResult(team, g));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        {!h2h && (
          <div className="flex gap-1">
            {results.map((r, i) =>
              r ? (
                <span key={i} className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${RESULT_STYLE[r]}`}>
                  {r}
                </span>
              ) : null,
            )}
          </div>
        )}
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-muted">Non disponibles.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface-2 text-sm">
          {list.map((g, i) => {
            const r = results[i];
            return (
              <li key={`${g.date}-${g.home}-${i}`} className="flex items-center gap-2 px-3 py-2">
                <span className="w-12 shrink-0 text-xs text-muted">
                  {g.date ? new Date(g.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—"}
                </span>
                <span className={`min-w-0 flex-1 truncate text-right ${teamSide(team, g) === "home" ? "font-semibold" : ""}`}>{g.home}</span>
                <span className="shrink-0 rounded-md bg-surface px-2 py-0.5 font-display text-base tabular-nums">{g.score}</span>
                <span className={`min-w-0 flex-1 truncate ${teamSide(team, g) === "away" ? "font-semibold" : ""}`}>{g.away}</span>
                {!h2h && r && <span className={`h-2 w-2 shrink-0 rounded-full ${RESULT_STYLE[r].split(" ")[0]}`} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
