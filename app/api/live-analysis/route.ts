import { guard, isDemo, streamTask } from "@/lib/http";
import { LiveAnalysisRequestSchema, analyzeLive, demoLiveAnalysis } from "@/lib/liveAnalysis";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const denied = guard(req);
  if (denied) return denied;
  const parsed = LiveAnalysisRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Match invalide." }, { status: 400 });
  return streamTask((progress) => (isDemo() ? Promise.resolve(demoLiveAnalysis(parsed.data)) : analyzeLive(parsed.data, progress)));
}
