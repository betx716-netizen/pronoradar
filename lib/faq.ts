import { FREE_ANALYSES_LABEL, PLANS, fcfa } from "./plans";

// Questions fréquentes : affichées sur /faq et transmises à Google (données structurées FAQPage).
export const FAQ: { q: string; a: string }[] = [
  {
    q: "Qu'est-ce que PronoRadar ?",
    a: "PronoRadar est une application d'aide à la décision pour les paris sportifs (football et tennis). Une intelligence artificielle recense les pronostics publiés sur le web, les compare aux cotes des bookmakers et aux statistiques (forme, confrontations, absences), puis propose une analyse et des coupons.",
  },
  {
    q: "PronoRadar garantit-il des gains ?",
    a: "Non. Aucun pronostic n'est certain : même un favori perd régulièrement. PronoRadar donne des probabilités estimées et signale les paris sans avantage, mais vous seul décidez de parier et vous restez responsable de vos mises. Ne pariez jamais l'argent dont vous avez besoin.",
  },
  {
    q: "PronoRadar est-il un site de paris ?",
    a: "Non. PronoRadar ne prend aucun pari et ne reçoit aucune mise. Pour parier, vous passez par un opérateur agréé dans votre pays. PronoRadar vous aide seulement à analyser les matchs.",
  },
  {
    q: "Qu'est-ce qui est gratuit ?",
    a: `Sans payer, vous voyez le coupon le plus sûr du jour et le pronostic principal de quelques matchs. Avec un compte gratuit, vous avez aussi ${FREE_ANALYSES_LABEL.toLowerCase()}.`,
  },
  {
    q: "Combien coûte le Premium ?",
    a: `${PLANS.map((p) => `${p.label} : ${fcfa(p.price)}`).join(" ; ")}. Le Premium donne accès à tous les coupons du jour préparés par l'IA, aux analyses illimitées et à l'analyse en direct. Il n'y a pas de renouvellement automatique : vous payez seulement quand vous voulez prolonger.`,
  },
  {
    q: "Comment payer ?",
    a: "Par Wave ou Orange Money. Une fois le paiement validé, votre accès Premium est activé sur votre compte et vous le retrouvez sur tous vos appareils.",
  },
  {
    q: "Puis-je être remboursé ?",
    a: "L'accès Premium est un contenu numérique activé immédiatement : il n'est pas remboursable une fois activé, sauf erreur de notre part (double paiement, accès non activé). Dans ce cas, contactez-nous sur WhatsApp.",
  },
  {
    q: "Comment créer un compte ?",
    a: "Avec votre numéro de téléphone et un mot de passe, ou avec votre email : dans ce cas, un lien de confirmation vous est envoyé. Pensez à regarder dans vos spams.",
  },
  {
    q: "J'ai oublié mon mot de passe.",
    a: "Dans la fenêtre de connexion, touchez « Mot de passe oublié ? ». Avec un email, vous recevez un lien pour en choisir un nouveau ; avec un numéro, nous vous envoyons un nouveau mot de passe sur WhatsApp.",
  },
  {
    q: "Comment supprimer mon compte ?",
    a: "Dans Mon compte, touchez « Supprimer mon compte » et confirmez. Votre compte et vos données (suivi, historique de paiements) sont effacés définitivement.",
  },
  {
    q: "D'où viennent les données ?",
    a: "Des cotes publiques des bookmakers, de services de statistiques et de résultats sportifs, et de pronostics publiés sur le web (médias, pronostiqueurs, sites de prédictions). L'IA peut se tromper ou s'appuyer sur une information dépassée : vérifiez toujours les informations importantes, comme les compositions d'équipes.",
  },
  {
    q: "Qui peut utiliser PronoRadar ?",
    a: "Uniquement les personnes majeures (18 ans et plus), dans un pays où les paris sportifs sont autorisés.",
  },
];
