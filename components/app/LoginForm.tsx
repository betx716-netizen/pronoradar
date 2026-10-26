"use client";

import { useState } from "react";
import { MANUAL_PAYMENT } from "@/lib/plans";
import { signIn, signUp } from "@/lib/session";

/** Connexion ou création de compte avec le numéro de téléphone et un mot de passe. Aucun SMS ni email. */
export function LoginForm({ intro, defaultMode = "signup", onDone }: { intro?: string; defaultMode?: "signup" | "login"; onDone?: () => void }) {
  const [mode, setMode] = useState<"signup" | "login">(defaultMode);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "signup" && password !== confirm) return setError("Les deux mots de passe ne sont pas identiques.");
    setBusy(true);
    try {
      if (mode === "signup") await signUp(phone, password);
      else await signIn(phone, password);
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  }

  const input = "w-full rounded-2xl border-2 border-border bg-surface px-4 py-3 outline-none focus:border-accent";
  const help = `Bonjour, j'ai oublié le mot de passe de mon compte PronoRadar (numéro : ${phone || "…"}).`;

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex rounded-full bg-surface-3 p-1 text-[15px] font-semibold" role="tablist">
        {(
          [
            ["signup", "Créer un compte"],
            ["login", "Se connecter"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`flex-1 rounded-full py-2 ${mode === m ? "bg-surface shadow-sm" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {intro && <p className="text-[15px] text-muted">{intro}</p>}
      <label className="block">
        <span className="mb-1 block text-[14px] font-medium">Numéro de téléphone</span>
        <input inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07 00 00 00 00" className={input} required />
      </label>
      <label className="block">
        <span className="mb-1 flex items-baseline justify-between text-[14px] font-medium">
          Mot de passe
          <button type="button" onClick={() => setShow(!show)} className="text-[13px] font-semibold text-accent">
            {show ? "Masquer" : "Afficher"}
          </button>
        </span>
        <input
          type={show ? "text" : "password"}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "signup" ? "Au moins 6 caractères" : ""}
          minLength={6}
          className={input}
          required
        />
      </label>
      {mode === "signup" && (
        <label className="block">
          <span className="mb-1 block text-[14px] font-medium">Confirme le mot de passe</span>
          <input type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={6} className={input} required />
        </label>
      )}
      {error && <p className="text-[14px] text-danger">{error}</p>}
      <button disabled={busy} className="w-full rounded-full bg-accent py-3.5 font-semibold text-white disabled:opacity-60">
        {busy ? "Un instant…" : mode === "signup" ? "Créer mon compte" : "Me connecter"}
      </button>
      {mode === "login" && (
        <a
          href={`https://wa.me/${MANUAL_PAYMENT.whatsapp}?text=${encodeURIComponent(help)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block py-1 text-center text-[14px] font-medium text-muted"
        >
          Mot de passe oublié ? Écris-nous sur WhatsApp
        </a>
      )}
    </form>
  );
}
