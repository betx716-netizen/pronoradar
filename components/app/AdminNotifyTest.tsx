"use client";

import { useState } from "react";
import { api } from "@/lib/client";

/** Administrateur : vérifie que les alertes ntfy (inscriptions, paiements) arrivent bien sur le téléphone. */
export function AdminNotifyTest() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function test() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ sent: boolean; reason?: string; topicHint?: string }>("/api/admin/notify-test", { method: "POST" });
      setMsg(
        r.sent
          ? { ok: true, text: `Notification envoyée sur le canal ${r.topicHint}. Si rien n'arrive, vérifie que l'app ntfy est abonnée exactement à ce nom.` }
          : { ok: false, text: `${r.reason ?? "Échec de l'envoi."}${r.topicHint ? ` Canal : ${r.topicHint}.` : ""}` },
      );
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
    setBusy(false);
  }

  return (
    <section className="space-y-3 rounded-3xl bg-surface p-5">
      <h3 className="font-display text-xl font-bold">Notifications</h3>
      <p className="text-[14px] text-muted">Inscriptions, paiements à valider et mots de passe oubliés arrivent dans l&apos;app ntfy.</p>
      {msg && <p className={`rounded-2xl p-3 text-[14px] ${msg.ok ? "bg-success-soft text-success" : "bg-surface-2 text-danger"}`}>{msg.text}</p>}
      <button onClick={test} disabled={busy} className="w-full rounded-full bg-accent py-2.5 font-semibold text-white disabled:opacity-60">
        {busy ? "Envoi…" : "Envoyer une notification de test"}
      </button>
    </section>
  );
}
