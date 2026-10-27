import { isDemo } from "@/lib/http";
import { db, supabaseConfigured } from "@/lib/supabase";
import { getViewer, unauthorized } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rattache un nouveau compte à son parrain (code reçu dans le lien ?ref=…). Le parrain est récompensé
// plus tard, au premier paiement validé du filleul (voir activate_payment dans la base).
export async function POST(req: Request) {
  const viewer = await getViewer(req);
  if (!viewer) return unauthorized();
  const code = String(((await req.json().catch(() => null)) as { code?: string } | null)?.code ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(code)) return Response.json({ error: "Code invalide." }, { status: 400 });
  if (isDemo() || !supabaseConfigured()) return Response.json({ ok: true });

  const [{ data: me }, { data: parrain }, { count: paid }] = await Promise.all([
    db().from("profiles").select("id, referred_by, created_at, ref_code").eq("id", viewer.id).maybeSingle(),
    db().from("profiles").select("id").eq("ref_code", code).maybeSingle(),
    db().from("payments").select("id", { count: "exact", head: true }).eq("user_id", viewer.id).eq("status", "accepted"),
  ]);
  if (!parrain || parrain.id === viewer.id) return Response.json({ error: "Code de parrainage inconnu." }, { status: 404 });
  // Seulement pour un compte nouveau, pas encore parrainé et qui n'a encore jamais payé.
  const fresh = !me?.created_at || Date.now() - new Date(me.created_at).getTime() < 7 * 86400000;
  if (me?.referred_by || !fresh || (paid ?? 0) > 0) return Response.json({ ok: true, ignored: true });
  await db().from("profiles").update({ referred_by: parrain.id }).eq("id", viewer.id).is("referred_by", null);
  return Response.json({ ok: true });
}
