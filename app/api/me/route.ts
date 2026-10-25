import { isDemo } from "@/lib/http";
import { db, supabaseConfigured } from "@/lib/supabase";
import { getViewer, unauthorized } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Compte connecté : offre en cours et derniers paiements.
export async function GET(req: Request) {
  const viewer = await getViewer(req);
  if (!viewer) return unauthorized();
  let payments: unknown[] = [];
  if (!isDemo() && supabaseConfigured()) {
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
