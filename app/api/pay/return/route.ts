import { isDemo } from "@/lib/http";
import { appOrigin } from "@/lib/kick";
import { demoStore } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Retour du guichet CinetPay (en GET ou en POST) : renvoie vers l'application, qui vérifie le paiement.
async function handle(req: Request) {
  const url = new URL(req.url);
  let id = url.searchParams.get("id") ?? "";
  if (!id && req.method === "POST") {
    const form = await req.formData().catch(() => null);
    id = String(form?.get("transaction_id") ?? form?.get("cpm_trans_id") ?? "");
  }
  id = /^PR[A-Z0-9]+$/.test(id) ? id : "";

  if (isDemo() && id) {
    const s = demoStore();
    const pay = s.payments.get(id);
    if (pay && pay.status === "pending") {
      const current = s.premium.get(pay.user);
      const from = current && current > new Date().toISOString() ? new Date(current).getTime() : Date.now();
      s.premium.set(pay.user, new Date(from + pay.days * 86400_000).toISOString());
      pay.status = "accepted";
    }
  }
  return Response.redirect(`${appOrigin(req)}/?paiement=${id}`, 303);
}

export const GET = handle;
export const POST = handle;
