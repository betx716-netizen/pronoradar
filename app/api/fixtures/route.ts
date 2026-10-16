import { demoFixtures } from "@/lib/demo";
import { findFixtures } from "@/lib/fixtures";
import { guard, isDemo, streamTask } from "@/lib/http";
import { FixturesRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const denied = guard(req);
  if (denied) return denied;

  const parsed = FixturesRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Indiquez une compétition." }, { status: 400 });
  }
  const { sport, competition } = parsed.data;
  return streamTask(async (progress) =>
    isDemo() ? { fixtures: await demoFixtures(sport, progress) } : findFixtures(sport, competition, progress),
  );
}
