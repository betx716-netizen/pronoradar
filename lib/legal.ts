// Informations de l'éditeur, reprises dans les pages légales. À compléter (nom, adresse…) dans ce seul fichier.
import { MANUAL_PAYMENT } from "./plans";

export const LEGAL = {
  brand: "PronoRadar",
  // Nom de la personne ou de la société qui édite le site (obligatoire dans les mentions légales).
  editor: "",
  // Ville et pays de l'éditeur ; adresse complète si possible.
  address: "Abidjan, Côte d'Ivoire",
  // Email de contact public (laisser vide pour n'afficher que WhatsApp).
  email: "",
  whatsapp: MANUAL_PAYMENT.number,
  whatsappLink: `https://wa.me/${MANUAL_PAYMENT.whatsapp}`,
  host: "Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — vercel.com",
  database: "Supabase Inc. (hébergement des comptes et des données, serveurs en Europe)",
  updated: "27 octobre 2026",
};

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://pronoradar.vercel.app")
).replace(/\/$/, "");

export const INFO_PAGES = [
  { href: "/bilan", label: "Bilan de l'IA" },
  { href: "/faq", label: "FAQ" },
  { href: "/jeu-responsable", label: "Jeu responsable" },
  { href: "/cgu", label: "Conditions d'utilisation" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/mentions-legales", label: "Mentions légales" },
];
