"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import type { CouponLeg } from "@/lib/coupon";
import { FEATURES } from "@/lib/features";
import { couponImage } from "@/lib/shareImage";

// Code de parrainage du compte connecté, demandé une seule fois.
let refCode: Promise<string> | null = null;
const myRefCode = () =>
  (refCode ??= api<{ referral?: { code: string } }>("/api/me")
    .then((m) => m.referral?.code ?? "")
    .catch(() => ""));

/** Bouton « Partager » : crée l'image du coupon (avec le lien de parrainage) et ouvre le partage du téléphone. */
export function ShareCouponButton({ title, legs, totalOdds, className = "" }: { title: string; legs: CouponLeg[]; totalOdds: number; className?: string }) {
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    try {
      const code = await myRefCode();
      const link = `${window.location.origin}/${code ? `?ref=${code}` : ""}`;
      const blob = await couponImage({ title, legs, totalOdds, link });
      const file = new File([blob], "coupon-pronoradar.png", { type: "image/png" });
      const text = `Mon coupon PronoRadar (cote ${totalOdds.toFixed(2)}), analysé par l'IA 👉 ${link}`;
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, url: link, title: "Coupon PronoRadar" }).catch(() => {});
      } else {
        // Ordinateur ou navigateur sans partage de fichiers : on télécharge l'image.
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "coupon-pronoradar.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch {}
    setBusy(false);
  }

  if (!FEATURES.share)
    return (
      <button disabled title="Bientôt disponible" className={`rounded-xl border border-border py-2 text-sm font-semibold text-muted opacity-60 ${className}`}>
        🔒 Partager
      </button>
    );

  return (
    <button onClick={share} disabled={busy} className={`rounded-xl border border-border py-2 text-sm font-semibold transition active:scale-95 disabled:opacity-60 ${className}`}>
      {busy ? "Image…" : "Partager"}
    </button>
  );
}
