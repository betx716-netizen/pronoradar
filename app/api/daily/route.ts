import { after } from "next/server";
import { needsKick, readDay } from "@/lib/daily";
import { isDemo } from "@/lib/http";
import { appOrigin, kickWorker } from "@/lib/kick";
import { maskProviders } from "@/lib/mask";
import { FREE_COUPONS, FREE_MATCH_TIPS } from "@/lib/plans";
import { supabaseConfigured } from "@/lib/supabase";
import { getViewer } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Coupons préparés à l'avance par l'IA et analyses des matchs qui les composent.
// Le travail est fait chaque matin par le serveur (/api/cron/daily) ; cette route ne fait que le lire.
export async function GET(req: Request) {
  if (!isDemo() && !supabaseConfigured()) {
    return Response.json({ error: "Coupons du jour indisponibles : SUPABASE_SECRET_KEY manque dans les réglages du serveur." }, { status: 503 });
  }
  try {
    const [day, viewer] = await Promise.all([readDay(), getViewer(req)]);
    const premium = viewer?.premium ?? false;
    if (needsKick(day)) after(() => kickWorker(appOrigin(req)));
    const body = {
      day: day.day,
      status: day.status,
      progress: { done: day.matches.filter((m) => m.status === "done" || m.status === "error").length, total: day.matches.length },
      premium,
      // Gratuit : le coupon le plus sûr en entier ; les autres seulement leur titre et leur cote (contenu jamais envoyé).
      coupons: day.coupons.map((c) =>
        premium || (FREE_COUPONS as readonly string[]).includes(c.profile)
          ? c
          : { ...c, legs: [], comment: "", locked: true, legsCount: c.legs.length },
      ),
      // Gratuit : les analyses des matchs du coupon offert, plus les premiers matchs du jour, dans la limite prévue.
      results: (() => {
        const done = day.matches.filter((m) => m.status === "done" && m.result);
        if (premium) return done.map((m) => ({ id: m.id, fixture: m.fixture, result: m.result! }));
        const free = new Set(day.coupons.filter((c) => (FREE_COUPONS as readonly string[]).includes(c.profile)).flatMap((c) => c.legs.map((l) => l.matchId)));
        for (const m of done) {
          if (free.size >= FREE_MATCH_TIPS) break;
          free.add(m.id);
        }
        return done.filter((m) => free.has(m.id)).map((m) => ({ id: m.id, fixture: m.fixture, result: m.result! }));
      })(),
      total: day.matches.filter((m) => m.status === "done").length,
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
