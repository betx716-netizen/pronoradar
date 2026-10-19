import { readKey } from "@/lib/env";

export const dynamic = "force-dynamic";

// Historique des paris dans Supabase. La base n'accepte que les appels portant HISTORY_SECRET,
// qui ne quitte jamais le serveur ; le navigateur passe par cette route, protégée par APP_PASSWORD.
const config = () => ({ url: readKey("SUPABASE_URL"), key: readKey("SUPABASE_KEY"), secret: readKey("HISTORY_SECRET") });

function denied(req: Request): Response | null {
  const expected = process.env.APP_PASSWORD;
  if (expected && req.headers.get("x-app-password") !== expected) return Response.json({ error: "Mot de passe incorrect." }, { status: 401 });
  const c = config();
  if (!c.url || !c.key || !c.secret) return Response.json({ error: "Supabase n'est pas configuré." }, { status: 503 });
  return null;
}

async function rpc(fn: string, args: Record<string, unknown>) {
  const c = config();
  const res = await fetch(`${c.url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: c.key, Authorization: `Bearer ${c.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ secret: c.secret, ...args }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} : ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const fail = (err: unknown) => {
  console.error(err);
  return Response.json({ error: "Impossible de joindre Supabase." }, { status: 502 });
};

export async function GET(req: Request) {
  const d = denied(req);
  if (d) return d;
  try {
    return Response.json({ bets: (await rpc("history_list", {})) ?? [] });
  } catch (err) {
    return fail(err);
  }
}

// Enregistre ou met à jour un ou plusieurs coupons.
export async function POST(req: Request) {
  const d = denied(req);
  if (d) return d;
  const body = (await req.json().catch(() => null)) as { bets?: { id?: string }[] } | null;
  const bets = (body?.bets ?? []).filter((b) => typeof b?.id === "string").slice(0, 500);
  try {
    for (const bet of bets) await rpc("history_upsert", { bet });
    return Response.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: Request) {
  const d = denied(req);
  if (d) return d;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id manquant" }, { status: 400 });
  try {
    await rpc("history_delete", { bet_id: id });
    return Response.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
