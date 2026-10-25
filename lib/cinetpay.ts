// Paiement des abonnements avec CinetPay (Orange Money, MTN, Moov, Wave, cartes).
// Règle de sécurité : on ne croit jamais la notification ni le retour du navigateur. Seule la réponse de
// l'API de vérification de CinetPay active l'abonnement.
import { randomBytes } from "node:crypto";
import { readKey } from "./env";
import type { Plan } from "./plans";
import { db } from "./supabase";

const API = "https://api-checkout.cinetpay.com/v2";

export const cinetpayConfigured = () => Boolean(readKey("CINETPAY_API_KEY") && readKey("CINETPAY_SITE_ID"));

export class PaymentError extends Error {}

/** Identifiant de transaction unique, sans caractère spécial (exigence CinetPay). */
export const newTransactionId = () => `PR${Date.now().toString(36).toUpperCase()}${randomBytes(4).toString("hex").toUpperCase()}`;

export async function createPayment(opts: { userId: string; email: string; plan: Plan; origin: string }) {
  const id = newTransactionId();
  const { error } = await db().from("payments").insert({ id, user_id: opts.userId, plan: opts.plan.id, amount: opts.plan.price, days: opts.plan.days });
  if (error) throw new PaymentError("Impossible d'enregistrer le paiement. Réessaie.");

  const res = await fetch(`${API}/payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: readKey("CINETPAY_API_KEY"),
      site_id: readKey("CINETPAY_SITE_ID"),
      transaction_id: id,
      amount: opts.plan.price,
      currency: "XOF",
      description: `PronoRadar Premium ${opts.plan.label}`,
      notify_url: `${opts.origin}/api/pay/notify`,
      return_url: `${opts.origin}/api/pay/return?id=${id}`,
      channels: "ALL",
      lang: "fr",
      metadata: opts.userId,
      customer_id: opts.userId,
      customer_email: opts.email,
      customer_name: "Client",
      customer_surname: "PronoRadar",
      customer_address: "Abidjan",
      customer_city: "Abidjan",
      customer_country: "CI",
      customer_zip_code: "00225",
    }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as { code?: string; description?: string; data?: { payment_url?: string } } | null;
  if (data?.code !== "201" || !data.data?.payment_url) {
    await db().from("payments").update({ status: "refused", details: data }).eq("id", id);
    console.error("CinetPay init :", data);
    throw new PaymentError(data?.description ? `Paiement refusé par CinetPay : ${data.description}` : "CinetPay est injoignable pour le moment. Réessaie.");
  }
  return { id, url: data.data.payment_url };
}

type CheckResult = { status: "accepted" | "refused" | "pending"; method: string | null; raw: unknown };

async function checkTransaction(id: string): Promise<CheckResult> {
  const res = await fetch(`${API}/payment/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: readKey("CINETPAY_API_KEY"), site_id: readKey("CINETPAY_SITE_ID"), transaction_id: id }),
    cache: "no-store",
  });
  const raw = (await res.json().catch(() => null)) as { data?: { status?: string; payment_method?: string; amount?: string } } | null;
  const s = raw?.data?.status;
  return { status: s === "ACCEPTED" ? "accepted" : s === "REFUSED" ? "refused" : "pending", method: raw?.data?.payment_method ?? null, raw };
}

/** Vérifie une transaction auprès de CinetPay et active l'abonnement si elle est acceptée. */
export async function settlePayment(id: string): Promise<{ status: string; premiumUntil: string | null }> {
  const { data: pay } = await db().from("payments").select("id, status, amount, user_id").eq("id", id).maybeSingle();
  if (!pay) return { status: "unknown", premiumUntil: null };
  if (pay.status === "accepted") {
    const { data: p } = await db().from("profiles").select("premium_until").eq("id", pay.user_id).maybeSingle();
    return { status: "accepted", premiumUntil: p?.premium_until ?? null };
  }
  const check = await checkTransaction(id);
  if (check.status === "accepted") {
    const paid = Number((check.raw as { data?: { amount?: string } })?.data?.amount ?? NaN);
    // Montant payé inférieur au prix de l'offre : on n'active pas.
    if (Number.isFinite(paid) && paid < pay.amount) {
      await db().from("payments").update({ status: "refused", details: check.raw }).eq("id", id);
      return { status: "refused", premiumUntil: null };
    }
    const { data: until } = await db().rpc("activate_payment", { p_id: id, p_method: check.method, p_details: check.raw });
    return { status: "accepted", premiumUntil: (until as string | null) ?? null };
  }
  if (check.status === "refused") {
    await db().from("payments").update({ status: "refused", details: check.raw }).eq("id", id).eq("status", "pending");
    return { status: "refused", premiumUntil: null };
  }
  return { status: "pending", premiumUntil: null };
}
