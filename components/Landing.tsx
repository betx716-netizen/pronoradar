"use client";

import type { ReactNode } from "react";
import { LoginForm } from "./app/LoginForm";
import { INFO_PAGES } from "@/lib/legal";

const FEATURES: { title: string; text: string; icon: ReactNode }[] = [
  {
    title: "Analyse IA de chaque match",
    text: "Les avis des pronostiqueurs et des médias recensés sur le web, comparés aux cotes et aux statistiques, puis une analyse claire.",
    icon: <path d="M3 3v18h18M7 15l4-4 3 3 5-6" />,
  },
  {
    title: "Coupons fiables par l'IA",
    text: "Cinq coupons composés automatiquement, du plus sûr au plus coté, avec une explication pour chaque sélection.",
    icon: <path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4Zm9 0v12" />,
  },
  {
    title: "Value bets repérés",
    text: "Le site signale les paris où la probabilité calculée dépasse celle de la cote du bookmaker.",
    icon: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
  },
  {
    title: "Compositions officielles",
    text: "Le onze de départ sur un terrain, aux couleurs du club, mis à jour dès sa publication.",
    icon: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 0v4m0 12v4M2 12h4m12 0h4M12 8l3.5 2.5-1.3 4h-4.4l-1.3-4Z" />,
  },
  {
    title: "Coach de coupon",
    text: "L'IA relit votre coupon, repère le maillon faible et propose de remplacer ou d'enlever une sélection.",
    icon: <path d="M12 3a6 6 0 0 0-6 6c0 2.2 1.2 3.6 2 4.5.6.7 1 1.5 1 2.5h6c0-1 .4-1.8 1-2.5.8-.9 2-2.3 2-4.5a6 6 0 0 0-6-6ZM9 20h6" />,
  },
  {
    title: "Suivi des résultats",
    text: "Bénéfice, rentabilité et réussite par marché : vous savez ce qui marche vraiment.",
    icon: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  },
];

// Carte de match flottante en perspective : aperçu de ce que fait l'application.
function MockCard({ className, home, away, score, pct, tone }: { className: string; home: string; away: string; score: string; pct: number; tone: string }) {
  return (
    <div className={`landing-float absolute w-56 rounded-2xl border border-white/10 bg-white/95 p-3 text-[#121216] shadow-2xl ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#5d6270]">Analyse IA · confiance élevée</p>
      <div className="mt-1 flex items-center justify-between">
        <p className="font-display text-xl leading-none">{home}</p>
        <p className="font-display text-2xl leading-none text-[#16a34a]">{score}</p>
        <p className="font-display text-xl leading-none">{away}</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e9e9ee]">
        <div className="h-full" style={{ width: `${pct}%`, background: tone }} />
      </div>
      <p className="mt-1 text-[11px] text-[#5d6270]">
        Probabilité <strong className="text-[#121216]">{pct} %</strong>
      </p>
    </div>
  );
}

/** Page d'accueil publique : présentation et création de compte, obligatoire pour ouvrir l'application. */
export function Landing({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="min-h-screen overflow-x-clip bg-[#050505] text-white">
      {/* Bandeau */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2.5">
          <img src="/logo-mark.png" alt="PronoRadar" className="h-10 w-10 rounded-lg bg-black object-cover shadow" />
          <p className="font-display text-[1.7rem] leading-none tracking-wide">
            PRONO<span className="text-white/60">RADAR</span>
          </p>
        </div>
        <a href="#connexion" className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold hover:border-white">
          Se connecter
        </a>
      </header>

      {/* Héros */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-6 lg:grid-cols-2 lg:pt-12">
        <div className="pointer-events-none absolute -left-40 -top-20 h-96 w-96 rounded-full bg-[#16a34a]/25 blur-3xl" />
        <div className="relative">
          <p className="mb-3 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
            Pronostics · Analyse IA
          </p>
          <h1 className="text-[3.2rem] leading-[0.9] sm:text-7xl">
            Pariez avec
            <br />
            <span className="text-[#4ade80]">une longueur d&apos;avance.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-white/70">
            L&apos;IA lit les pronostics du web, les compare aux cotes et aux statistiques, et vous propose des coupons fiables. Football et tennis.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#connexion" className="rounded-xl bg-[#16a34a] px-6 py-3 font-bold shadow-lg shadow-[#16a34a]/30 transition hover:bg-[#15803d]">
              Créer un compte gratuit
            </a>
            <a href="#connexion" className="rounded-xl border border-white/20 px-6 py-3 font-semibold hover:border-white">
              Voir les coupons du jour
            </a>
          </div>
        </div>

        {/* Scène 3D */}
        <div className="landing-scene relative h-80 sm:h-96">
          <div className="landing-stage absolute inset-0">
            <div className="absolute inset-x-6 inset-y-8 rounded-[2rem] bg-gradient-to-br from-[#1f8a3a] to-[#0f5323] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9)]">
              <svg viewBox="0 0 100 150" preserveAspectRatio="none" className="h-full w-full" aria-hidden>
                <g fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.7">
                  <rect x="5" y="5" width="90" height="140" rx="2" />
                  <line x1="5" y1="75" x2="95" y2="75" />
                  <circle cx="50" cy="75" r="12" />
                  <rect x="25" y="5" width="50" height="22" />
                  <rect x="25" y="123" width="50" height="22" />
                </g>
              </svg>
            </div>
          </div>
          <MockCard className="left-0 top-4 [animation-delay:-2s]" home="PSG" away="OM" score="2-1" pct={64} tone="#15803d" />
          <MockCard className="bottom-6 right-0 [animation-delay:-4s]" home="Real" away="Barça" score="1-1" pct={38} tone="#b45309" />
          <div className="landing-float absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-[#16a34a] px-5 py-3 text-center shadow-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80">Coupon fiable</p>
            <p className="font-display text-4xl leading-none">cote 4,85</p>
          </div>
        </div>
      </section>

      {/* Fonctions */}
      <section id="fonctions" className="bg-[#f6f6f8] py-16 text-[#121216]">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-5xl leading-none">Tout pour décider</h2>
          <p className="mt-2 max-w-xl text-[#5d6270]">Une seule application pour analyser, composer et suivre vos paris.</p>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.title} className="landing-tilt rounded-2xl border border-[#e3e3e9] bg-white p-5 shadow-sm">
                <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#16a34a]/10 text-[#16a34a]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
                    {f.icon}
                  </svg>
                </span>
                <h3 className="text-lg font-bold">{f.title}</h3>
                <p className="mt-1 text-sm text-[#5d6270]">{f.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Connexion */}
      <section id="connexion" className="relative py-16">
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-[#16a34a]/20 blur-3xl" />
        <div className="relative mx-auto max-w-sm rounded-3xl bg-surface p-6 text-text shadow-2xl">
          <h2 className="mb-3 font-display text-4xl leading-none">Rejoindre PronoRadar</h2>
          <LoginForm intro="Crée ton compte gratuit pour voir les coupons du jour. Avec ton numéro ou ton email." onDone={onEnter} />
        </div>

      </section>

      <footer className="border-t border-white/10 py-6 text-center text-xs text-white/50">
        <nav className="mb-3 flex flex-wrap justify-center gap-x-4 gap-y-2">
          {INFO_PAGES.map((p) => (
            <a key={p.href} href={p.href} className="hover:text-white">
              {p.label}
            </a>
          ))}
        </nav>
        PronoRadar · Aide à la décision, aucun gain garanti. Les paris comportent des risques : jouez de façon responsable. Réservé aux majeurs.
      </footer>
    </div>
  );
}
