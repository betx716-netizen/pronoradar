"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CATEGORY_LABELS,
  PROFILES,
  buildCoupon,
  type RiskProfile,
} from "@/lib/coupon";
import type { AnalysisResult, MarketCategory } from "@/lib/schemas";
import { addBet } from "@/lib/history";
import { CouponCoach } from "./CouponCoach";
import { kellyStake } from "@/lib/value";

const FOOTBALL_CATEGORIES: MarketCategory[] = [
  "resultat",
  "double_chance",
  "rembourse",
  "mi_temps",
  "mi_temps_fin",
  "handicap",
  "buts",
  "buts_equipe",
  "les_deux_marquent",
  "resultat_buts",
  "resultat_btts",
  "score_exact",
  "corners",
  "tirs_cadres",
  "fautes",
  "cartons",
  "hors_jeu",
];
const TENNIS_CATEGORIES: MarketCategory[] = [
  "resultat",
  "sets",
  "jeux",
  "premier_set",
  "handicap_jeux",
  "score_sets",
  "tie_break",
];
const JACKPOT_CATEGORIES: MarketCategory[] = [
  "score_exact",
  "mi_temps_fin",
  "resultat_btts",
  "resultat_buts",
  "handicap",
  "mi_temps",
  "score_sets",
  "handicap_jeux",
];
const DEFAULT_CATEGORIES: MarketCategory[] = [
  "resultat",
  "double_chance",
  "rembourse",
  "buts",
  "buts_equipe",
  "les_deux_marquent",
  "sets",
  "jeux",
  "premier_set",
];

export function CouponBuilder({
  results,
  onClear,
}: {
  results: AnalysisResult[];
  onClear: () => void;
}) {
  const [profile, setProfile] = useState<RiskProfile>("equilibre");
  const [size, setSize] = useState(4);
  const [categories, setCategories] =
    useState<MarketCategory[]>(DEFAULT_CATEGORIES);
  const [copied, setCopied] = useState(false);
  const [bankroll, setBankroll] = useState(100);
  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem("pronoradar.bankroll"));
      if (stored) setBankroll(stored);
    } catch {}
  }, []);
  const [saved, setSaved] = useState(false);

  const available = results.some((r) => r.analysis.match.sport === "tennis")
    ? [...new Set([...FOOTBALL_CATEGORIES, ...TENNIS_CATEGORIES])]
    : FOOTBALL_CATEGORIES;
  // Matchs retirés sur conseil du coach : exclus du coupon jusqu'à ce qu'on les rétablisse.
  const [excluded, setExcluded] = useState<string[]>([]);
  const [forced, setForced] = useState<Record<string, string>>({});
  const pool = useMemo(
    () =>
      results.filter(
        (r) =>
          !excluded.includes(
            `${r.analysis.match.home} – ${r.analysis.match.away}`,
          ),
      ),
    [results, excluded],
  );
  const coupon = useMemo(
    () => buildCoupon(pool, { profile, size, categories, forced }),
    [pool, profile, size, categories, forced],
  );

  // Le profil Grosse cote a besoin des marchés à forte cote : on les active d'office.
  function chooseProfile(p: RiskProfile) {
    setProfile(p);
    if (p === "jackpot")
      setCategories((prev) => [...new Set([...prev, ...JACKPOT_CATEGORIES])]);
  }

  const toggle = (c: MarketCategory) =>
    setCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );

  const kelly = kellyStake(bankroll, coupon.probability, coupon.totalOdds);
  const suggestedStake =
    profile === "jackpot" ? Math.min(kelly, Math.round(bankroll) / 100) : kelly;
  const [stakeInput, setStakeInput] = useState("");
  const stake =
    stakeInput === ""
      ? suggestedStake
      : Number(stakeInput.replace(",", ".")) || 0;

  function changeBankroll(v: number) {
    setBankroll(v);
    try {
      localStorage.setItem("pronoradar.bankroll", String(v));
    } catch {}
  }

  function save() {
    addBet({
      profile: PROFILES[profile].label,
      legs: coupon.legs,
      totalOdds: coupon.totalOdds,
      probability: coupon.probability,
      stake,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function copy() {
    const text = [
      `Coupon PronoRadar — ${PROFILES[profile].label}`,
      ...coupon.legs.map(
        (l) =>
          `• ${l.match} : ${l.pick.selection} @ ${l.pick.odds.toFixed(2)} (${l.pick.probability.toFixed(0)} %)`,
      ),
      `Cote totale : ${coupon.totalOdds.toFixed(2)} · Probabilité : ${coupon.probability.toFixed(1)} %`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  if (results.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
        Analysez d&apos;abord quelques matchs : le coupon se construit à partir
        de leurs analyses.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="space-y-5 rounded-2xl border border-border bg-surface p-5">
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            Profil de risque
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(PROFILES) as RiskProfile[]).map((p) => (
              <button
                key={p}
                onClick={() => chooseProfile(p)}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                  profile === p
                    ? "border-accent bg-accent-soft"
                    : "border-border hover:border-muted"
                }`}
              >
                <span className="block font-semibold">{PROFILES[p].label}</span>
                <span className="text-xs text-muted">
                  ≥ {PROFILES[p].minProbability} % par sélection
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            {PROFILES[profile].description}
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Nombre de sélections
            </h3>
            <span className="text-lg font-bold tabular-nums">{size}</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
            aria-label="Nombre de sélections"
          />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            Marchés autorisés
          </h3>
          <div className="flex flex-wrap gap-2">
            {available.map((c) => {
              const on = categories.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => toggle(c)}
                  aria-pressed={on}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    on
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border text-muted hover:text-text"
                  }`}
                >
                  {on ? "✓ " : ""}
                  {CATEGORY_LABELS[c]}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">
            Hors résultat, double chance, remboursé si nul et ligne de buts, les
            marchés reposent sur des estimations de l&apos;IA : vérifiez la cote
            chez votre bookmaker.
          </p>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-b from-surface-2 to-surface p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Coupon proposé
            </p>
            <p className="text-sm text-muted">
              {PROFILES[profile].label} · {coupon.legs.length} sélection
              {coupon.legs.length > 1 ? "s" : ""}
            </p>
          </div>
          {coupon.legs.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (
                    confirm(
                      "Supprimer ce coupon ? Les matchs analysés jusqu'ici n'y seront plus proposés : relancez des analyses pour en construire un nouveau.",
                    )
                  ) {
                    setExcluded([]);
                    setForced({});
                    onClear();
                  }
                }}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:border-danger hover:text-danger"
              >
                Supprimer
              </button>
              <button
                onClick={copy}
                className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-gold"
              >
                {copied ? "Copié ✓" : "Copier"}
              </button>
            </div>
          )}
        </div>

        {coupon.legs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            Aucune sélection ne respecte ce profil avec les marchés choisis.
            Essayez un profil plus audacieux ou autorisez d&apos;autres marchés.
          </p>
        ) : (
          <ol className="space-y-2">
            {coupon.legs.map((l, i) => (
              <li
                key={l.match}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface/70 p-3"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-bold">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-muted">
                    {l.match} · {l.competition}
                  </p>
                  <p className="truncate font-semibold">{l.pick.selection}</p>
                  <p className="text-xs text-muted">
                    {CATEGORY_LABELS[l.pick.category]} ·{" "}
                    {l.pick.probability.toFixed(0)} % · {l.pick.basis}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ${
                    l.pick.oddsSource === "bookmaker"
                      ? "bg-accent-soft text-accent"
                      : "bg-gold-soft text-gold"
                  }`}
                >
                  {l.pick.odds.toFixed(2)}
                </span>
              </li>
            ))}
          </ol>
        )}

        {coupon.legs.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-dashed border-border pt-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">
                Cote totale
              </p>
              <p className="font-display text-5xl leading-none text-accent tabular-nums">
                {coupon.totalOdds.toFixed(2)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-muted">
                Probabilité estimée
              </p>
              <p className="font-display text-5xl leading-none tabular-nums">
                {coupon.probability.toFixed(1)} %
              </p>
            </div>
            {coupon.estimatedOddsCount > 0 && (
              <p className="col-span-2 text-xs text-muted">
                {coupon.estimatedOddsCount} cote
                {coupon.estimatedOddsCount > 1 ? "s" : ""} estimée
                {coupon.estimatedOddsCount > 1 ? "s" : ""} (◆) : vérifiez-les
                chez votre bookmaker avant de jouer.
              </p>
            )}
          </div>
        )}
        {coupon.legs.length > 0 && (
          <div className="mt-4 space-y-3 border-t border-dashed border-border pt-4">
            {profile === "jackpot" && (
              <p className="rounded-lg bg-warn-bg p-2 text-xs text-warn-text">
                Coupon loterie : il perdra la grande majorité du temps. Ne misez
                que ce que vous acceptez de perdre (1 % de la bankroll au plus).
              </p>
            )}
            {coupon.legs.length > 3 && (
              <p className="rounded-lg bg-warn-bg p-2 text-xs text-warn-text">
                Au-delà de 3 sélections, la probabilité de gain chute vite :
                chaque match ajouté multiplie le risque.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-muted">
                Bankroll (€)
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={bankroll}
                  onChange={(e) => changeBankroll(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-text"
                />
              </label>
              <label className="text-xs text-muted">
                Mise (€)
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={stakeInput}
                  placeholder={suggestedStake.toFixed(2)}
                  onChange={(e) => setStakeInput(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-text"
                />
              </label>
            </div>
            <p className="text-xs text-muted">
              {suggestedStake > 0
                ? `Mise conseillée : ${suggestedStake.toFixed(2)} € (Kelly ¼, max 5 % de la bankroll).`
                : "Mise conseillée : 0 € — d'après nos probabilités, ce coupon n'a pas d'avantage sur sa cote. Mieux vaut passer."}
            </p>
            <button
              onClick={save}
              className="w-full rounded-xl bg-accent py-2.5 font-semibold text-on-accent hover:bg-accent-strong"
            >
              {saved
                ? "Enregistré dans le suivi ✓"
                : "J'ai joué ce coupon : l'enregistrer"}
            </button>
          </div>
        )}
        {(excluded.length > 0 || Object.keys(forced).length > 0) && (
          <p className="mt-3 text-xs text-muted">
            Conseils du coach appliqués : {excluded.length} match
            {excluded.length > 1 ? "s" : ""} enlevé
            {excluded.length > 1 ? "s" : ""}, {Object.keys(forced).length}{" "}
            remplacement{Object.keys(forced).length > 1 ? "s" : ""}.{" "}
            <button
              onClick={() => {
                setExcluded([]);
                setForced({});
              }}
              className="font-semibold text-accent"
            >
              Rétablir
            </button>
          </p>
        )}
        <CouponCoach
          coupon={coupon}
          results={pool}
          profileLabel={PROFILES[profile].label}
          onExclude={(m) =>
            setExcluded((prev) => [...new Set([...prev, ...m])])
          }
          onReplace={(match, selection) =>
            setForced((prev) => ({ ...prev, [match]: selection }))
          }
        />
        <p className="mt-4 text-xs text-muted">
          Aide à la décision, aucun gain garanti. Jouez de façon responsable.
        </p>
      </section>
    </div>
  );
}
