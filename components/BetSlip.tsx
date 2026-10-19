"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORY_LABELS } from "@/lib/coupon";
import { addBet } from "@/lib/history";
import { clearSlip, removeLeg, useSlip } from "@/lib/slip";
import { kellyStake } from "@/lib/value";

const QUICK_STAKES = [2, 5, 10, 20];

/** Panier flottant : pastille en bas d'écran qui s'ouvre en feuille avec mise, gain potentiel et enregistrement. */
export function BetSlip({ bottomClass }: { bottomClass: string }) {
  const legs = useSlip();
  const [open, setOpen] = useState(false);
  const [stake, setStake] = useState(5);
  const [saved, setSaved] = useState(false);
  const [pulse, setPulse] = useState(false);
  const prevCount = useRef(legs.length);

  // Petite animation à chaque pari ajouté.
  useEffect(() => {
    if (legs.length > prevCount.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 450);
      prevCount.current = legs.length;
      return () => clearTimeout(t);
    }
    prevCount.current = legs.length;
    if (legs.length === 0) setOpen(false);
  }, [legs.length]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  if (legs.length === 0) return null;

  const totalOdds = Math.round(legs.reduce((t, l) => t * l.pick.odds, 1) * 100) / 100;
  const probability = legs.reduce((t, l) => t * (l.pick.probability / 100), 1) * 100;
  const gain = stake * totalOdds;
  let bankroll = 100;
  try {
    bankroll = Number(localStorage.getItem("pronoradar.bankroll")) || 100;
  } catch {}
  const advised = kellyStake(bankroll, probability, totalOdds);

  function save() {
    addBet({ profile: "Panier", legs, totalOdds, probability: Math.round(probability * 10) / 10, stake });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setOpen(false);
      clearSlip();
    }, 1200);
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={`fixed right-4 z-40 flex items-center gap-3 rounded-2xl bg-accent px-4 py-3 font-bold text-black shadow-2xl shadow-accent/30 transition active:scale-95 ${
            bottomClass
          } ${pulse ? "slip-pulse" : ""}`}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-sm text-accent">{legs.length}</span>
          <span>Mon panier</span>
          <span className="rounded-lg bg-black/15 px-2 py-0.5 tabular-nums">@ {totalOdds.toFixed(2)}</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button aria-label="Fermer" className="fade-in absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="sheet relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-surface-3 sm:hidden" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {legs.length === 1 ? "Pari simple" : `Combiné · ${legs.length} sélections`}
              </h2>
              <button onClick={clearSlip} className="text-sm text-muted hover:text-danger">
                Tout effacer
              </button>
            </div>

            <ul className="space-y-2">
              {legs.map((l) => (
                <li key={l.match} className="fade-in flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{l.pick.selection}</p>
                    <p className="truncate text-xs text-muted">
                      {CATEGORY_LABELS[l.pick.category]} · {l.match}
                    </p>
                    <p className="text-xs text-muted">{l.pick.probability.toFixed(0)} % de chances estimées</p>
                  </div>
                  <span className={`rounded-lg px-2.5 py-1 font-bold tabular-nums ${l.pick.oddsSource === "bookmaker" ? "bg-accent-soft text-accent" : "bg-gold-soft text-gold"}`}>
                    {l.pick.odds.toFixed(2)}
                  </span>
                  <button onClick={() => removeLeg(l.match)} aria-label="Retirer" className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface-3 hover:text-danger">
                    ✕
                  </button>
                </li>
              ))}
            </ul>

            {legs.length > 3 && (
              <p className="mt-3 rounded-xl bg-warn-bg p-2.5 text-xs text-warn-text">
                {legs.length} sélections : il suffit d&apos;une seule erreur pour tout perdre. Probabilité estimée : {probability.toFixed(1)} %.
              </p>
            )}

            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Mise</p>
              <div className="flex gap-2">
                {QUICK_STAKES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStake(s)}
                    className={`flex-1 rounded-xl border py-2 font-semibold transition active:scale-95 ${stake === s ? "border-accent bg-accent-soft text-accent" : "border-border"}`}
                  >
                    {s} €
                  </button>
                ))}
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={stake}
                  onChange={(e) => setStake(Number(e.target.value) || 0)}
                  className="w-20 rounded-xl border border-border bg-surface-2 px-2 text-center font-semibold"
                  aria-label="Mise personnalisée"
                />
              </div>
              <p className="mt-2 text-xs text-muted">
                {advised > 0
                  ? `Mise conseillée pour une bankroll de ${bankroll} € : ${advised.toFixed(2)} €.`
                  : "D'après nos probabilités, ce pari n'a pas d'avantage sur sa cote : misez petit."}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-surface-2 p-3 text-center">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted">Cote</p>
                <p className="text-xl font-bold tabular-nums text-gold">{totalOdds.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted">Chances</p>
                <p className="text-xl font-bold tabular-nums">{probability.toFixed(probability < 10 ? 1 : 0)} %</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted">Gain potentiel</p>
                <p className="text-xl font-bold tabular-nums text-accent">{gain.toFixed(2)} €</p>
              </div>
            </div>

            <button onClick={save} className="mt-4 w-full rounded-2xl bg-accent py-3.5 text-lg font-bold text-black shadow-lg shadow-accent/25 transition active:scale-[0.98]">
              {saved ? "Enregistré dans le suivi ✓" : `J'ai joué ce pari · ${stake} €`}
            </button>
            <p className="mt-2 text-center text-[11px] text-muted">PronoRadar ne prend aucun pari : jouez chez votre bookmaker, puis enregistrez ici pour suivre vos résultats.</p>
          </div>
        </div>
      )}
    </>
  );
}
