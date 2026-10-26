import { after } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { needsKick, readDay } from "@/lib/daily";
import { isDemo } from "@/lib/http";
import { appOrigin, kickWorker } from "@/lib/kick";
import { maskProviders } from "@/lib/mask";
import { supabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Coupons préparés à l'avance par l'IA et analyses des matchs qui les composent.
// Le travail est fait chaque matin par le serveur (/api/cron/daily) ; cette route ne fait que le lire.
export async function GET(req: Request) {
  if (!isAuthorized(req)) return Response.json({ error: "Connexion requise." }, { status: 401 });
  if (!isDemo() && !supabaseConfigured()) {
    return Response.json({ error: "Coupons du jour indisponibles : SUPABASE_SECRET_KEY manque dans les réglages du serveur." }, { status: 503 });
  }
  try {
    const day = await readDay();
    if (needsKick(day)) after(() => kickWorker(appOrigin(req)));
    const body = {
      day: day.day,
      status: day.status,
      progress: { done: day.matches.filter((m) => m.status === "done" || m.status === "error").length, total: day.matches.length },
      coupons: day.coupons,
      results: day.matches.flatMap((m) => (m.status === "done" && m.result ? [{ id: m.id, fixture: m.fixture, result: m.result }] : [])),
    };
    // Les noms des services utilisés restent masqués, comme dans le reste de l'application.
    return new Response(JSON.stringify(body, (k, v) => (typeof v === "string" && k !== "url" ? maskProviders(v) : v)), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Impossible de charger les coupons du jour." }, { status: 502 });
  }
}
