import { SLUGS } from "@/lib/espn";

export const runtime = "nodejs";

// Logo officiel d'un championnat, lu dans l'annuaire public d'ESPN. Mis en cache 30 jours.
export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name") ?? "";
  const slug = SLUGS[name];
  let url: string | null = null;
  if (slug) {
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard`, { next: { revalidate: 2592000 } });
      const data = res.ok ? await res.json() : null;
      const logos: { href?: string; rel?: string[] }[] = data?.leagues?.[0]?.logos ?? [];
      // Version pour fond clair de préférence (« default »), sinon la première.
      url = (logos.find((l) => l.rel?.includes("default")) ?? logos[0])?.href ?? null;
    } catch {}
  }
  return Response.json({ url }, { headers: { "Cache-Control": url ? "public, s-maxage=2592000" : "public, s-maxage=3600" } });
}
