import { SLUGS, fetchLiveScores, fetchWorldLive } from "@/lib/espn";

export const runtime = "nodejs";

// Scores en direct des championnats demandés (gratuit, sans crédit). Le serveur garde la réponse 30 secondes.
export async function GET(req: Request) {
  const leagues = (new URL(req.url).searchParams.get("leagues") ?? "")
    .split(",")
    .map((l) => l.trim())
    .filter((l) => l in SLUGS)
    .slice(0, 12);
  const world = new URL(req.url).searchParams.get("world") === "1";
  const all = await Promise.all(leagues.map((l) => fetchLiveScores(l).catch(() => [])));
  const mine = all.flat();
  // Avec ?world=1 : on ajoute les matchs en cours dans tous les autres championnats suivis.
  const others = world ? (await fetchWorldLive()).filter((m) => !mine.some((x) => x.id === m.id)) : [];
  return Response.json({ matches: mine, world: others }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30" } });
}
