import { getMaintenance, setMaintenance } from "@/lib/maintenance";
import { getViewer } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// État des travaux (public) ; indique aussi si le visiteur est administrateur, lui seul passant outre.
export async function GET(req: Request) {
  const [m, viewer] = await Promise.all([getMaintenance(), getViewer(req).catch(() => null)]);
  return Response.json({ ...m, admin: viewer?.admin ?? false }, { headers: { "Cache-Control": "no-store" } });
}

// Administrateur : active ou désactive les travaux.
export async function POST(req: Request) {
  const viewer = await getViewer(req);
  if (!viewer?.admin) return Response.json({ error: "Réservé à l'administrateur." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { on?: boolean; message?: string } | null;
  try {
    await setMaintenance({ on: body?.on === true, message: String(body?.message ?? "") });
    return Response.json({ ok: true, ...(await getMaintenance()) });
  } catch {
    return Response.json({ error: "Impossible d'enregistrer. Réessaie." }, { status: 502 });
  }
}
