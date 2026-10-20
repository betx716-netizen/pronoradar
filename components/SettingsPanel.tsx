"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { setPassword } from "@/lib/client";
import type { ServicesStatus } from "@/lib/schemas";
import { PalettePicker } from "./PalettePicker";

type Quotas = { odds: number | null; apiFootball: number | null };

/** Bouton engrenage de l'en-tête : état des services, quotas restants et mot de passe, à l'écart de l'accueil. */
export function SettingsPanel({
  services,
  quotas,
}: {
  services: ServicesStatus | null;
  quotas: Quotas;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  const rows: [string, boolean | undefined, string][] = [
    [
      "Analyse IA",
      services?.gemini,
      "Recherche des avis sur le web, analyse et coach de coupon",
    ],
    [
      "Cotes en direct",
      services?.odds,
      "Matchs à venir et cotes des bookmakers",
    ],
    [
      "Statistiques",
      services?.apiFootball,
      services?.statsLimited
        ? "Offre gratuite limitée aux anciennes saisons : remplacé par la recherche web de l'IA"
        : "Modèle statistique, forme, blessés",
    ],
    ["IA de secours", services?.backupAI, "Prend le relais quand le quota de l'IA principale est épuisé"],
    ["Recherche web de secours", services?.backupSearch, "Prend le relais pour chercher les avis sur le web"],
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Paramètres"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 active:scale-95"
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
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
        </svg>
      </button>

      {/* Rendu hors de l'en-tête, sinon la barre de navigation passerait par-dessus. */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center text-text sm:items-center">
            <button
              aria-label="Fermer"
              className="fade-in absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <div className="sheet relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-display text-3xl leading-none">Paramètres</p>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Fermer"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-3"
                >
                  ✕
                </button>
              </div>

              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Couleurs du site
              </h3>
              <PalettePicker />

              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Services
              </h3>
              <ul className="mb-5 space-y-2">
                {rows.map(([label, on, detail]) => (
                  <li
                    key={label}
                    className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3"
                  >
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${on ? "bg-success" : "bg-draw"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{label}</p>
                      <p className="text-xs text-muted">{detail}</p>
                    </div>
                    <span
                      className={`text-xs font-semibold ${on ? "text-success" : "text-muted"}`}
                    >
                      {services === null ? "…" : on ? "Actif" : "Inactif"}
                    </span>
                  </li>
                ))}
              </ul>
              {services?.demo && (
                <p className="-mt-3 mb-5 text-xs text-warn-text">
                  Mode démonstration : les données affichées sont fictives.
                </p>
              )}

              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Requêtes restantes
              </h3>
              <div className="mb-5 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-surface-2 p-3">
                  <p className="font-display text-3xl leading-none tabular-nums">
                    {quotas.odds ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted">Cotes, ce mois-ci</p>
                </div>
                <div className="rounded-2xl bg-surface-2 p-3">
                  <p className="font-display text-3xl leading-none tabular-nums">
                    {quotas.apiFootball ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Statistiques, aujourd&apos;hui
                  </p>
                </div>
              </div>
              <p className="-mt-3 mb-5 text-xs text-muted">
                Mis à jour après chaque chargement de matchs ou analyse (— : pas
                encore connu).
              </p>

              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Compte</h3>
              <button
                onClick={async () => {
                  await fetch("/api/auth", { method: "DELETE" }).catch(() => {});
                  setPassword("");
                  window.location.reload();
                }}
                className="w-full rounded-xl border border-border py-2.5 font-semibold text-danger hover:border-danger"
              >
                Se déconnecter
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
