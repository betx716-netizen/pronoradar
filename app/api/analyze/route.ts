import { analyzeMatch } from "@/lib/analyze";
import { demoAnalysis } from "@/lib/demo";
import { guard, isDemo, streamTask } from "@/lib/http";
import { AnalyzeRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 300; // une analyse complète prend 1 à 4 minutes

export async function POST(req: Request) {
  const denied = await guard(req);
  if (denied) return denied;

  const parsed = AnalyzeRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Renseignez les deux équipes ou les deux joueurs." }, { status: 400 });
  }
  const input = parsed.data;
  return streamTask((progress) => (isDemo() ? demoAnalysis(input, progress) : analyzeMatch(input, progress)));
}
