"use client";

import { useEffect, useState } from "react";

// Palettes proposées : couleur d'en-tête et couleur d'accent (boutons, onglet actif…).
export const PALETTES = [
  { id: "", name: "Vert & noir (logo)", header: ["#050505", "#0f3a1e"], accent: "#16a34a" },
  { id: "corail", name: "Ardoise & corail", header: ["#1e293b", "#334155"], accent: "#e2563f" },
  { id: "ardoise", name: "Ardoise & rouge doux", header: ["#1f2430", "#2d3340"], accent: "#d9464f" },
  { id: "nuit", name: "Bleu nuit", header: ["#0f1f3d", "#173468"], accent: "#2563eb" },
  { id: "emeraude", name: "Émeraude", header: ["#0b3b2e", "#0f5c43"], accent: "#059669" },
  { id: "rouge", name: "Rouge vif", header: ["#b8000c", "#e10a17"], accent: "#e10a17" },
  { id: "violet", name: "Violet premium", header: ["#1e1b4b", "#312e81"], accent: "#7c3aed" },
] as const;

// v2 : le vert et noir du logo devient la palette de tous, l'ancien choix enregistré est ignoré.
const KEY = "pronoradar.palette.v2";

/** Choix de la palette du site, appliquée tout de suite et gardée sur cet appareil. */
export function PalettePicker() {
  const [current, setCurrent] = useState("");
  useEffect(() => setCurrent(document.documentElement.dataset.palette ?? ""), []);

  function choose(id: string) {
    setCurrent(id);
    if (id) document.documentElement.dataset.palette = id;
    else delete document.documentElement.dataset.palette;
    try {
      if (id) localStorage.setItem(KEY, id);
      else localStorage.removeItem(KEY);
    } catch {}
  }

  return (
    <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {PALETTES.map((p) => (
        <button
          key={p.id || "rouge"}
          onClick={() => choose(p.id)}
          aria-pressed={current === p.id}
          className={`overflow-hidden rounded-2xl border-2 text-left transition active:scale-95 ${current === p.id ? "border-accent" : "border-border"}`}
        >
          <div className="flex h-10 items-center gap-1.5 px-2.5" style={{ background: `linear-gradient(90deg, ${p.header[0]}, ${p.header[1]})` }}>
            <span className="flex h-6 w-6 -skew-x-6 items-center justify-center rounded bg-white font-display text-sm" style={{ color: p.accent }}>
              P
            </span>
            <span className="ml-auto h-4 w-10 rounded-full" style={{ background: p.accent }} />
          </div>
          <p className="flex items-center justify-between gap-1 px-2.5 py-2 text-xs font-semibold">
            {p.name}
            {current === p.id && <span className="text-accent">✓</span>}
          </p>
        </button>
      ))}
    </div>
  );
}
