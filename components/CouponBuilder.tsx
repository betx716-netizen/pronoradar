"use client";

import { useMemo, useState } from "react";
import { CATEGORY_LABELS, PROFILES, buildCoupon, type RiskProfile } from "@/lib/coupon";
import type { AnalysisResult, MarketCategory } from "@/lib/schemas";

const FOOTBALL_CATEGORIES: MarketCategory[] = [
  "resultat", "double_chance", "rembourse", "mi_temps", "mi_temps_fin", "handicap", "buts", "buts_equipe", "les_deux_marquent",
  "resultat_buts", "resultat_btts", "score_exact", "corners", "tirs_cadres", "fautes", "cartons", "hors_jeu",
];
const TENNIS_CATEGORIES: MarketCategory[] = ["resultat", "sets", "jeux", "premier_set", "handicap_jeux", "score_sets", "tie_break"];
const DEFAULT_CATEGORIES: MarketCategory[] = ["resultat", "double_chance", "rembourse", "buts", "buts_equipe", "les_deux_marquent", "sets", "jeux", "premier_set"];

export function CouponBuilder({ results }: { results: AnalysisResult[] }) {
  const [profile, setProfile] = useState<RiskProfile>("equilibre");
  const [size, setSize] = useState(4);
  const [categories, setCategories] = useState<MarketCategory[]>(DEFAULT_CATEGORIES);
  const [copied, setCopied] = useState(false);

  const available = results.some((r) => r.analysis.match.sport === "tennis")
    ? [...new Set([...FOOTBALL_CATEGORIES, ...TENNIS_CATEGORIES])]
    : FOOTBALL_CATEGORIES;
  const coupon = useMemo(() => buildCoupon(results, { profile, size, categories }), [results, profile, size, categories]);

  const toggle = (c: MarketCategory) =>
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  async function copy() {
    const text = [
      `Coupon PronoRadar — ${PROFILES[profile].label}`,
      ...coupon.legs.map((l) => `• ${l.match} : ${l.pick.selection} @ ${l.pick.odds.toFixed(2)} (${l.pick.probability.toFixed(0)} %)`),
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
        Analysez d&apos;abord quelques matchs : le coupon se construit à partir de leurs analyses.
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="space-y-5 rounded-2xl border border-border bg-surface p-5">
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Profil de risque</h3>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(PROFILES) as RiskProfile[]).map((p) => (
              <button
                key={p}
                onClick={() => setProfile(p)}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                  profile === p ? "border-accent bg-accent-soft" : "border-border hover:border-muted"
                }`}
              >
                <span className="block font-semibold">{PROFILES[p].label}</span>
                <span className="text-xs text-muted">≥ {PROFILES[p].minProbability} % par sélection</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">{PROFILES[profile].description}</p>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Nombre de sélections</h3>
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
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Marchés autorisés</h3>
          <div className="flex flex-wrap gap-2">
            {available.map((c) => {
              const on = categories.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => toggle(c)}
                  aria-pressed={on}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    on ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-text"
                  }`}
                >
                  {on ? "✓ " : ""}
                  {CATEGORY_LABELS[c]}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">Hors résultat, double chance, remboursé si nul et ligne de buts, les marchés reposent sur des estimations de l&apos;IA : vérifiez la cote chez votre bookmaker.</p>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-b from-surface-2 to-surface p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Coupon proposé</p>
            <p className="text-sm text-muted">
              {PROFILES[profile].label} · {coupon.legs.length} sélection{coupon.legs.length > 1 ? "s" : ""}
            </p>
          </div>
          {coupon.legs.length > 0 && (
            <button onClick={copy} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-gold">
              {copied ? "Copié ✓" : "Copier"}
            </button>
          )}
        </div>

        {coupon.legs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            Aucune sélection ne respecte ce profil avec les marchés choisis. Essayez un profil plus audacieux ou autorisez d&apos;autres marchés.
          </p>
        ) : (
          <ol className="space-y-2">
            {coupon.legs.map((l, i) => (
              <li key={l.match} className="flex items-center gap-3 rounded-xl border border-border bg-surface/70 p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-bold">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-muted">
                    {l.match} · {l.competition}
                  </p>
                  <p className="truncate font-semibold">{l.pick.selection}</p>
                  <p className="text-xs text-muted">
                    {CATEGORY_LABELS[l.pick.category]} · {l.pick.probability.toFixed(0)} % · {l.pick.basis}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ${
                    l.pick.oddsSource === "bookmaker" ? "bg-accent-soft text-accent" : "bg-gold-soft text-gold"
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
              <p className="text-xs uppercase tracking-wide text-muted">Cote totale</p>
              <p className="text-3xl font-bold text-gold tabular-nums">{coupon.totalOdds.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-muted">Probabilité estimée</p>
              <p className="text-3xl font-bold tabular-nums">{coupon.probability.toFixed(1)} %</p>
            </div>
            {coupon.estimatedOddsCount > 0 && (
              <p className="col-span-2 text-xs text-muted">
                {coupon.estimatedOddsCount} cote{coupon.estimatedOddsCount > 1 ? "s" : ""} estimée{coupon.estimatedOddsCount > 1 ? "s" : ""} (◆) : vérifiez-les chez
                votre bookmaker avant de jouer.
              </p>
            )}
          </div>
        )}
        <p className="mt-4 text-xs text-muted">Aide à la décision, aucun gain garanti. Jouez de façon responsable.</p>
      </section>
    </div>
  );
}
