// Offres et limites de l'accès gratuit. Partagé par le serveur (contrôle d'accès) et l'interface (affichage).
// Pour changer un prix ou une durée, il suffit de modifier ce fichier. CinetPay exige un montant multiple de 5.

export type PlanId = "semaine" | "mois" | "trimestre";

export type Plan = {
  id: PlanId;
  label: string;
  days: number;
  price: number; // FCFA
  perDay: string;
  badge?: string;
};

export const PLANS: Plan[] = [
  { id: "semaine", label: "1 semaine", days: 7, price: 1000, perDay: "≈ 143 F / jour" },
  { id: "mois", label: "1 mois", days: 30, price: 3000, perDay: "100 F / jour", badge: "Le plus choisi" },
  { id: "trimestre", label: "3 mois", days: 90, price: 7500, perDay: "≈ 83 F / jour", badge: "-17 %" },
];

export const findPlan = (id: string) => PLANS.find((p) => p.id === id) ?? null;

// Ce que voit un visiteur gratuit : le coupon le plus sûr du jour et le pronostic principal de quelques matchs.
export const FREE_COUPONS = ["x2"] as const;
export const FREE_MATCH_TIPS = 3;

export const PREMIUM_PERKS = [
  "Les 6 coupons du jour préparés par l'IA, de la cote 2 à la cote 50",
  "L'analyse complète de tous les matchs du jour",
  "Lance tes propres analyses sur les matchs de 27 championnats",
  "Coupons de l'IA et générateur manuel sur tes analyses",
  "Analyse en direct pendant les matchs",
];

export const fcfa = (n: number) => `${new Intl.NumberFormat("fr-FR").format(n)} F`;

// Paiement manuel : le client envoie le montant sur ce numéro, puis saisit la référence reçue par SMS.
export const MANUAL_PAYMENT = {
  number: "07 59 35 86 62",
  whatsapp: "2250759358662",
  methods: [
    { id: "wave", label: "Wave", hint: "Ouvre Wave, touche « Envoyer », saisis le numéro et le montant." },
    { id: "orange", label: "Orange Money", hint: "Compose le #144#, choisis le transfert d'argent, saisis le numéro et le montant." },
  ],
} as const;
export type ManualMethod = (typeof MANUAL_PAYMENT.methods)[number]["id"];
