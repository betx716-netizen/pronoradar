import { notifyAdmin } from "@/lib/notify";
import { getViewer } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Administrateur : envoie une notification de test et dit pourquoi elle ne part pas, le cas échéant.
export async function POST(req: Request) {
  const viewer = await getViewer(req);
  if (!viewer?.admin) return Response.json({ error: "Réservé à l'administrateur." }, { status: 403 });
  const r = await notifyAdmin("Test PronoRadar", "Les notifications fonctionnent : tu seras prévenu des inscriptions et des paiements.", { tags: "white_check_mark" });
  return Response.json(r);
}
