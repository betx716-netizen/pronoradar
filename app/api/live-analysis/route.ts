import { guard, isDemo, streamTask } from "@/lib/http";
import { getViewer, premiumRequired, unauthorized } from "@/lib/user";
import { LiveAnalysisRequestSchema, analyzeLive, demoLiveAnalysis } from "@/lib/liveAnalysis";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const denied = guard(req);
  if (denied) return denied;
  // L'analyse en direct appelle l'IA à chaque demande : réservée aux membres Premium.
  const viewer = await getViewer(req);
  if (!viewer) return unauthorized();
  if (!viewer.premium) return premiumRequired();
  const parsed = LiveAnalysisRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Match invalide." }, { status: 400 });
  return streamTask((progress) => (isDemo() ? Promise.resolve(demoLiveAnalysis(parsed.data)) : analyzeLive(parsed.data, progress)));
}
