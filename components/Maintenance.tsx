"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/client";
import { LoginForm } from "./app/LoginForm";

export type MaintenanceState = { on: boolean; message: string; admin: boolean };

/** Lit l'état des travaux (et si le visiteur connecté est administrateur). */
export const fetchMaintenance = () =>
  authFetch("/api/maintenance")
    .then((r) => r.json())
    .catch(() => ({ on: false, message: "", admin: false })) as Promise<MaintenanceState>;

/** Écran affiché à tous pendant les travaux ; l'administrateur peut se connecter discrètement en bas. */
export function MaintenanceScreen({ message }: { message: string }) {
  const [login, setLogin] = useState(false);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-6 py-10 text-center text-white">
      <div className="pointer-events-none fixed left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-[#16a34a]/25 blur-3xl" />
      <img src="/icon.png" alt="PronoRadar" className="relative h-24 w-24 rounded-3xl shadow-2xl" />
      <p className="relative mt-5 font-display text-4xl leading-none tracking-wide">
        PRONO<span className="text-[#4ade80]">RADAR</span>
      </p>
      <div className="relative mt-8 inline-flex items-center gap-2 rounded-full border border-[#4ade80]/40 bg-[#16a34a]/10 px-4 py-1.5 text-sm font-semibold text-[#86efac]">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#4ade80]" />
        Site en travaux
      </div>
      <h1 className="relative mt-5 max-w-md text-5xl leading-[0.95]">On prépare la suite.</h1>
      <p className="relative mt-4 max-w-md text-base leading-relaxed text-white/70">{message}</p>
      <p className="relative mt-8 text-xs text-white/40">Merci de ta patience · 18+ · Jouez de façon responsable</p>
      <div className="relative mt-10 w-full max-w-sm">
        {login ? (
          <div className="rounded-3xl bg-surface p-5 text-left text-text">
            <LoginForm defaultMode="login" intro="Accès réservé à l'administrateur pendant les travaux." onDone={() => window.location.reload()} />
          </div>
        ) : (
          <button onClick={() => setLogin(true)} className="text-xs text-white/30 underline hover:text-white/60">
            Accès administrateur
          </button>
        )}
      </div>
    </div>
  );
}

/** Administrateur : interrupteur des travaux et message affiché aux visiteurs. */
export function AdminMaintenance() {
  const [state, setState] = useState<MaintenanceState | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMaintenance().then((m) => {
      setState(m);
      setMessage(m.message);
    });
  }, []);
  if (!state) return <section className="skeleton h-32 rounded-3xl" />;

  async function save(on: boolean) {
    if (on && !confirm("Fermer le site ? Tous les visiteurs verront la page « en travaux » (toi, tu gardes l'accès).")) return;
    setBusy(true);
    setError(null);
    try {
      const r = await authFetch("/api/maintenance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on, message }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Erreur");
      setState({ ...d, admin: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  return (
    <section className={`space-y-3 rounded-3xl p-5 ${state.on ? "bg-warn-bg" : "bg-surface"}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-xl font-bold">Site en travaux</h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${state.on ? "bg-danger text-white" : "bg-success-soft text-success"}`}>
          {state.on ? "Fermé au public" : "Ouvert"}
        </span>
      </div>
      <p className="text-[0.875rem] text-muted">
        {state.on ? "Les visiteurs voient la page « en travaux ». Toi, tu utilises l'app normalement." : "Ferme le site pendant une mise à jour : les visiteurs verront une page d'attente."}
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        maxLength={400}
        className="w-full rounded-2xl border-2 border-border bg-surface-2 px-4 py-2.5 text-[0.95rem] outline-none focus:border-accent"
        aria-label="Message affiché aux visiteurs"
      />
      {error && <p className="text-[0.875rem] text-danger">{error}</p>}
      <div className="flex gap-2">
        {state.on ? (
          <>
            <button onClick={() => save(true)} disabled={busy} className="flex-1 rounded-full border-2 border-border py-2.5 font-semibold disabled:opacity-60">
              Mettre à jour le message
            </button>
            <button onClick={() => save(false)} disabled={busy} className="flex-1 rounded-full bg-success py-2.5 font-semibold text-white disabled:opacity-60">
              Rouvrir le site
            </button>
          </>
        ) : (
          <button onClick={() => save(true)} disabled={busy} className="w-full rounded-full bg-danger py-2.5 font-semibold text-white disabled:opacity-60">
            {busy ? "…" : "Fermer le site (travaux)"}
          </button>
        )}
      </div>
    </section>
  );
}
