import { readDay } from "@/lib/daily";
import { maskedJson } from "@/lib/mask";
import { getViewer, premiumRequired } from "@/lib/user";
import { canOpenMatch } from "@/lib/view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Analyse complète d'un match du jour : Premium, ou un des matchs offerts aux visiteurs gratuits.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const [day, viewer] = await Promise.all([readDay(), getViewer(req)]);
  const match = day.matches.find((m) => m.id === id);
  if (!match?.result) return Response.json({ error: "Analyse introuvable." }, { status: 404 });
  if (!canOpenMatch(day, id, viewer?.premium ?? false)) return premiumRequired();
  // Les noms des services utilisés restent masqués, comme dans le reste de l'application.
  return maskedJson({ result: match.result });
}
