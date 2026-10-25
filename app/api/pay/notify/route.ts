import { cinetpayConfigured, settlePayment } from "@/lib/cinetpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// CinetPay vérifie d'abord que l'adresse répond (GET), puis envoie la notification (POST, formulaire).
export function GET() {
  return new Response("OK");
}

export async function POST(req: Request) {
  if (!cinetpayConfigured()) return new Response("OK");
  const form = await req.formData().catch(() => null);
  const id = String(form?.get("cpm_trans_id") ?? "");
  // La notification ne sert qu'à déclencher la vérification : le statut vient de l'API CinetPay.
  if (/^PR[A-Z0-9]+$/.test(id)) {
    try {
      await settlePayment(id);
    } catch (e) {
      console.error("Notification CinetPay :", e);
    }
  }
  return new Response("OK");
}
