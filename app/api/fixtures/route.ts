import { demoFixtures } from "@/lib/demo";
import { findFixtures } from "@/lib/fixtures";
import { guardOpen, isDemo, streamTask } from "@/lib/http";
import { FixturesRequestSchema } from "@/lib/schemas";
import { getViewer, unauthorized } from "@/lib/user";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const denied = guardOpen(req);
  if (denied) return denied;
  // Peut consommer les quotas de cotes et la recherche Google : réservé aux comptes connectés.
  if (!isDemo() && !(await getViewer(req))) return unauthorized();

  const parsed = FixturesRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Indiquez une compétition." }, { status: 400 });
  }
  const { sport, competition } = parsed.data;
  return streamTask(async (progress) =>
    isDemo() ? { fixtures: await demoFixtures(sport, competition, progress), notes: [] } : findFixtures(sport, competition, progress),
  );
}
