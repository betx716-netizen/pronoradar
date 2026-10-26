// Comptes par numéro de téléphone, sans SMS : chaque numéro correspond à un identifiant interne
// au format email (225XXXXXXXXXX@tel.pronoradar.app), jamais utilisé pour envoyer quoi que ce soit.

const DOMAIN = "tel.pronoradar.app";

/** Numéro ivoirien à 10 chiffres (07 59 35 86 62), avec ou sans indicatif +225. Null s'il est invalide. */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("00225")) d = d.slice(5);
  else if (d.startsWith("225") && d.length === 13) d = d.slice(3);
  return /^0\d{9}$/.test(d) ? d : null;
}

export const phoneLogin = (phone: string) => `225${phone}@${DOMAIN}`;

/** Numéro lisible à partir de l'identifiant interne (ou l'email tel quel pour un ancien compte). */
export function displayAccount(login: string | null | undefined): string {
  if (!login) return "";
  const m = login.match(/^225(\d{10})@tel\.pronoradar\.app$/);
  return m ? formatPhone(m[1]) : login;
}

export const formatPhone = (d: string) => d.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
