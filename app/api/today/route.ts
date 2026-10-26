import { after } from "next/server";
import { needsKick, readDay } from "@/lib/daily";
import { isDemo } from "@/lib/http";
import { maskedJson } from "@/lib/mask";
import { appOrigin, kickWorker } from "@/lib/kick";
import { supabaseConfigured } from "@/lib/supabase";
import { getViewer } from "@/lib/user";
import { buildView } from "@/lib/view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Coupons et matchs du jour, filtrés selon l'offre du visiteur.
export async function GET(req: Request) {
  if (!isDemo() && !supabaseConfigured()) {
    return Response.json({ error: "Service en cours de configuration. Revenez dans quelques minutes." }, { status: 503 });
  }
  try {
    const [day, viewer] = await Promise.all([readDay(), getViewer(req)]);
    if (needsKick(day)) after(() => kickWorker(appOrigin(req)));
    return maskedJson(
      buildView(day, {
        signedIn: Boolean(viewer),
        email: viewer?.email ?? null,
        premium: viewer?.premium ?? false,
        premiumUntil: viewer?.premiumUntil ?? null,
      }),
    );
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Impossible de charger les pronostics du jour." }, { status: 502 });
  }
}
