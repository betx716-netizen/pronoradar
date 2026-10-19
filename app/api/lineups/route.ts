import { fetchOfficialLineups } from "@/lib/espn";

export const runtime = "nodejs";

// Compositions officielles d'un match (publiées environ une heure avant), rafraîchies toutes les 10 minutes.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  try {
    const lineups = await fetchOfficialLineups(q.get("competition") ?? "", q.get("home") ?? "", q.get("away") ?? "", q.get("date"));
    return Response.json({ lineups }, { headers: { "Cache-Control": "public, s-maxage=600" } });
  } catch {
    return Response.json({ lineups: null });
  }
}
