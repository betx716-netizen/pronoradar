"use client";

import { useState } from "react";
import { loadConfig, sendCode, verifyCode } from "@/lib/session";

/** Connexion en deux temps : l'email, puis le code à 6 chiffres reçu par email. Le compte est créé au besoin. */
export function LoginForm({ intro, onDone }: { intro?: string; onDone?: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Saisis une adresse email valide.");
    setBusy(true);
    setError(null);
    try {
      await sendCode(email.trim());
      setDemo((await loadConfig()).demo);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await verifyCode(email.trim(), code.trim());
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  }

  const input = "w-full rounded-2xl border-2 border-border bg-surface px-4 py-3 outline-none focus:border-accent";

  return step === "email" ? (
    <form onSubmit={submitEmail} className="space-y-3">
      <p className="text-[15px] text-muted">{intro ?? "Pas de mot de passe : on t'envoie un code par email."}</p>
      <label className="block">
        <span className="mb-1 block text-[14px] font-medium">Adresse email</span>
        <input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@exemple.com" className={input} required />
      </label>
      {error && <p className="text-[14px] text-danger">{error}</p>}
      <button disabled={busy} className="w-full rounded-full bg-pitch py-3.5 font-semibold text-white disabled:opacity-60">
        {busy ? "Envoi…" : "Recevoir mon code"}
      </button>
    </form>
  ) : (
    <form onSubmit={submitCode} className="space-y-3">
      <p className="text-[15px] text-muted">
        Code envoyé à <strong className="text-text">{email}</strong>. Pense à regarder dans les spams.
        {demo && " (Démo : saisis 123456.)"}
      </p>
      <label className="block">
        <span className="mb-1 block text-[14px] font-medium">Code reçu</span>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          className={`${input} font-display text-2xl tracking-[0.3em]`}
          required
        />
      </label>
      {error && <p className="text-[14px] text-danger">{error}</p>}
      <button disabled={busy || code.length < 6} className="w-full rounded-full bg-pitch py-3.5 font-semibold text-white disabled:opacity-60">
        {busy ? "Vérification…" : "Me connecter"}
      </button>
      <button type="button" onClick={() => setStep("email")} className="w-full py-2 text-[14px] font-medium text-muted">
        Changer d&apos;adresse
      </button>
    </form>
  );
}
