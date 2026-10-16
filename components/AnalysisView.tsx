"use client";

import { SOURCE_WEIGHTS, sourceDistribution, sourcePick, type Consensus, type Distribution } from "@/lib/consensus";
import type { AnalysisResult, Outcome, Source, SourceType } from "@/lib/schemas";

const TYPE_LABELS: Record<SourceType, string> = {
  bookmaker: "Bookmaker",
  exchange: "Bourse de paris",
  stats_model: "Modèle statistique",
  tipster: "Pronostiqueur",
  media: "Média",
};

const LEVEL_STYLES: Record<Consensus["level"], string> = {
  fort: "bg-accent-soft text-accent",
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

function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-surface p-4 sm:p-5 ${className}`}>
      {title && <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>}
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
              <div key={o} className={OUTCOME_COLORS[o]} style={{ width: `${dist[o]}%` }} title={`${name(o)} : ${dist[o].toFixed(0)} %`} />
            ))}
          </div>
          <div className="mt-1 flex justify-between gap-2 text-xs tabular-nums text-muted">
            {outcomes.map((o) => (
              <span key={o}>
                {name(o)} <strong className="text-text">{dist[o].toFixed(0)} %</strong>
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="text-xs text-muted">Aucune donnée trouvée pour cette catégorie.</p>
      )}
    </div>
  );
}

function SourceCard({ s, name, sport }: { s: Source; name: (o: Outcome) => string; sport: "football" | "tennis" }) {
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
          <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
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
        <p className="mt-0.5 truncate text-xs text-muted">{[host, s.published].filter(Boolean).join(" · ")}</p>
      )}
      <p className="mt-2 text-sm">
        Pronostic :{" "}
        {pick ? (
          <strong className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${OUTCOME_COLORS[pick]}`} />
            {name(pick)}
          </strong>
        ) : (
          <span className="text-muted">ne tranche pas</span>
        )}
        {dist && (
          <span className="ml-2 text-xs tabular-nums text-muted">
            ({hasOdds ? "cotes " : ""}
            {hasOdds
              ? [s.odds_home, s.odds_draw, s.odds_away].filter((v) => v != null).join(" / ")
              : [s.prob_home, s.prob_draw, s.prob_away].filter((v) => v != null).map((v) => `${v} %`).join(" / ")}
            )
          </span>
        )}
      </p>
      {s.reasoning && <p className="mt-1 text-sm text-muted">{s.reasoning}</p>}
      {s.other_tips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {s.other_tips.map((t) => (
            <span key={t} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs">
              {t}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

export function AnalysisView({ result }: { result: AnalysisResult }) {
  const { analysis, consensus, usage, consultedPages } = result;
  const { match, ai_analysis: ai, context } = analysis;
  const sport = match.sport;
  const name = (o: Outcome) => (o === "home" ? match.home : o === "away" ? match.away : "Nul");
  const aiRaw: Distribution = { home: ai.prob_home, draw: ai.prob_draw, away: ai.prob_away };
  const aiTotal = consensus.outcomes.reduce((s, o) => s + aiRaw[o], 0) || 1;
  const aiDist: Distribution = { home: 0, draw: 0, away: 0 };
  for (const o of consensus.outcomes) aiDist[o] = (aiRaw[o] / aiTotal) * 100;
  const totalSources = analysis.sources.length;
  const calc = result.engine === "calcul";

  return (
    <div className="space-y-4">
      {result.demo && (
        <p className="rounded-lg bg-warn-bg px-4 py-2 text-sm text-warn-text">
          Mode démonstration : les sources et les chiffres ci-dessous sont fictifs.
        </p>
      )}

      {calc && (
        <p className="rounded-lg bg-surface-2 px-4 py-2 text-sm text-muted">
          Analyse calculée sans IA (pas de clé Gemini) : elle repose uniquement sur les cotes et les statistiques.
        </p>
      )}

      <header className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <p className="text-sm text-muted">
          {match.competition}
          {match.date ? ` · ${match.date}` : ""}
          {match.venue_or_surface ? ` · ${match.venue_or_surface}` : ""}
        </p>
        <h2 className="mt-1 flex flex-wrap items-center gap-x-3 text-2xl font-bold">
          <span className="text-home">{match.home}</span>
          <span className="text-base font-normal text-muted">contre</span>
          <span className="text-away">{match.away}</span>
        </h2>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Ce que disent les pronostics">
          {consensus.pick ? (
            <>
              <p className="text-2xl font-bold">{name(consensus.pick)}</p>
              <p className="mt-1 text-sm text-muted">
                {consensus.agreement.toFixed(0)} % du vote pondéré · {plural(totalSources, "source")} recensée{totalSources > 1 ? "s" : ""}
              </p>
            </>
          ) : (
            <p className="text-muted">Pas assez de pronostics trouvés.</p>
          )}
          <span className={`mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${LEVEL_STYLES[consensus.level]}`}>
            Consensus {consensus.level}
          </span>
        </Card>
        <Card title={calc ? "Le calcul automatique" : "L'analyse de l'IA"}>
          <p className="text-2xl font-bold">{name(ai.predicted_outcome)}</p>
          {!calc && (
            <p className="mt-1 text-sm text-muted">
              {sport === "tennis" ? "Sets probables" : "Score probable"} : <strong className="text-text">{ai.score_prediction}</strong>
            </p>
          )}
          <span className="mt-3 inline-block rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold">
            Confiance {ai.confidence}
          </span>
        </Card>
      </div>

      <Card title="Comparaison des probabilités">
        <ProbBar label="Bookmakers" hint={`marge retirée · ${plural(consensus.counts.bookmaker + consensus.counts.exchange, "source")}`} dist={consensus.market} outcomes={consensus.outcomes} name={name} />
        <ProbBar label="Modèles statistiques" hint={plural(consensus.counts.stats_model, "source")} dist={consensus.models} outcomes={consensus.outcomes} name={name} />
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

      {consensus.divergences.length > 0 && (
        <section className="rounded-xl bg-warn-bg p-4 text-warn-text sm:p-5">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide">Points de désaccord</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {consensus.divergences.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </section>
      )}

      <Card title="Ce qui ressort">
        <p className="leading-relaxed">{ai.consensus_comment}</p>
        {analysis.secondary_trends.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {analysis.secondary_trends.map((t) => (
              <li key={t.market} className="flex flex-wrap justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                <span className="font-medium">{t.market}</span>
                <span className="text-muted">{t.verdict}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={calc ? "Synthèse automatique" : "Analyse détaillée de l'IA"}>
        <p className="leading-relaxed">{ai.summary}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="mb-1.5 text-sm font-semibold">Facteurs clés</h4>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {ai.key_factors.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-1.5 text-sm font-semibold">Ce qui pourrait tout changer</h4>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {ai.risks.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card title="Contexte du match">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold">Forme de {match.home}</dt>
            <dd className="text-muted">{context.form_home}</dd>
          </div>
          <div>
            <dt className="font-semibold">Forme de {match.away}</dt>
            <dd className="text-muted">{context.form_away}</dd>
          </div>
          <div>
            <dt className="font-semibold">Confrontations directes</dt>
            <dd className="text-muted">{context.head_to_head}</dd>
          </div>
          <div>
            <dt className="font-semibold">Absences</dt>
            <dd className="text-muted">{context.absences.length ? context.absences.join(" · ") : "Aucune signalée"}</dd>
          </div>
        </dl>
        {context.key_facts.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {context.key_facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Les ${totalSources} pronostics recensés`}>
        <ul className="grid gap-3 md:grid-cols-2">
          {analysis.sources.map((s, i) => (
            <SourceCard key={`${s.url}-${i}`} s={s} name={name} sport={sport} />
          ))}
        </ul>
      </Card>

      {consultedPages.length > 0 && (
        <details className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <summary className="cursor-pointer text-sm font-semibold text-muted">
            {consultedPages.length} page{consultedPages.length > 1 ? "s" : ""} consultée{consultedPages.length > 1 ? "s" : ""} pendant la recherche
          </summary>
          <ul className="mt-3 space-y-1 text-sm">
            {consultedPages.map((p) => (
              <li key={p.url} className="truncate">
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  {p.title || p.url}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-xs text-muted">
        Analyse du {new Date(result.createdAt).toLocaleString("fr-FR")}
        {usage.geminiRequests > 0 && ` · ${usage.geminiRequests} requêtes Gemini · ${usage.webSearches} recherches Google`}
        {usage.apiFootballRequestsRemaining !== null && ` · ${usage.apiFootballRequestsRemaining} requêtes API-Football restantes aujourd'hui`}
        . Ces informations sont une aide à la réflexion, pas une garantie : aucun pronostic n'est sûr. Pariez de façon responsable.
      </p>
    </div>
  );
}
