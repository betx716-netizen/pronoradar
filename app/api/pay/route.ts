import { PaymentError, cinetpayConfigured, createPayment, newTransactionId } from "@/lib/cinetpay";
import { isDemo } from "@/lib/http";
import { appOrigin } from "@/lib/kick";
import { findPlan } from "@/lib/plans";
import { demoStore, getViewer, unauthorized } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Démarre un paiement : renvoie l'adresse du guichet CinetPay où l'utilisateur choisit son moyen de paiement.
export async function POST(req: Request) {
  const viewer = await getViewer(req);
  if (!viewer) return unauthorized();
  const body = (await req.json().catch(() => null)) as { plan?: string } | null;
  const plan = findPlan(body?.plan ?? "");
  if (!plan) return Response.json({ error: "Offre inconnue." }, { status: 400 });
  const origin = appOrigin(req);

  // Démo : pas de vrai paiement, le retour active directement l'offre.
  if (isDemo()) {
    const id = newTransactionId();
    demoStore().payments.set(id, { user: viewer.email, days: plan.days, status: "pending" });
    return Response.json({ id, url: `${origin}/api/pay/return?id=${id}` });
  }
  if (!cinetpayConfigured()) return Response.json({ error: "Le paiement n'est pas encore disponible." }, { status: 503 });
  try {
    return Response.json(await createPayment({ userId: viewer.id, email: viewer.email, plan, origin }));
  } catch (e) {
    return Response.json({ error: e instanceof PaymentError ? e.message : "Erreur lors du paiement." }, { status: 502 });
  }
}
