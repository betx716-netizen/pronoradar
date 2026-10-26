import { after } from "next/server";
import { isDemo } from "@/lib/http";
import { appOrigin } from "@/lib/kick";
import { notifyAdmin } from "@/lib/notify";
import { formatPhone, normalizePhone, phoneLogin } from "@/lib/phone";
import { db, supabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mot de passe oublié : sans SMS ni email, la demande part à l'administrateur (notification ntfy),
// qui définit un nouveau mot de passe dans Mon compte et l'envoie au client sur WhatsApp.
const recent = new Map<string, number>();

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { phone?: string } | null;
  const phone = normalizePhone(body?.phone ?? "");
  if (!phone) return Response.json({ error: "Saisis ton numéro à 10 chiffres, par exemple 07 59 35 86 62." }, { status: 400 });
  // Une demande toutes les 10 minutes par numéro, pour éviter les alertes en rafale.
  const last = recent.get(phone) ?? 0;
  if (Date.now() - last < 10 * 60_000) return Response.json({ ok: true });
  recent.set(phone, Date.now());

  let known = true;
  if (!isDemo() && supabaseConfigured()) {
    const { data } = await db().from("profiles").select("id").or(`phone.eq.${phone},email.eq.${phoneLogin(phone)}`).maybeSingle();
    known = Boolean(data);
  }
  // Même réponse que le numéro existe ou non : on ne révèle pas qui a un compte.
  if (known) {
    after(() =>
      notifyAdmin("Mot de passe oublié", `${formatPhone(phone)} demande un nouveau mot de passe.\nDéfinis-le dans Mon compte puis envoie-le-lui sur WhatsApp.`, {
        tags: "key",
        priority: "high",
        click: appOrigin(req),
      }),
    );
  }
  return Response.json({ ok: true });
}
