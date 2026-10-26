"use client";

import { useState } from "react";
import { changePassword } from "@/lib/session";

/** Changer son mot de passe une fois connecté (par exemple après en avoir reçu un nouveau). */
export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== confirm) return setNote({ ok: false, text: "Les deux mots de passe ne sont pas identiques." });
    setBusy(true);
    setNote(null);
    try {
      await changePassword(pw);
      setNote({ ok: true, text: "Mot de passe changé." });
      setPw("");
      setConfirm("");
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
    setBusy(false);
  }

  const input = "w-full rounded-2xl border-2 border-border bg-surface-2 px-4 py-2.5 outline-none focus:border-accent";
  return (
    <section className="rounded-3xl bg-surface p-5">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between font-semibold" aria-expanded={open}>
        Changer mon mot de passe
        <span className="text-muted">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <form onSubmit={submit} className="mt-3 space-y-3">
          <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Nouveau mot de passe (6 caractères min.)" minLength={6} className={input} required aria-label="Nouveau mot de passe" />
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirme le mot de passe" minLength={6} className={input} required aria-label="Confirme le mot de passe" />
          {note && <p className={`text-[14px] ${note.ok ? "text-success" : "text-danger"}`}>{note.text}</p>}
          <button disabled={busy} className="w-full rounded-full bg-accent py-2.5 font-semibold text-white disabled:opacity-60">
            {busy ? "…" : "Enregistrer le nouveau mot de passe"}
          </button>
        </form>
      )}
    </section>
  );
}
