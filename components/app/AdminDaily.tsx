"use client";

import { useState } from "react";
import { api } from "@/lib/client";

/** Administrateur : relancer exceptionnellement l'analyse du jour (programme, analyses et coupons refaits). */
export function AdminDaily() {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function relaunch() {
    if (!confirm("Effacer les analyses et les coupons d'aujourd'hui, et tout refaire ? Cela prend 15 à 40 minutes.")) return;
    setBusy(true);
    setNote(null);
    try {
      await api("/api/admin/daily", { method: "POST" });
      setNote({ ok: true, text: "Relancé. Le programme, les analyses puis les coupons du jour se refont : compte 15 à 40 minutes." });
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
    setBusy(false);
  }

  return (
    <section className="space-y-3 rounded-3xl bg-surface p-5">
      <h3 className="font-display text-xl font-bold">Analyse du jour</h3>
      <p className="text-[0.875rem] text-muted">À utiliser exceptionnellement, par exemple quand une compétition a été ajoutée dans la journée.</p>
      {note && <p className={`text-[0.875rem] ${note.ok ? "text-success" : "text-danger"}`}>{note.text}</p>}
      <button onClick={relaunch} disabled={busy} className="w-full rounded-full bg-accent py-2.5 font-semibold text-white disabled:opacity-60">
        {busy ? "…" : "Relancer l'analyse du jour"}
      </button>
    </section>
  );
}
