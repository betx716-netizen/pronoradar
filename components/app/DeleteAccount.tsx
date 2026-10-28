"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { signOut } from "@/lib/session";

/** Supprimer son propre compte, après avoir tapé SUPPRIMER pour confirmer. */
export function DeleteMyAccount() {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/me", { method: "DELETE" });
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith("pronoradar.history"))
          .forEach((k) => localStorage.removeItem(k));
      } catch {}
      await signOut();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl bg-surface p-5">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between font-semibold text-danger" aria-expanded={open}>
        Supprimer mon compte
        <span className="text-muted">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-[0.875rem] text-muted">
            Ton compte, ton suivi de coupons et ton historique de paiements seront effacés définitivement. Un abonnement Premium en cours sera perdu, sans
            remboursement. Cette action est irréversible.
          </p>
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="Tape SUPPRIMER pour confirmer"
            className="w-full rounded-2xl border-2 border-border bg-surface-2 px-4 py-2.5 outline-none focus:border-danger"
            aria-label="Confirmation"
          />
          {error && <p className="text-[0.875rem] text-danger">{error}</p>}
          <button
            onClick={remove}
            disabled={busy || word.trim().toUpperCase() !== "SUPPRIMER"}
            className="w-full rounded-full bg-danger py-2.5 font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Suppression…" : "Supprimer définitivement"}
          </button>
        </div>
      )}
    </section>
  );
}

/** Administrateur : supprimer le compte d'un client à partir de son numéro ou de son email. */
export function AdminDeleteAccount() {
  const [login, setLogin] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm(`Supprimer définitivement le compte ${login.trim()} et toutes ses données ?`)) return;
    setBusy(true);
    setNote(null);
    try {
      await api("/api/admin/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login }) });
      setNote({ ok: true, text: `Compte ${login.trim()} supprimé.` });
      setLogin("");
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-3xl bg-surface p-5">
      <h3 className="font-display text-xl font-bold">Supprimer le compte d&apos;un client</h3>
      <input
        value={login}
        onChange={(e) => setLogin(e.target.value)}
        placeholder="Numéro ou email du client"
        autoCapitalize="none"
        className="w-full rounded-2xl border-2 border-border bg-surface-2 px-4 py-2.5 outline-none focus:border-danger"
        required
        aria-label="Numéro ou email du client"
      />
      {note && <p className={`text-[0.875rem] ${note.ok ? "text-success" : "text-danger"}`}>{note.text}</p>}
      <button disabled={busy} className="w-full rounded-full bg-danger py-2.5 font-semibold text-white disabled:opacity-60">
        {busy ? "…" : "Supprimer le compte"}
      </button>
    </form>
  );
}
