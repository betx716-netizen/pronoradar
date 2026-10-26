import { after } from "next/server";
import { runWorker } from "@/lib/daily";
import { readKey } from "@/lib/env";
import { isDemo } from "@/lib/http";
import { appOrigin, kickWorker } from "@/lib/kick";
import { supabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Appelée par le cron Vercel chaque matin (avec CRON_SECRET), puis par elle-même tant qu'il reste des matchs.
// Répond immédiatement et travaille en arrière-plan pendant près de 5 minutes.
export function GET(req: Request) {
  const secret = readKey("CRON_SECRET");
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Accès refusé." }, { status: 401 });
  }
  if (isDemo() || !supabaseConfigured()) return Response.json({ skipped: true });

  const started = Date.now();
  const origin = appOrigin(req);
  after(async () => {
    try {
      const { more } = await runWorker(started + 285_000);
      if (more) await kickWorker(origin, true);
    } catch (e) {
      console.error("Moteur quotidien :", e);
    }
  });
  return Response.json({ started: true }, { status: 202 });
}
