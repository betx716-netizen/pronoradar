import { after } from "next/server";
import { today } from "@/lib/daily";
import { isDemo } from "@/lib/http";
import { appOrigin, kickWorker } from "@/lib/kick";
import { db, supabaseConfigured } from "@/lib/supabase";
import { getViewer } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Administrateur : efface la journée en cours (matchs, analyses et coupons du jour) et relance le moteur,
// qui refait le programme, les analyses et les coupons depuis le début.
export async function POST(req: Request) {
  const viewer = await getViewer(req);
  if (!viewer?.admin) return Response.json({ error: "Réservé à l'administrateur." }, { status: 403 });
  if (isDemo() || !supabaseConfigured()) return Response.json({ ok: true });
  const day = today();
  const m = await db().from("daily_matches").delete().eq("day", day);
  const r = await db().from("daily_runs").delete().eq("day", day);
  if (m.error || r.error) return Response.json({ error: "Impossible d'effacer la journée. Réessaie." }, { status: 502 });
  const origin = appOrigin(req);
  after(() => kickWorker(origin, true));
  return Response.json({ ok: true, day });
}
