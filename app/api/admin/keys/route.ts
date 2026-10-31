import { keySource, readKey } from "@/lib/env";
import { EDITABLE_KEYS, loadKeyOverrides, saveKeyOverrides } from "@/lib/keys";
import { getViewer } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mask = (v: string) => (v.length >= 10 ? `${v.slice(0, 6)}…${v.slice(-4)}` : v ? "••••" : "");

// Administrateur : état des clés (masquées) et remplacement depuis l'app.
export async function GET(req: Request) {
  if (!(await getViewer(req))?.admin) return Response.json({ error: "Réservé à l'administrateur." }, { status: 403 });
  await loadKeyOverrides(true);
  return Response.json(Object.fromEntries(EDITABLE_KEYS.map((k) => [k, { source: keySource(k), apercu: mask(readKey(k)) }])));
}

export async function POST(req: Request) {
  if (!(await getViewer(req))?.admin) return Response.json({ error: "Réservé à l'administrateur." }, { status: 403 });
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, string>;
  try {
    await saveKeyOverrides(Object.fromEntries(EDITABLE_KEYS.filter((k) => typeof body[k] === "string").map((k) => [k, body[k]])));
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Impossible d'enregistrer les clés." }, { status: 502 });
  }
}
