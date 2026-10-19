import { SLUGS, fetchLiveScores } from "@/lib/espn";

export const runtime = "nodejs";

// Scores en direct des championnats demandés (gratuit, sans crédit). Le serveur garde la réponse 30 secondes.
export async function GET(req: Request) {
  const leagues = (new URL(req.url).searchParams.get("leagues") ?? "")
    .split(",")
    .map((l) => l.trim())
    .filter((l) => l in SLUGS)
    .slice(0, 12);
  const all = await Promise.all(leagues.map((l) => fetchLiveScores(l).catch(() => [])));
  return Response.json({ matches: all.flat() }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30" } });
}
