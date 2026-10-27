// Suppression définitive d'un compte : la base efface en cascade son profil, son suivi, ses paiements
// et son usage gratuit. Les comptes administrateurs ne peuvent pas être supprimés depuis l'application.
import { isDemo } from "./http";
import { normalizePhone, phoneLogin } from "./phone";
import { db } from "./supabase";
import { admins, demoStore } from "./user";

export class DeleteError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

/** Identifiant interne d'un compte à partir d'un numéro ou d'un email. */
function loginOf(input: string): string | null {
  const phone = normalizePhone(input);
  if (phone) return phoneLogin(phone);
  const email = input.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export async function deleteAccountByLogin(input: string) {
  const login = loginOf(input);
  if (!login) throw new DeleteError("Saisis un numéro à 10 chiffres ou un email.");
  if (admins().includes(login)) throw new DeleteError("Un compte administrateur ne peut pas être supprimé ici.");
  if (isDemo()) {
    const phone = normalizePhone(input);
    if (!phone || !demoStore().users.delete(phone)) throw new DeleteError("Aucun compte trouvé.", 404);
    return;
  }
  const phone = normalizePhone(input);
  const query = db().from("profiles").select("id");
  const { data } = await (phone ? query.or(`phone.eq.${phone},email.eq.${login}`) : query.eq("email", login)).maybeSingle();
  let id: string | undefined = data?.id;
  // Compte email pas encore confirmé : il n'a pas encore de profil, on le cherche dans les comptes eux-mêmes.
  for (let page = 1; !id && page <= 5; page++) {
    const { data: list } = await db().auth.admin.listUsers({ page, perPage: 1000 });
    id = list?.users.find((u) => u.email?.toLowerCase() === login)?.id;
    if (!list || list.users.length < 1000) break;
  }
  if (!id) throw new DeleteError("Aucun compte trouvé.", 404);
  await deleteAccountById(id);
}

export async function deleteAccountById(id: string) {
  if (isDemo()) return;
  const { error } = await db().auth.admin.deleteUser(id);
  if (error) {
    console.error("Suppression de compte :", error);
    throw new DeleteError("Impossible de supprimer le compte. Réessaie.", 502);
  }
}
