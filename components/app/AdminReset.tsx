"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { formatPhone, normalizePhone } from "@/lib/phone";

/** Administrateur : nouveau mot de passe pour un client qui a oublié le sien, puis envoi direct sur WhatsApp. */
export function AdminReset() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Dernier changement réussi : numéro et mot de passe à envoyer au client.
  const [done, setDone] = useState<{ phone: string; password: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await api("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, password }) });
      setDone({ phone: normalizePhone(phone) ?? phone, password });
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  }

  // Lien WhatsApp vers le numéro du client (indicatif 225), message déjà rempli.
  const whatsapp = (d: { phone: string; password: string }) => {
    const text = [
      "Bonjour,",
      "voici ton nouveau mot de passe PronoRadar :",
      d.password,
      "",
      `Connecte-toi avec ton numéro ${formatPhone(d.phone)} sur ${typeof window !== "undefined" ? window.location.origin : "le site"}, puis change-le dans Mon compte → Changer mon mot de passe.`,
    ].join("\n");
    return `https://wa.me/225${d.phone}?text=${encodeURIComponent(text)}`;
  };

  const input = "w-full rounded-2xl border-2 border-border bg-surface-2 px-4 py-2.5 outline-none focus:border-accent";
  return (
    <form onSubmit={submit} className="space-y-3 rounded-3xl bg-surface p-5">
      <h3 className="font-display text-xl font-bold">Mot de passe oublié d&apos;un client</h3>
      <input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Numéro du client" className={input} required aria-label="Numéro du client" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nouveau mot de passe (6 caractères min.)" minLength={6} className={input} required aria-label="Nouveau mot de passe" />
      {error && <p className="text-[14px] text-danger">{error}</p>}
      {done && (
        <div className="space-y-2 rounded-2xl bg-success-soft p-3">
          <p className="text-[14px] text-success">
            Mot de passe changé pour le {formatPhone(done.phone)} : <strong>{done.password}</strong>
          </p>
          <a
            href={whatsapp(done)}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-full bg-[#1f9d55] py-2.5 text-center font-semibold text-white"
          >
            Envoyer sur WhatsApp
          </a>
        </div>
      )}
      <button disabled={busy} className="w-full rounded-full bg-accent py-2.5 font-semibold text-white disabled:opacity-60">
        {busy ? "…" : "Changer le mot de passe"}
      </button>
    </form>
  );
}
