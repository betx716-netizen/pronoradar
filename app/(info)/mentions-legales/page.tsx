import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Éditeur, hébergeur et contact de PronoRadar.",
  alternates: { canonical: "/mentions-legales" },
};

export default function LegalPage() {
  return (
    <>
      <h1>Mentions légales</h1>
      <h2>Éditeur</h2>
      <p>
        {LEGAL.brand}
        {LEGAL.editor ? <>, édité par {LEGAL.editor}</> : null}
        <br />
        {LEGAL.address}
        <br />
        Contact : <a href={LEGAL.whatsappLink}>WhatsApp {LEGAL.whatsapp}</a>
        {LEGAL.email ? <> · <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a></> : null}
      </p>
      <h2>Hébergement</h2>
      <p>
        Site : {LEGAL.host}
        <br />
        Données : {LEGAL.database}
      </p>
      <h2>Avertissement</h2>
      <p>
        {LEGAL.brand} est un service d&apos;information et d&apos;aide à la décision sur les paris sportifs. Il n&apos;est pas un opérateur de jeux
        d&apos;argent, ne reçoit aucune mise et ne garantit aucun gain. Réservé aux personnes majeures. Voir les{" "}
        <a href="/cgu">conditions d&apos;utilisation</a> et la page <a href="/jeu-responsable">jeu responsable</a>.
      </p>
    </>
  );
}
