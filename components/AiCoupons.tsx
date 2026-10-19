"use client";

import { useEffect, useRef, useState } from "react";
import { callStreaming } from "@/lib/client";
import type {
  AiCoupons as AiCouponsResult,
  AiCouponsRequest,
  AiProfile,
} from "@/lib/aiCoupons";
import { CATEGORY_LABELS, type CouponLeg } from "@/lib/coupon";
import { addBet } from "@/lib/history";
import type { AnalysisResult, MarketPick } from "@/lib/schemas";

const LABELS: Record<AiProfile, { label: string; tone: string }> = {
  value: { label: "Coupon Value", tone: "border-success/50" },
  sur: { label: "Coupon Sûr", tone: "border-home/40" },
  equilibre: { label: "Coupon Équilibré", tone: "border-gold/50" },
  audacieux: { label: "Coupon Audacieux", tone: "border-away/50" },
  jackpot: { label: "Coupon Grosse cote", tone: "border-accent/60" },
};

type Built = {
  profile: AiProfile;
  legs: (CouponLeg & { reason: string })[];
  comment: string;
  stakePercent: number;
};
type Saved = { createdAt: string; size: number | null; coupons: Built[] };

const STORE = "pronoradar.aiCoupons.v1";
const SIZE_KEY = "pronoradar.aiCouponsSize";
const matchName = (r: AnalysisResult) =>
  `${r.analysis.match.home} – ${r.analysis.match.away}`;

// Paris envoyés à l'IA pour chaque match : les plus probables et ceux à grosse cote, avec un identifiant court.
function candidates(r: AnalysisResult): MarketPick[] {
  const picks = r.picks ?? [];
  const byProb = [...picks]
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 9);
  const byOdds = [...picks]
    .filter((p) => p.odds >= 2.5 && p.probability >= 12)
    .sort((a, b) => b.odds - a.odds)
    .slice(0, 5);
  return [...new Set([...byProb, ...byOdds])];
}

function load(): Saved | null {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "null");
  } catch {
    return null;
  }
}

/** Les cinq coupons composés par l'IA, régénérés automatiquement après chaque série d'analyses. */
export function AiCoupons({
  results,
  autoKey,
}: {
  results: AnalysisResult[];
  autoKey: number;
}) {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [size, setSize] = useState<number | null>(3);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const lastAuto = useRef(autoKey);

  useEffect(() => {
    setSaved(load());
    try {
      const s = localStorage.getItem(SIZE_KEY);
      if (s !== null) setSize(s === "auto" ? null : Number(s));
    } catch {}
  }, []);

  async function generate(n: number | null = size) {
    if (results.length === 0) return;
    setLoading("L'IA compose vos coupons…");
    setError(null);
    const index = new Map<string, CouponLeg>();
    const body: AiCouponsRequest = {
      size: n,
      matches: results.slice(0, 40).map((r, i) => {
        const ai = r.analysis.ai_analysis;
        return {
          match: matchName(r),
          competition: r.analysis.match.competition,
          date: r.analysis.match.date,
          confidence: ai.confidence ?? null,
          summary: (ai.summary ?? "").slice(0, 600),
          risks: (ai.risks ?? []).slice(0, 5).map((x) => x.slice(0, 200)),
          picks: candidates(r).map((p, j) => {
            const id = `m${i}p${j}`;
            index.set(id, {
              match: matchName(r),
              competition: r.analysis.match.competition,
              date: r.analysis.match.date,
              pick: p,
            });
            return [
              id,
              p.selection,
              CATEGORY_LABELS[p.category],
              p.odds.toFixed(2),
              `${p.probability.toFixed(0)} %`,
              p.oddsSource,
              p.reliability ?? "?",
            ]
              .join(" | ")
              .slice(0, 220);
          }),
        };
      }),
    };
    try {
      const res = await callStreaming<AiCouponsResult>(
        "/api/ai-coupons",
        body,
        setLoading,
      );
      const coupons: Built[] = (
        ["value", "sur", "equilibre", "audacieux", "jackpot"] as AiProfile[]
      ).map((profile) => {
        const c = res.coupons.find((x) => x.profile === profile);
        const seen = new Set<string>();
        const legs = (c?.legs ?? []).flatMap((l) => {
          const leg = index.get(l.pick_id.trim());
          // Une seule sélection par match, et seulement des paris existants.
          if (!leg || seen.has(leg.match)) return [];
          seen.add(leg.match);
          return [{ ...leg, reason: l.reason }];
        });
        return {
          profile,
          legs,
          comment: c?.comment ?? "Pas de coupon proposé pour ce profil.",
          stakePercent: c?.stake_percent ?? 0,
        };
      });
      const next = { createdAt: new Date().toISOString(), size: n, coupons };
      setSaved(next);
      try {
        localStorage.setItem(STORE, JSON.stringify(next));
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(null);
  }

  // Après chaque série d'analyses terminée, l'IA refait les coupons toute seule. Si la série s'est terminée
  // pendant qu'on était sur un autre onglet, on le fait à l'ouverture, quand une analyse est plus récente que les coupons.
  useEffect(() => {
    if (autoKey === 0) return;
    const current = load();
    const newest = results.reduce(
      (m, r) => (r.createdAt > m ? r.createdAt : m),
      "",
    );
    if (!current || current.createdAt < newest) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoKey !== lastAuto.current) {
      lastAuto.current = autoKey;
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKey]);

  function changeSize(v: string) {
    const n = v === "auto" ? null : Number(v);
    setSize(n);
    try {
      localStorage.setItem(SIZE_KEY, v);
    } catch {}
  }

  function bankroll() {
    try {
      return Number(localStorage.getItem("pronoradar.bankroll")) || 100;
    } catch {
      return 100;
    }
  }

  async function copy(c: Built, odds: number) {
    const text = [
      `${LABELS[c.profile].label} — PronoRadar`,
      ...c.legs.map(
        (l) => `• ${l.match} : ${l.pick.selection} @ ${l.pick.odds.toFixed(2)}`,
      ),
      `Cote totale : ${odds.toFixed(2)}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setFlash(`copy-${c.profile}`);
      setTimeout(() => setFlash(null), 1500);
    } catch {}
  }

  function play(c: Built, odds: number, prob: number) {
    const stake =
      Math.round(bankroll() * (c.stakePercent / 100) * 100) / 100 || 1;
    addBet({
      profile: `IA · ${LABELS[c.profile].label.replace("Coupon ", "")}`,
      legs: c.legs,
      totalOdds: odds,
      probability: Math.round(prob * 10) / 10,
      stake,
    });
    setFlash(`play-${c.profile}`);
    setTimeout(() => setFlash(null), 1500);
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl leading-none">
            Coupons de l&apos;IA
          </h2>
          <p className="text-sm text-muted">
            Composés par l&apos;IA à partir de vos {results.length} analyses,
            refaits automatiquement après chaque série d&apos;analyses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted">
            Sélections{" "}
            <select
              value={size === null ? "auto" : String(size)}
              onChange={(e) => changeSize(e.target.value)}
              className="ml-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-text"
            >
              <option value="auto">Au choix de l&apos;IA</option>
              {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => generate()}
            disabled={Boolean(loading) || results.length === 0}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-on-accent active:scale-95 disabled:opacity-50"
          >
            {saved ? "Refaire" : "Générer"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="mb-3 rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
          <div className="skeleton mb-2 h-1.5 rounded-full" />
          {loading}
        </div>
      )}
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {!saved && !loading && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
          {results.length
            ? "Touchez « Générer » pour que l'IA compose vos 5 coupons."
            : "Analysez d'abord des matchs : l'IA composera ensuite vos coupons."}
        </div>
      )}

      {saved && (
        <>
          <p className="mb-2 text-xs text-muted">
            Générés le{" "}
            {new Date(saved.createdAt).toLocaleString("fr-FR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {saved.coupons.map((c) => {
              const odds =
                Math.round(c.legs.reduce((t, l) => t * l.pick.odds, 1) * 100) /
                100;
              const prob =
                c.legs.reduce((t, l) => t * (l.pick.probability / 100), 1) *
                100;
              return (
                <article
                  key={c.profile}
                  className={`fade-in flex flex-col rounded-2xl border-2 bg-surface p-4 ${LABELS[c.profile].tone}`}
                >
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <h3 className="font-display text-2xl leading-none">
                      {LABELS[c.profile].label}
                    </h3>
                    {c.legs.length > 0 && (
                      <span className="font-display text-3xl leading-none text-accent tabular-nums">
                        {odds.toFixed(2)}
                      </span>
                    )}
                  </div>
                  {c.legs.length === 0 ? (
                    <p className="flex-1 text-sm text-muted">{c.comment}</p>
                  ) : (
                    <>
                      <ol className="mb-3 space-y-2">
                        {c.legs.map((l) => (
                          <li
                            key={l.match}
                            className="rounded-xl bg-surface-2 p-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-xs text-muted">
                                  {l.match}
                                </p>
                                <p className="font-semibold">
                                  {l.pick.selection}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 rounded-lg px-2 py-0.5 text-sm font-bold tabular-nums ${l.pick.oddsSource === "bookmaker" ? "bg-accent-soft text-accent" : "bg-gold-soft text-gold"}`}
                              >
                                {l.pick.oddsSource === "estimée" ? "◆ " : ""}
                                {l.pick.odds.toFixed(2)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-muted">
                              {l.reason}
                            </p>
                          </li>
                        ))}
                      </ol>
                      <p className="mb-1 text-sm">{c.comment}</p>
                      <p className="mb-3 text-xs text-muted">
                        {c.legs.length} sélection{c.legs.length > 1 ? "s" : ""}{" "}
                        · probabilité {prob.toFixed(prob < 10 ? 1 : 0)} % · mise
                        conseillée {c.stakePercent} % de la bankroll
                      </p>
                      <div className="mt-auto flex gap-2">
                        <button
                          onClick={() => copy(c, odds)}
                          className="flex-1 rounded-xl border border-border py-2 text-sm font-semibold"
                        >
                          {flash === `copy-${c.profile}` ? "Copié ✓" : "Copier"}
                        </button>
                        <button
                          onClick={() => play(c, odds, prob)}
                          className="flex-1 rounded-xl bg-accent py-2 text-sm font-bold text-on-accent active:scale-95"
                        >
                          {flash === `play-${c.profile}`
                            ? "Enregistré ✓"
                            : "J'ai joué"}
                        </button>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
