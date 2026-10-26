import { analyzeMatch } from "@/lib/analyze";
import { demoAnalysis } from "@/lib/demo";
import { sameTeam } from "@/lib/espn";
import { findFixtures } from "@/lib/fixtures";
import { guardOpen, isDemo, streamTask } from "@/lib/http";
import { AnalyzeRequestSchema } from "@/lib/schemas";
import { getViewer, refundFreeAnalysis, unauthorized, useFreeAnalysis } from "@/lib/user";

export const runtime = "nodejs";
export const maxDuration = 300; // une analyse complète prend 1 à 4 minutes

// Premium : analyses illimitées. Compte gratuit : 1 analyse par jour (rendue si elle échoue).
export async function POST(req: Request) {
  const nc = guardOpen(req);
  if (nc) return nc;
  const viewer = await getViewer(req);
  if (!viewer) return unauthorized();

  const parsed = AnalyzeRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Renseignez les deux équipes ou les deux joueurs." }, { status: 400 });
  }
  const input = parsed.data;

  const free = !viewer.premium;
  if (free && !(await useFreeAnalysis(viewer))) {
    return Response.json(
      { error: "Tu as déjà utilisé ton analyse gratuite du jour. Passe en Premium pour en lancer autant que tu veux.", code: "premium" },
      { status: 402 },
    );
  }
  return streamTask(async (progress) => {
    try {
      // Match venu du programme gratuit (sans cotes) : on récupère ses cotes et son identifiant maintenant (mis en cache 2 h).
      if (!isDemo() && input.sport === "football" && (!input.odds || input.odds.bookmakers <= 1) && input.competition) {
        try {
          progress("Récupération des cotes…");
          const { fixtures } = await findFixtures(input.sport, input.competition, () => {});
          const hit = fixtures.find((f) => sameTeam(f.home, input.home) && sameTeam(f.away, input.away));
          if (hit) {
            input.odds = hit.odds && hit.odds.bookmakers >= (input.odds?.bookmakers ?? 0) ? hit.odds : input.odds;
            input.apiFootballId = input.apiFootballId ?? hit.apiFootballId;
          }
        } catch {
          // Sans cotes, l'analyse se fait quand même.
        }
      }
      return await (isDemo() ? demoAnalysis(input, progress) : analyzeMatch(input, progress));
    } catch (e) {
      if (free) await refundFreeAnalysis(viewer).catch(() => {});
      throw e;
    }
  });
}
