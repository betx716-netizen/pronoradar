import { isDemo } from "@/lib/http";
import { normalizePhone, phoneLogin } from "@/lib/phone";
import { db } from "@/lib/supabase";
import { demoStore, getViewer } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Administrateur : remet un nouveau mot de passe à un client qui a oublié le sien (aucun email ni SMS n'existe).
export async function POST(req: Request) {
  const viewer = await getViewer(req);
  if (!viewer?.admin) return Response.json({ error: "Réservé à l'administrateur." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { phone?: string; password?: string } | null;
  const phone = normalizePhone(body?.phone ?? "");
  const password = body?.password ?? "";
  if (!phone) return Response.json({ error: "Numéro invalide." }, { status: 400 });
  if (password.length < 6) return Response.json({ error: "Au moins 6 caractères." }, { status: 400 });

  if (isDemo()) {
    if (!demoStore().users.has(phone)) return Response.json({ error: "Aucun compte avec ce numéro." }, { status: 404 });
    demoStore().users.set(phone, password);
    return Response.json({ ok: true });
  }
  const { data: profile } = await db().from("profiles").select("id").or(`phone.eq.${phone},email.eq.${phoneLogin(phone)}`).maybeSingle();
  if (!profile) return Response.json({ error: "Aucun compte avec ce numéro." }, { status: 404 });
  const { error } = await db().auth.admin.updateUserById(profile.id, { password });
  if (error) return Response.json({ error: "Impossible de changer le mot de passe." }, { status: 502 });
  return Response.json({ ok: true });
}
