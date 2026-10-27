import { DeleteError, deleteAccountById } from "@/lib/accountDelete";
import { isDemo } from "@/lib/http";
import { db, supabaseConfigured } from "@/lib/supabase";
import { demoStore, getViewer, unauthorized } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Compte connecté : offre en cours et derniers paiements.
export async function GET(req: Request) {
  const viewer = await getViewer(req);
  if (!viewer) return unauthorized();
  let payments: unknown[] = [];
  if (isDemo()) {
    payments = [...demoStore().payments.entries()]
      .filter(([, p]) => p.user === viewer.email && p.plan)
      .map(([id, p]) => ({ id, plan: p.plan, amount: p.amount, status: p.status, method: p.method, created_at: p.createdAt }))
      .reverse();
  } else if (supabaseConfigured()) {
    const { data } = await db()
      .from("payments")
      .select("id, plan, amount, status, method, created_at, paid_at")
      .eq("user_id", viewer.id)
      .order("created_at", { ascending: false })
      .limit(10);
    payments = data ?? [];
  }
  return Response.json({ email: viewer.email, premium: viewer.premium, premiumUntil: viewer.premiumUntil, admin: viewer.admin, payments });
}

// Suppression de son propre compte (définitive), demandée depuis Mon compte.
export async function DELETE(req: Request) {
  const viewer = await getViewer(req);
  if (!viewer) return unauthorized();
  if (viewer.admin) return Response.json({ error: "Le compte administrateur ne peut pas être supprimé depuis l'application." }, { status: 403 });
  try {
    if (isDemo()) {
      const phone = viewer.email.match(/^225(\d{10})@/)?.[1];
      if (phone) demoStore().users.delete(phone);
    } else await deleteAccountById(viewer.id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Erreur." }, { status: e instanceof DeleteError ? e.status : 500 });
  }
}
