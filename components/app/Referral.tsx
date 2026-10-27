"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/client";

const REF_KEY = "pronoradar.ref";

/** Lien de parrainage d'un compte : ?ref=CODE sur l'adresse du site. */
export const referralLink = (code: string) => `${window.location.origin}/?ref=${code}`;

/** Garde le code du lien de parrainage (?ref=…) jusqu'à ce que le visiteur ait un compte, puis le transmet. */
export function useReferralCapture(loggedIn: boolean) {
  useEffect(() => {
    try {
      const code = new URLSearchParams(window.location.search).get("ref");
      if (code) {
        localStorage.setItem(REF_KEY, code.toUpperCase());
        const url = new URL(window.location.href);
        url.searchParams.delete("ref");
        history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (!loggedIn) return;
    let code: string | null = null;
    try {
      code = localStorage.getItem(REF_KEY);
    } catch {}
    if (!code) return;
    authFetch("/api/referral", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) })
      .then((r) => {
        if (r.ok || r.status === 404 || r.status === 400) localStorage.removeItem(REF_KEY);
      })
      .catch(() => {});
  }, [loggedIn]);
}

/** Carte « Parraine tes amis » dans Mon compte. */
export function ReferralCard({ code, invited, rewarded }: { code: string; invited: number; rewarded: number }) {
  const [copied, setCopied] = useState(false);
  if (!code) return null;
  const link = referralLink(code);
  const text = `J'utilise PronoRadar : l'IA analyse les matchs et prépare les coupons du jour. Inscris-toi avec mon lien 👉 ${link}`;
  return (
    <section className="rounded-3xl bg-surface p-5">
      <h3 className="font-display text-xl font-bold">Parraine tes amis</h3>
      <p className="mt-1 text-[14px] text-muted">
        Pour chaque ami qui s&apos;inscrit avec ton lien et prend un abonnement Premium, tu gagnes <strong className="text-text">7 jours de Premium offerts</strong>.
      </p>
      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate text-[14px]">{link}</span>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(link).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          className="shrink-0 text-[14px] font-semibold text-accent"
        >
          {copied ? "Copié ✓" : "Copier"}
        </button>
      </div>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block w-full rounded-full bg-[#1f9d55] py-2.5 text-center font-semibold text-white"
      >
        Partager sur WhatsApp
      </a>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-2xl bg-surface-2 p-2">
          <p className="font-display text-2xl leading-none">{invited}</p>
          <p className="text-[12px] text-muted">ami{invited > 1 ? "s" : ""} inscrit{invited > 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-2xl bg-surface-2 p-2">
          <p className="font-display text-2xl leading-none">{rewarded * 7} j</p>
          <p className="text-[12px] text-muted">de Premium gagnés</p>
        </div>
      </div>
    </section>
  );
}
