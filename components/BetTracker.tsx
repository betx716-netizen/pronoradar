"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABELS } from "@/lib/coupon";
import { fcfa } from "@/lib/value";
import {
  findLive,
  legState,
  useLiveScores,
  type LegState,
  type LiveMatch,
} from "@/lib/live";
import { LiveDot } from "./LiveBoard";
import {
  loadHistory,
  profit,
  removeBet,
  removeBets,
  syncHistory,
  updateBet,
  type BetStatus,
  type SavedBet,
  type SyncState,
} from "@/lib/history";

const STATUS: Record<BetStatus, { label: string; on: string; badge: string }> =
  {
    en_cours: {
      label: "En cours",
      on: "bg-surface-3 text-text",
      badge: "bg-surface-3 text-muted",
    },
    gagne: {
      label: "Gagné",
      on: "bg-success text-on-accent",
      badge: "bg-success-soft text-success",
    },
    perdu: {
      label: "Perdu",
      on: "bg-danger text-on-accent",
      badge: "bg-accent-soft text-danger",
    },
    rembourse: {
      label: "Remboursé",
      on: "bg-draw text-on-accent",
      badge: "bg-surface-3 text-draw",
    },
  };

type Filter = "tous" | BetStatus;
const FILTERS: { id: Filter; label: string }[] = [
  { id: "tous", label: "Tous" },
  { id: "en_cours", label: "En cours" },
  { id: "gagne", label: "Gagnés" },
  { id: "perdu", label: "Perdus" },
];

const LEG_BADGE: Record<LegState, { icon: string; cls: string } | null> = {
  won: { icon: "✓", cls: "bg-success text-on-accent" },
  lost: { icon: "✗", cls: "bg-danger text-on-accent" },
  push: { icon: "=", cls: "bg-draw text-on-accent" },
  pending: null,
  unknown: null,
};

// « Équipe A – Équipe B » → les deux équipes.
const teamsOf = (match: string) => {
  const [home, away] = match.split(/\s+[–-]\s+/);
  return { home: home ?? match, away: away ?? "" };
};

/** Résultat d'un coupon d'après les scores : perdu dès qu'une sélection est perdue, gagné quand toutes sont gagnées. */
function couponOutcome(
  states: LegState[],
): "gagne" | "perdu" | "rembourse" | null {
  if (states.includes("lost")) return "perdu";
  if (states.some((x) => x === "pending" || x === "unknown")) return null;
  if (states.every((x) => x === "push")) return "rembourse";
  return "gagne";
}

// Type de coupon, pour comparer ce qui rapporte : grand combiné, grosse cote, value, petit combiné, simple…
function couponType(b: SavedBet) {
  if (/value/i.test(b.profile)) return "Value";
  if (b.legs.length >= 8) return "Grand combiné (8+)";
  if (b.totalOdds >= 10) return "Grosse cote (10+)";
  if (b.legs.length === 1) return "Pari simple";
  if (b.legs.length <= 3) return "Petit combiné (2-3)";
  return "Combiné (4-7)";
}

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function BetCard({ b, live }: { b: SavedBet; live: LiveMatch[] }) {
  const [open, setOpen] = useState(b.legs.length <= 3);
  const gain = b.stake * b.totalOdds;
  const settledProfit = profit(b);
  const shown = open ? b.legs : b.legs.slice(0, 3);

  return (
    <li className="fade-in overflow-hidden rounded-2xl border border-border bg-surface">
      {/* En-tête : profil, date, statut */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-bold leading-tight">
            {b.profile}
          </p>
          <p className="text-xs text-muted">
            {dateLabel(b.createdAt)} · {b.legs.length} sélection
            {b.legs.length > 1 ? "s" : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${STATUS[b.status].badge}`}
        >
          {STATUS[b.status].label}
        </span>
      </div>

      {/* Chiffres clés */}
      <div className="grid grid-cols-3 divide-x divide-border border-b border-border text-center">
        <div className="px-2 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted">Cote</p>
          <p className="font-display text-2xl leading-none tabular-nums text-accent">
            {b.totalOdds.toFixed(2)}
          </p>
        </div>
        <div className="px-2 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted">Mise</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums">
            {fcfa(b.stake)}
          </p>
        </div>
        <div className="px-2 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted">
            {b.status === "gagne" || b.status === "perdu"
              ? "Résultat"
              : "Gain possible"}
          </p>
          <p
            className={`mt-0.5 text-sm font-bold tabular-nums ${
              b.status === "gagne"
                ? "text-success"
                : b.status === "perdu"
                  ? "text-danger"
                  : ""
            }`}
          >
            {b.status === "gagne" || b.status === "perdu"
              ? fcfa(settledProfit, true)
              : fcfa(gain)}
          </p>
        </div>
      </div>

      {/* Sélections : texte complet, sur plusieurs lignes si besoin */}
      <ol className="divide-y divide-border">
        {shown.map((l, i) => {
          const { home, away } = teamsOf(l.match);
          const m = findLive(live, home, away);
          const st = legState(l.pick, home, away, m);
          const badge = LEG_BADGE[st];
          return (
            <li
              key={`${l.match}-${i}`}
              className="flex items-start gap-3 px-4 py-2.5"
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${badge ? badge.cls : "bg-surface-3"}`}
              >
                {badge ? badge.icon : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold leading-snug">
                  {l.pick.selection}
                </p>
                <p className="break-words text-xs text-muted">
                  {l.match}
                  {l.competition ? ` · ${l.competition}` : ""} ·{" "}
                  {CATEGORY_LABELS[l.pick.category]}
                </p>
                {m && m.state !== "pre" && (
                  <p
                    className={`mt-1 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-bold ${m.state === "in" ? "bg-accent-soft text-danger" : "bg-surface-2 text-muted"}`}
                  >
                    {m.state === "in" && <LiveDot />}
                    {m.homeScore}-{m.awayScore} ·{" "}
                    {m.state === "in" ? m.clock : "Terminé"}
                  </p>
                )}
              </div>
              <span className="shrink-0 rounded-lg bg-accent-soft px-2 py-0.5 text-sm font-bold tabular-nums text-accent">
                {l.pick.odds.toFixed(2)}
              </span>
            </li>
          );
        })}
      </ol>
      {b.legs.length > 3 && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full border-t border-border py-2 text-xs font-semibold text-accent"
        >
          {open ? "Réduire" : `Voir les ${b.legs.length - 3} autres sélections`}
        </button>
      )}

      {/* Résultat à renseigner */}
      <div className="flex items-center gap-2 border-t border-border bg-surface-2 p-2">
        <div className="grid flex-1 grid-cols-4 gap-1 rounded-xl bg-surface p-1">
          {(Object.keys(STATUS) as BetStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => updateBet(b.id, { status: s })}
              className={`rounded-lg px-1 py-1.5 text-[11px] font-semibold transition active:scale-95 sm:text-xs ${b.status === s ? STATUS[s].on : "text-muted"}`}
            >
              {STATUS[s].label}
            </button>
          ))}
        </div>
        <button
          onClick={() =>
            confirm("Supprimer ce coupon du suivi ?") && removeBet(b.id)
          }
          aria-label="Supprimer"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-accent-soft hover:text-danger"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden
          >
            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
          </svg>
        </button>
      </div>
    </li>
  );
}

/** Historique des coupons joués : bilan, réussite par marché, et chaque coupon avec son résultat à renseigner. */
export function BetTracker() {
  const [bets, setBets] = useState<SavedBet[]>([]);
  const [sync, setSync] = useState<SyncState | "loading">("loading");
  const [filter, setFilter] = useState<Filter>("tous");
  // Scores en direct des championnats des coupons en cours (et du jour), pour suivre et clore les coupons tout seuls.
  const liveLeagues = bets
    .filter((b) => b.status === "en_cours")
    .flatMap((b) => b.legs.map((l) => l.competition));
  const { matches: live } = useLiveScores(liveLeagues);

  useEffect(() => {
    const refresh = () => setBets(loadHistory());
    refresh();
    syncHistory().then(setSync);
    window.addEventListener("pronoradar-history", refresh);
    return () => window.removeEventListener("pronoradar-history", refresh);
  }, []);

  // Clôture automatique : un coupon en cours passe à Gagné, Perdu ou Remboursé dès que les scores le permettent.
  useEffect(() => {
    if (live.length === 0) return;
    for (const b of bets) {
      if (b.status !== "en_cours") continue;
      const outcome = couponOutcome(
        b.legs.map((l) => {
          const { home, away } = teamsOf(l.match);
          return legState(l.pick, home, away, findLive(live, home, away));
        }),
      );
      if (outcome) updateBet(b.id, { status: outcome });
    }
  }, [live, bets]);

  const syncNote = {
    loading: "Synchronisation…",
    synced: "Sauvegardé en ligne, disponible sur tous vos appareils.",
    local:
      "Sauvegarde en ligne non configurée : historique gardé sur cet appareil.",
    error:
      "Sauvegarde en ligne injoignable : l'historique sera envoyé à la prochaine synchronisation.",
  }[sync];

  if (bets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
        {sync === "loading"
          ? "Chargement de l'historique…"
          : "Aucun coupon enregistré. Dans l'onglet Coupon, touchez « J'ai joué » pour commencer le suivi."}
      </div>
    );
  }

  const settled = bets.filter(
    (b) => b.status === "gagne" || b.status === "perdu",
  );
  const staked = settled.reduce((t, b) => t + b.stake, 0);
  const net = settled.reduce((t, b) => t + profit(b), 0);
  const won = settled.filter((b) => b.status === "gagne").length;
  const expected = settled.reduce((t, b) => t + b.probability / 100, 0);
  const pending = bets.filter((b) => b.status === "en_cours");
  const atStake = pending.reduce((t, b) => t + b.stake, 0);
  const rate = settled.length ? (won / settled.length) * 100 : 0;

  // Réussite par marché : uniquement les paris simples, où le résultat dit si ce pari précis est passé.
  const byMarket = new Map<string, { won: number; total: number }>();
  for (const b of settled.filter((x) => x.legs.length === 1)) {
    const key = CATEGORY_LABELS[b.legs[0].pick.category];
    const m = byMarket.get(key) ?? { won: 0, total: 0 };
    m.total++;
    if (b.status === "gagne") m.won++;
    byMarket.set(key, m);
  }

  const list =
    filter === "tous" ? bets : bets.filter((b) => b.status === filter);

  // Rentabilité par type de coupon : le meilleur indicateur pour savoir quelle méthode garder.
  const byType = new Map<string, { n: number; won: number; staked: number; net: number }>();
  for (const b of settled) {
    const k = couponType(b);
    const t = byType.get(k) ?? { n: 0, won: 0, staked: 0, net: 0 };
    t.n++;
    if (b.status === "gagne") t.won++;
    t.staked += b.stake;
    t.net += profit(b);
    byType.set(k, t);
  }
  const types = [...byType].sort((a, b) => b[1].net / (b[1].staked || 1) - a[1].net / (a[1].staked || 1));

  return (
    <div className="space-y-5">
      {/* Bilan */}
      <section className="overflow-hidden rounded-3xl bg-[#121216] p-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
          Bénéfice net
        </p>
        <p
          className={`font-display text-5xl leading-none tabular-nums ${net >= 0 ? "text-[#34d399]" : "text-[#f87171]"}`}
        >
          {fcfa(net, true)}
        </p>
        <p className="mt-1 text-sm text-white/60">
          sur {fcfa(staked)} misés · rentabilité{" "}
          {staked ? `${((net / staked) * 100).toFixed(1)} %` : "—"}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="font-display text-3xl leading-none tabular-nums">
              {won}/{settled.length}
            </p>
            <p className="mt-1 text-[11px] text-white/70">Coupons gagnés</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="font-display text-3xl leading-none tabular-nums">
              {settled.length ? `${rate.toFixed(0)} %` : "—"}
            </p>
            <p className="mt-1 text-[11px] text-white/70">Taux de réussite</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="font-display text-3xl leading-none tabular-nums">
              {pending.length}
            </p>
            <p className="mt-1 text-[11px] text-white/70">
              En cours · {fcfa(atStake)}
            </p>
          </div>
        </div>
        {settled.length > 0 && (
          <div className="mt-4">
            <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
              <div className="bg-[#34d399]" style={{ width: `${rate}%` }} />
              <div
                className="bg-[#f87171]"
                style={{ width: `${100 - rate}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-white/60">
              Attendu d&apos;après nos probabilités : {expected.toFixed(1)}{" "}
              coupon{expected >= 2 ? "s" : ""} gagné{expected >= 2 ? "s" : ""}
            </p>
          </div>
        )}
      </section>

      {settled.length > 0 && settled.length < 30 && (
        <p className="rounded-xl bg-surface-2 p-3 text-xs text-muted">
          Moins de 30 coupons terminés : trop peu pour juger la fiabilité des
          analyses, la chance pèse encore beaucoup.
        </p>
      )}
      {settled.length >= 10 && won < expected * 0.8 && (
        <p className="rounded-xl bg-warn-bg p-3 text-sm text-warn-text">
          Vous gagnez nettement moins que prévu : nos probabilités semblent trop
          optimistes. Réduisez les mises ou visez des cotes plus basses.
        </p>
      )}

      {types.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">Rentabilité par type de coupon</h3>
          <p className="mb-3 text-xs text-muted">Du plus rentable au moins rentable : gardez ce qui gagne, abandonnez ce qui perd.</p>
          <ul className="space-y-2">
            {types.map(([k, t]) => {
              const roi = t.staked ? (t.net / t.staked) * 100 : 0;
              return (
                <li key={k} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{k}</p>
                    <p className="text-xs text-muted">
                      {t.won}/{t.n} gagnés · {fcfa(t.staked)} misés
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-display text-2xl leading-none tabular-nums ${t.net >= 0 ? "text-success" : "text-danger"}`}>{fcfa(t.net, true)}</p>
                    <p className={`text-xs font-semibold tabular-nums ${roi >= 0 ? "text-success" : "text-danger"}`}>
                      {roi >= 0 ? "+" : ""}
                      {roi.toFixed(1)} %
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {byMarket.size > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Réussite par marché (paris simples)
          </h3>
          <ul className="space-y-2.5">
            {[...byMarket].map(([k, m]) => {
              const pct = (m.won / m.total) * 100;
              return (
                <li key={k}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium">{k}</span>
                    <span className="tabular-nums text-muted">
                      {m.won}/{m.total} ·{" "}
                      <strong className="text-text">{pct.toFixed(0)} %</strong>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className={
                        pct >= 55 ? "h-full bg-success" : "h-full bg-gold"
                      }
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Filtres */}
      <div className="flex gap-1 rounded-2xl border border-border bg-surface p-1">
        {FILTERS.map((f) => {
          const n =
            f.id === "tous"
              ? bets.length
              : bets.filter((b) => b.status === f.id).length;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex-1 rounded-xl px-2 py-2 text-sm font-semibold transition ${filter === f.id ? "bg-accent text-on-accent" : "text-muted"}`}
            >
              {f.label}
              <span className="ml-1 text-xs opacity-75">{n}</span>
            </button>
          );
        })}
      </div>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
          Aucun coupon dans cette catégorie.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {list.map((b) => (
            <BetCard key={b.id} b={b} live={live} />
          ))}
        </ul>
      )}

      <p className="text-center text-xs text-muted">{syncNote}</p>
      <button
        onClick={() =>
          confirm(`Effacer les ${bets.length} coupons du suivi, sur tous vos appareils ?`) &&
          removeBets(bets.map((b) => b.id))
        }
        className="mx-auto block text-xs font-semibold text-muted underline hover:text-danger"
      >
        Tout effacer le suivi
      </button>
    </div>
  );
}
