import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Jeu responsable",
  description: "Parier doit rester un loisir. Conseils pour garder le contrôle et où trouver de l'aide.",
  alternates: { canonical: "/jeu-responsable" },
};

export default function ResponsiblePage() {
  return (
    <>
      <h1>Jeu responsable</h1>
      <p>
        <strong>Parier comporte des risques : perte d&apos;argent, endettement, dépendance.</strong> {LEGAL.brand} est un outil d&apos;aide à la décision ;
        il ne garantit aucun gain et ne remplace pas votre jugement.
      </p>
      <h2>Interdit aux mineurs</h2>
      <p>Les paris sportifs sont interdits aux moins de 18 ans. {LEGAL.brand} est réservé aux personnes majeures.</p>
      <h2>Nos conseils pour garder le contrôle</h2>
      <ul>
        <li>Fixez-vous un budget par semaine ou par mois, que vous pouvez perdre sans conséquence, et ne le dépassez jamais.</li>
        <li>Ne pariez jamais l&apos;argent du loyer, de la nourriture, de l&apos;école ou des factures.</li>
        <li>Ne cherchez pas à « vous refaire » après une perte : c&apos;est le piège le plus courant.</li>
        <li>Les grosses cotes (combinés de 10, 20 ou 50) sont des paris plaisir : ils perdent bien plus souvent qu&apos;ils ne gagnent. Misez-y petit.</li>
        <li>Quand l&apos;application indique qu&apos;un pari n&apos;a pas d&apos;avantage, le mieux est de passer.</li>
        <li>Suivez vos résultats dans l&apos;onglet Suivi pour savoir honnêtement si vous gagnez ou perdez.</li>
        <li>Ne pariez pas sous l&apos;effet de l&apos;alcool, de la colère ou de la fatigue.</li>
      </ul>
      <h2>Les signes qui doivent alerter</h2>
      <ul>
        <li>Vous pariez plus que prévu, ou de plus en plus souvent.</li>
        <li>Vous empruntez ou vendez des biens pour parier.</li>
        <li>Vous cachez vos paris à vos proches.</li>
        <li>Vous pensez aux paris en permanence, ou vous êtes irritable quand vous ne pariez pas.</li>
      </ul>
      <h2>Se faire aider</h2>
      <p>
        Si vous vous reconnaissez dans ces signes, parlez-en à un proche ou à un médecin, et faites une pause. Les opérateurs de paris agréés proposent des
        limites de dépôt et l&apos;auto-exclusion : utilisez-les. Vous pouvez aussi nous écrire sur <a href={LEGAL.whatsappLink}>WhatsApp</a> pour que
        nous supprimions votre compte {LEGAL.brand}.
      </p>
    </>
  );
}
