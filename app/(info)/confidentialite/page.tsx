import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Quelles données PronoRadar collecte, pourquoi, combien de temps, et comment les supprimer.",
  alternates: { canonical: "/confidentialite" },
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Politique de confidentialité</h1>
      <p>Dernière mise à jour : {LEGAL.updated}.</p>
      <p>
        {LEGAL.brand} collecte le minimum de données nécessaires au fonctionnement du Service, conformément à la loi ivoirienne n° 2013-450 du 19 juin
        2013 relative à la protection des données à caractère personnel.
      </p>

      <h2>Données collectées</h2>
      <ul>
        <li><strong>Compte :</strong> numéro de téléphone ou adresse email, mot de passe (stocké sous forme chiffrée, jamais lisible).</li>
        <li><strong>Abonnement :</strong> formule choisie, montant, moyen de paiement (Wave, Orange Money), référence de transaction, numéro payeur.</li>
        <li><strong>Utilisation :</strong> coupons enregistrés dans le Suivi, nombre d&apos;analyses gratuites utilisées.</li>
        <li>
          <strong>Sur votre appareil :</strong> préférences (thème, couleurs) et analyses récentes, gardées dans le navigateur et non transmises.
        </li>
      </ul>
      <p>Aucune donnée n&apos;est vendue ni utilisée pour de la publicité ciblée.</p>

      <h2>Pourquoi</h2>
      <ul>
        <li>Créer et sécuriser votre compte, et vous permettre de le retrouver sur tous vos appareils.</li>
        <li>Activer et gérer votre abonnement Premium, et traiter les réclamations de paiement.</li>
        <li>Vous envoyer les emails nécessaires au compte (confirmation, mot de passe oublié).</li>
        <li>Prévenir les abus (comptes multiples, partage de comptes).</li>
      </ul>

      <h2>Prestataires</h2>
      <ul>
        <li>Hébergement du site : {LEGAL.host}.</li>
        <li>Comptes et base de données : {LEGAL.database}.</li>
        <li>Envoi des emails : Brevo (Sendinblue SAS, France).</li>
        <li>
          Analyse par intelligence artificielle : les noms des équipes et des matchs analysés sont envoyés à des services d&apos;IA. Aucune donnée
          personnelle n&apos;y est transmise.
        </li>
      </ul>
      <p>Certains prestataires sont situés hors de Côte d&apos;Ivoire ; ils sont choisis pour leurs garanties de sécurité.</p>

      <h2>Durée de conservation</h2>
      <ul>
        <li>Les données du compte sont gardées tant que le compte existe.</li>
        <li>Elles sont effacées dès la suppression du compte, depuis Mon compte ou sur demande.</li>
        <li>Un compte inactif depuis plus de 2 ans peut être supprimé.</li>
      </ul>

      <h2>Vos droits</h2>
      <p>
        Vous pouvez accéder à vos données, les corriger ou les faire supprimer. Pour supprimer votre compte et toutes ses données, utilisez « Supprimer
        mon compte » dans Mon compte. Pour toute autre demande : <a href={LEGAL.whatsappLink}>WhatsApp {LEGAL.whatsapp}</a>
        {LEGAL.email ? <> ou <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a></> : null}. Vous pouvez aussi saisir l&apos;ARTCI (Autorité de Régulation
        des Télécommunications/TIC de Côte d&apos;Ivoire), autorité de protection des données.
      </p>

      <h2>Mineurs</h2>
      <p>Le Service est interdit aux moins de 18 ans. Un compte créé par un mineur sera supprimé dès que nous en avons connaissance.</p>
    </>
  );
}
