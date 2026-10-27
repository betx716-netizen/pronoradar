import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";
import { PLANS, fcfa } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation et de vente",
  description: "Conditions d'utilisation de PronoRadar et conditions de vente de l'abonnement Premium.",
  alternates: { canonical: "/cgu" },
};

export default function CguPage() {
  return (
    <>
      <h1>Conditions générales d&apos;utilisation et de vente</h1>
      <p>Dernière mise à jour : {LEGAL.updated}.</p>

      <h2>1. Objet</h2>
      <p>
        Les présentes conditions encadrent l&apos;utilisation de {LEGAL.brand} (le « Service ») et la vente de l&apos;abonnement Premium. Utiliser le
        Service ou créer un compte vaut acceptation de ces conditions.
      </p>

      <h2>2. Nature du Service : aucune garantie de gain</h2>
      <ul>
        <li>
          {LEGAL.brand} est un <strong>outil d&apos;information et d&apos;aide à la décision</strong>. Les analyses, probabilités, pronostics et coupons
          sont produits en grande partie par une intelligence artificielle à partir de données publiques, et peuvent être inexacts, incomplets ou
          dépassés.
        </li>
        <li>
          <strong>Aucun résultat ni gain n&apos;est garanti.</strong> Les performances passées ne préjugent pas des résultats futurs.
        </li>
        <li>
          {LEGAL.brand} <strong>n&apos;est pas un opérateur de paris</strong> : il ne reçoit aucune mise et n&apos;organise aucun jeu. Les paris se font
          exclusivement auprès d&apos;opérateurs agréés, sous la seule responsabilité de l&apos;utilisateur.
        </li>
        <li>
          L&apos;utilisateur reste seul responsable de ses décisions de pari et de leurs conséquences financières. {LEGAL.brand} ne pourra être tenu
          responsable d&apos;aucune perte liée à un pari.
        </li>
      </ul>

      <h2>3. Conditions d&apos;accès</h2>
      <ul>
        <li>Le Service est réservé aux personnes <strong>âgées de 18 ans ou plus</strong>.</li>
        <li>L&apos;utilisateur s&apos;engage à respecter la législation sur les jeux d&apos;argent de son pays de résidence.</li>
        <li>
          L&apos;utilisateur garde ses identifiants confidentiels. Un compte est personnel : le partage d&apos;un compte Premium entre plusieurs personnes est
          interdit.
        </li>
      </ul>

      <h2>4. Offre gratuite et abonnement Premium</h2>
      <ul>
        <li>Une partie du Service est gratuite, dans les limites affichées dans l&apos;application.</li>
        <li>
          Formules Premium : {PLANS.map((p) => `${p.label} pour ${fcfa(p.price)}`).join(", ")}. Les prix sont en francs CFA (FCFA), toutes taxes
          comprises.
        </li>
        <li>Paiement par Wave ou Orange Money. L&apos;accès est activé après validation du paiement, pour la durée achetée.</li>
        <li>
          <strong>Aucun renouvellement automatique</strong> : à la fin de la période, le compte repasse en offre gratuite, sauf nouveau paiement.
        </li>
      </ul>

      <h2>5. Droit de rétractation et remboursement</h2>
      <p>
        Le Premium est un contenu numérique fourni immédiatement après le paiement. En payant, l&apos;utilisateur demande l&apos;exécution immédiate du
        Service et reconnaît que l&apos;accès, une fois activé, n&apos;est ni rétractable ni remboursable. Un remboursement est accordé en cas d&apos;erreur
        de notre part : paiement en double, ou accès non activé dans les 48 heures malgré un paiement valide. Contact :{" "}
        <a href={LEGAL.whatsappLink}>WhatsApp {LEGAL.whatsapp}</a>.
      </p>

      <h2>6. Disponibilité du Service</h2>
      <p>
        Le Service dépend de fournisseurs tiers (données sportives, intelligence artificielle, hébergement). Il peut être interrompu, limité ou modifié,
        notamment pour maintenance ou en cas de panne d&apos;un fournisseur, sans que cela ouvre droit à indemnisation. En cas d&apos;interruption longue
        (plus de 72 heures consécutives) imputable à {LEGAL.brand}, la durée Premium perdue est prolongée d&apos;autant.
      </p>

      <h2>7. Utilisations interdites</h2>
      <ul>
        <li>Revendre, republier ou diffuser à grande échelle les contenus Premium (coupons, analyses), notamment dans des groupes payants.</li>
        <li>Extraire automatiquement les données du Service (robots, scripts) ou tenter d&apos;en contourner les limites.</li>
        <li>Créer plusieurs comptes pour multiplier les accès gratuits.</li>
      </ul>
      <p>En cas de manquement, le compte peut être suspendu ou supprimé, sans remboursement.</p>

      <h2>8. Suppression du compte</h2>
      <p>
        L&apos;utilisateur peut supprimer son compte à tout moment depuis Mon compte. La suppression est définitive et entraîne la perte de l&apos;accès
        Premium restant, sans remboursement. {LEGAL.brand} peut supprimer un compte inactif ou contraire aux présentes conditions.
      </p>

      <h2>9. Propriété intellectuelle</h2>
      <p>
        Le nom, le logo, l&apos;interface et les contenus produits par {LEGAL.brand} sont protégés. Les noms et logos des équipes et compétitions
        appartiennent à leurs titulaires et ne sont affichés qu&apos;à titre d&apos;information.
      </p>

      <h2>10. Données personnelles</h2>
      <p>
        Voir la <a href="/confidentialite">politique de confidentialité</a>.
      </p>

      <h2>11. Modification et droit applicable</h2>
      <p>
        Ces conditions peuvent évoluer ; la version en ligne fait foi. Elles sont soumises au droit ivoirien. En cas de litige, une solution amiable est
        recherchée d&apos;abord ; à défaut, les tribunaux d&apos;Abidjan sont compétents.
      </p>
    </>
  );
}
