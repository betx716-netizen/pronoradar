"use client";

import { useState } from "react";
import { MANUAL_PAYMENT } from "@/lib/plans";
import { isEmail, resendConfirmation, sendPasswordReset, signIn, signUp } from "@/lib/session";

/** Connexion ou création de compte avec le numéro de téléphone (sans SMS) ou un email (lien de confirmation). */
export function LoginForm({ intro, defaultMode = "signup", onDone }: { intro?: string; defaultMode?: "signup" | "login"; onDone?: () => void }) {
  const [mode, setMode] = useState<"signup" | "login">(defaultMode);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const byEmail = isEmail(phone);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (mode === "signup" && password !== confirm) return setError("Les deux mots de passe ne sont pas identiques.");
    setBusy(true);
    try {
      if (mode === "signup") {
        if ((await signUp(phone, password)) === "confirm") {
          setInfo(`Compte créé. Un lien de confirmation vient d'être envoyé à ${phone.trim()} : clique dessus pour activer ton compte (regarde aussi dans les spams).`);
          setPassword("");
          setConfirm("");
          setMode("login");
          setBusy(false);
          return;
        }
      } else await signIn(phone, password);
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  }

  const input = "w-full rounded-2xl border-2 border-border bg-surface px-4 py-3 outline-none focus:border-accent";
  const help = `Bonjour, j'ai oublié le mot de passe de mon compte PronoRadar (numéro : ${phone || "…"}).`;

  async function resend() {
    setBusy(true);
    try {
      await resendConfirmation(phone);
      setError(null);
      setInfo("Nouveau lien de confirmation envoyé.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  }

  async function askReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (byEmail) {
        await sendPasswordReset(phone);
        setForgotSent(true);
        setBusy(false);
        return;
      }
      const res = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? "Demande impossible. Réessaie.");
      setForgotSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  }

  if (forgot) {
    return (
      <form onSubmit={askReset} className="space-y-3">
        <p className="text-[15px] font-semibold">Mot de passe oublié</p>
        {forgotSent ? (
          <>
            {byEmail ? (
              <p className="rounded-2xl bg-success-soft p-3 text-[15px] text-success">
                Si un compte existe pour {phone.trim()}, un lien pour choisir un nouveau mot de passe vient d&apos;être envoyé par email (regarde aussi dans les spams).
              </p>
            ) : (
            <>
            <p className="rounded-2xl bg-success-soft p-3 text-[15px] text-success">
              Demande envoyée. Tu vas recevoir ton nouveau mot de passe sur WhatsApp au {phone}. Tu pourras ensuite le changer dans Mon compte.
            </p>
            <a
              href={`https://wa.me/${MANUAL_PAYMENT.whatsapp}?text=${encodeURIComponent(help)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-full bg-[#1f9d55] py-3 text-center font-semibold text-white"
            >
              Nous écrire sur WhatsApp
            </a>
            </>
            )}
          </>
        ) : (
          <>
            <p className="text-[14px] text-muted">
              Saisis le numéro ou l&apos;email de ton compte. Avec un email, tu reçois un lien pour choisir un nouveau mot de passe ; avec un numéro, un nouveau mot de passe sur WhatsApp.
            </p>
            <label className="block">
              <span className="mb-1 block text-[14px] font-medium">Numéro ou email</span>
              <input autoComplete="username" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07 00 00 00 00 ou nom@email.com" className={input} required />
            </label>
            {error && <p className="text-[14px] text-danger">{error}</p>}
            <button disabled={busy} className="w-full rounded-full bg-accent py-3.5 font-semibold text-white disabled:opacity-60">
              {busy ? "Envoi…" : byEmail ? "Recevoir le lien par email" : "Recevoir un nouveau mot de passe"}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => {
            setForgot(false);
            setForgotSent(false);
            setMode("login");
            setError(null);
          }}
          className="w-full py-2 text-[14px] font-medium text-muted"
        >
          Retour à la connexion
        </button>
      </form>
    );
  }

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
        <span className="mb-1 block text-[14px] font-medium">Numéro de téléphone ou email</span>
        <input
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="07 00 00 00 00 ou nom@email.com"
          className={input}
          required
        />
        {mode === "signup" && byEmail && <span className="mt-1 block text-[13px] text-muted">Un lien de confirmation te sera envoyé par email.</span>}
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
      {error && (
        <p className="text-[14px] text-danger">
          {error}
          {/confirm/i.test(error) && byEmail && (
            <button type="button" onClick={resend} className="ml-1 font-semibold underline">
              Renvoyer le lien
            </button>
          )}
        </p>
      )}
      {info && <p className="rounded-2xl bg-success-soft p-3 text-[15px] text-success">{info}</p>}
      <button disabled={busy} className="w-full rounded-full bg-accent py-3.5 font-semibold text-white disabled:opacity-60">
        {busy ? "Un instant…" : mode === "signup" ? "Créer mon compte" : "Me connecter"}
      </button>
      <button
        type="button"
        onClick={() => {
          setForgot(true);
          setError(null);
        }}
        className="w-full rounded-full border-2 border-border py-3 text-[15px] font-semibold text-muted"
      >
        Mot de passe oublié ?
      </button>
    </form>
  );
}
