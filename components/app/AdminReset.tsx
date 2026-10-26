"use client";

import { useState } from "react";
import { api } from "@/lib/client";

/** Administrateur : nouveau mot de passe pour un client qui a oublié le sien (à lui transmettre sur WhatsApp). */
export function AdminReset() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      await api("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, password }) });
      setNote({ ok: true, text: `Mot de passe changé. Envoie-le au client : ${password}` });
      setPassword("");
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
    setBusy(false);
  }

  const input = "w-full rounded-2xl border-2 border-border bg-surface-2 px-4 py-2.5 outline-none focus:border-accent";
  return (
    <form onSubmit={submit} className="space-y-3 rounded-3xl bg-surface p-5">
      <h3 className="font-display text-xl font-bold">Mot de passe oublié d&apos;un client</h3>
      <input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Numéro du client" className={input} required aria-label="Numéro du client" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nouveau mot de passe (6 caractères min.)" minLength={6} className={input} required aria-label="Nouveau mot de passe" />
      {note && <p className={`text-[14px] ${note.ok ? "text-success" : "text-danger"}`}>{note.text}</p>}
      <button disabled={busy} className="w-full rounded-full bg-accent py-2.5 font-semibold text-white disabled:opacity-60">
        {busy ? "…" : "Changer le mot de passe"}
      </button>
    </form>
  );
}
