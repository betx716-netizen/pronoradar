import { isDemo } from "@/lib/http";
import { db } from "@/lib/supabase";
import { demoStore, getViewer } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Validation des paiements manuels par l'administrateur (emails listés dans ADMIN_EMAILS).
export type AdminPayment = {
  id: string;
  email: string | null;
  plan: string;
  amount: number;
  method: string | null;
  reference: string | null;
  payer_phone: string | null;
  status: string;
  created_at: string;
};

const forbidden = () => Response.json({ error: "Réservé à l'administrateur." }, { status: 403 });

export async function GET(req: Request) {
  const viewer = await getViewer(req);
  if (!viewer?.admin) return forbidden();
  if (isDemo()) {
    const list: AdminPayment[] = [...demoStore().payments.entries()]
      .filter(([, p]) => p.reference)
      .map(([id, p]) => ({ id, email: p.user, plan: p.plan ?? "", amount: p.amount ?? 0, method: p.method ?? null, reference: p.reference ?? null, payer_phone: p.payerPhone ?? null, status: p.status, created_at: p.createdAt ?? "" }))
      .reverse();
    return Response.json({ payments: list });
  }
  const { data, error } = await db()
    .from("payments")
    .select("id, user_id, plan, amount, method, reference, payer_phone, status, created_at")
    .not("reference", "is", null)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) return Response.json({ error: error.message }, { status: 502 });
  const ids = [...new Set((data ?? []).map((p) => p.user_id))];
  const { data: profiles } = ids.length ? await db().from("profiles").select("id, email").in("id", ids) : { data: [] };
  const emails = new Map((profiles ?? []).map((p) => [p.id, p.email]));
  return Response.json({ payments: (data ?? []).map(({ user_id, ...p }) => ({ ...p, email: emails.get(user_id) ?? null })) });
}

export async function POST(req: Request) {
  const viewer = await getViewer(req);
  if (!viewer?.admin) return forbidden();
  const body = (await req.json().catch(() => null)) as { id?: string; action?: "approve" | "reject" } | null;
  const id = body?.id ?? "";
  if (!id || (body?.action !== "approve" && body?.action !== "reject")) return Response.json({ error: "Demande invalide." }, { status: 400 });

  if (isDemo()) {
    const s = demoStore();
    const p = s.payments.get(id);
    if (!p) return Response.json({ error: "Paiement introuvable." }, { status: 404 });
    if (body.action === "approve" && p.status !== "accepted") {
      const current = s.premium.get(p.user);
      const from = current && current > new Date().toISOString() ? new Date(current).getTime() : Date.now();
      s.premium.set(p.user, new Date(from + p.days * 86400_000).toISOString());
      p.status = "accepted";
    } else if (body.action === "reject" && p.status === "review") p.status = "refused";
    return Response.json({ ok: true, status: p.status });
  }

  if (body.action === "approve") {
    // activate_payment ne compte un paiement qu'une fois, même si on clique deux fois.
    const { data: until, error } = await db().rpc("activate_payment", { p_id: id, p_method: null, p_details: { validated_by: viewer.email } });
    if (error) return Response.json({ error: error.message }, { status: 502 });
    return Response.json({ ok: true, status: "accepted", premiumUntil: until });
  }
  await db().from("payments").update({ status: "refused", details: { refused_by: viewer.email } }).eq("id", id).eq("status", "review");
  return Response.json({ ok: true, status: "refused" });
}
