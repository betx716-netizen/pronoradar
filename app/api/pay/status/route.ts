import { cinetpayConfigured, settlePayment } from "@/lib/cinetpay";
import { isDemo } from "@/lib/http";
import { db } from "@/lib/supabase";
import { demoStore, getViewer, unauthorized } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// État d'un paiement de l'utilisateur, vérifié auprès de CinetPay s'il est encore en attente.
export async function GET(req: Request) {
  const viewer = await getViewer(req);
  if (!viewer) return unauthorized();
  const id = new URL(req.url).searchParams.get("id") ?? "";

  if (isDemo()) {
    const pay = demoStore().payments.get(id);
    if (!pay || pay.user !== viewer.email) return Response.json({ status: "unknown" });
    return Response.json({ status: pay.status, premiumUntil: demoStore().premium.get(viewer.email) ?? null });
  }
  if (!cinetpayConfigured()) return Response.json({ status: "unknown" });
  const { data: pay } = await db().from("payments").select("user_id").eq("id", id).maybeSingle();
  if (!pay || pay.user_id !== viewer.id) return Response.json({ status: "unknown" });
  try {
    return Response.json(await settlePayment(id));
  } catch (e) {
    console.error(e);
    return Response.json({ status: "pending" });
  }
}
