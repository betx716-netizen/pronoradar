import { newTransactionId } from "@/lib/cinetpay";
import { isDemo } from "@/lib/http";
import { MANUAL_PAYMENT, findPlan } from "@/lib/plans";
import { db, supabaseConfigured } from "@/lib/supabase";
import { demoStore, getViewer, unauthorized } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Demande d'activation après un paiement Mobile Money envoyé sur le numéro de PronoRadar.
// Le paiement reste « en vérification » jusqu'à ce que l'administrateur le valide.
export async function POST(req: Request) {
  const viewer = await getViewer(req);
  if (!viewer) return unauthorized();
  const body = (await req.json().catch(() => null)) as { plan?: string; method?: string; reference?: string; payerPhone?: string } | null;
  const plan = findPlan(body?.plan ?? "");
  const method = MANUAL_PAYMENT.methods.find((m) => m.id === body?.method);
  const reference = (body?.reference ?? "").trim().replace(/\s+/g, "").toUpperCase().slice(0, 60);
  const payerPhone = (body?.payerPhone ?? "").replace(/[^\d+]/g, "").slice(0, 20);
  if (!plan || !method) return Response.json({ error: "Choisis une offre et un moyen de paiement." }, { status: 400 });
  if (reference.length < 5) return Response.json({ error: "Saisis la référence de la transaction reçue par SMS." }, { status: 400 });
  if (payerPhone.replace(/\D/g, "").length < 8) return Response.json({ error: "Saisis le numéro qui a envoyé l'argent." }, { status: 400 });

  const id = newTransactionId();
  if (isDemo()) {
    const s = demoStore();
    if ([...s.payments.values()].some((p) => p.reference === reference)) return Response.json({ error: "Cette référence a déjà été utilisée." }, { status: 409 });
    s.payments.set(id, { user: viewer.email, days: plan.days, status: "review", plan: plan.id, amount: plan.price, method: method.label, reference, payerPhone, createdAt: new Date().toISOString() });
    return Response.json({ id, status: "review" });
  }
  if (!supabaseConfigured()) return Response.json({ error: "Le paiement n'est pas encore disponible." }, { status: 503 });

  // Une seule demande en attente à la fois par compte : évite les envois en double.
  const { count } = await db().from("payments").select("id", { count: "exact", head: true }).eq("user_id", viewer.id).eq("status", "review");
  if ((count ?? 0) >= 3) return Response.json({ error: "Tu as déjà des paiements en vérification. Patiente un peu, ils seront validés rapidement." }, { status: 429 });

  const { error } = await db().from("payments").insert({
    id,
    user_id: viewer.id,
    plan: plan.id,
    amount: plan.price,
    days: plan.days,
    status: "review",
    method: method.label,
    reference,
    payer_phone: payerPhone,
  });
  if (error) {
    if (error.code === "23505") return Response.json({ error: "Cette référence a déjà été utilisée." }, { status: 409 });
    console.error(error);
    return Response.json({ error: "Impossible d'enregistrer la demande. Réessaie." }, { status: 502 });
  }
  return Response.json({ id, status: "review" });
}
