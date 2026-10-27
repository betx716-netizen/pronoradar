import { HISTORY_RESET } from "@/lib/resets";
import { isDemo } from "@/lib/http";
import { db, supabaseConfigured } from "@/lib/supabase";
import { demoStore, getViewer, unauthorized } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Suivi des paris de chaque utilisateur, enregistré sur son compte.
type Bet = { id: string; createdAt?: string };
const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(req: Request) {
  const viewer = await getViewer(req);
  if (!viewer) return unauthorized();
  if (isDemo()) return Response.json({ bets: demoStore().bets.get(viewer.id) ?? [] });
  if (!supabaseConfigured()) return Response.json({ bets: [] });
  const { data, error } = await db().from("user_bets").select("data").eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(500);
  if (error) return Response.json({ error: "Sauvegarde injoignable." }, { status: 502 });
  return Response.json({ bets: (data ?? []).map((r) => r.data) });
}

export async function POST(req: Request) {
  const viewer = await getViewer(req);
  if (!viewer) return unauthorized();
  const body = (await req.json().catch(() => null)) as { bets?: Bet[] } | null;
  // Les coupons d'avant la remise à zéro du Suivi (restés sur un vieil appareil) ne sont plus acceptés.
  const bets = (body?.bets ?? [])
    .filter((b) => typeof b?.id === "string" && UUID.test(b.id) && (b.createdAt ?? "9") >= HISTORY_RESET)
    .slice(0, 200);
  if (isDemo()) {
    const list = (demoStore().bets.get(viewer.id) ?? []) as Bet[];
    const ids = new Set(bets.map((b) => b.id));
    demoStore().bets.set(viewer.id, [...bets, ...list.filter((b) => !ids.has(b.id))]);
    return Response.json({ ok: true });
  }
  if (!bets.length) return Response.json({ ok: true });
  // Un id déjà utilisé par un autre compte est refusé par la contrainte : on ne touche qu'à ses propres paris.
  const { data: taken } = await db().from("user_bets").select("id").in("id", bets.map((b) => b.id)).neq("user_id", viewer.id);
  const blocked = new Set((taken ?? []).map((r) => r.id));
  const rows = bets
    .filter((b) => !blocked.has(b.id))
    .map((b) => ({ id: b.id, user_id: viewer.id, created_at: b.createdAt ?? new Date().toISOString(), data: b }));
  const { error } = await db().from("user_bets").upsert(rows, { onConflict: "id" });
  if (error) return Response.json({ error: "Sauvegarde injoignable." }, { status: 502 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const viewer = await getViewer(req);
  if (!viewer) return unauthorized();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (isDemo()) {
    demoStore().bets.set(viewer.id, ((demoStore().bets.get(viewer.id) ?? []) as Bet[]).filter((b) => b.id !== id));
    return Response.json({ ok: true });
  }
  await db().from("user_bets").delete().eq("id", id).eq("user_id", viewer.id);
  return Response.json({ ok: true });
}
