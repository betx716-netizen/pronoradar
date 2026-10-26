import { isDemo } from "@/lib/http";
import { normalizePhone, phoneLogin } from "@/lib/phone";
import { db, supabaseConfigured } from "@/lib/supabase";
import { demoStore } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Création de compte par numéro de téléphone et mot de passe. Le compte est créé confirmé côté serveur :
// aucun SMS ni email n'est envoyé. Le navigateur se connecte ensuite avec le même numéro et mot de passe.

// Limite simple contre les inscriptions en rafale : 5 comptes par heure et par adresse IP.
const attempts = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < 3600_000);
  attempts.set(ip, [...recent, now]);
  return recent.length >= 5;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { phone?: string; password?: string } | null;
  const phone = normalizePhone(body?.phone ?? "");
  const password = body?.password ?? "";
  if (!phone) return Response.json({ error: "Saisis un numéro à 10 chiffres, par exemple 07 59 35 86 62." }, { status: 400 });
  if (password.length < 6) return Response.json({ error: "Choisis un mot de passe d'au moins 6 caractères." }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
  if (tooMany(ip)) return Response.json({ error: "Trop de comptes créés depuis cet appareil. Réessaie dans une heure." }, { status: 429 });

  if (isDemo()) {
    const users = demoStore().users;
    if (users.has(phone)) return Response.json({ error: "Ce numéro a déjà un compte. Connecte-toi." }, { status: 409 });
    users.set(phone, password);
    return Response.json({ ok: true });
  }
  if (!supabaseConfigured()) return Response.json({ error: "Les comptes ne sont pas encore disponibles." }, { status: 503 });

  const email = phoneLogin(phone);
  const { data, error } = await db().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { phone } });
  if (error || !data.user) {
    if (/already|registered|exists/i.test(error?.message ?? "")) return Response.json({ error: "Ce numéro a déjà un compte. Connecte-toi." }, { status: 409 });
    console.error("Inscription :", error);
    return Response.json({ error: "Impossible de créer le compte. Réessaie." }, { status: 502 });
  }
  await db().from("profiles").upsert({ id: data.user.id, email, phone }, { onConflict: "id" });
  return Response.json({ ok: true });
}

// Mode démo uniquement : vérifie le mot de passe d'un compte fictif.
export async function PUT(req: Request) {
  if (!isDemo()) return Response.json({ error: "Indisponible." }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { phone?: string; password?: string } | null;
  const phone = normalizePhone(body?.phone ?? "");
  if (!phone || demoStore().users.get(phone) !== body?.password) return Response.json({ error: "Numéro ou mot de passe incorrect." }, { status: 401 });
  return Response.json({ ok: true });
}
