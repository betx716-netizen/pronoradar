import { analyzeMatch } from "@/lib/analyze";
import { demoAnalysis } from "@/lib/demo";
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
      return await (isDemo() ? demoAnalysis(input, progress) : analyzeMatch(input, progress));
    } catch (e) {
      if (free) await refundFreeAnalysis(viewer).catch(() => {});
      throw e;
    }
  });
}
