import { authRequired, checkCredentials, clearSession, createSession, isAuthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// État de connexion de cet appareil.
export function GET(req: Request) {
  return Response.json({ required: authRequired(), authenticated: isAuthorized(req) });
}

// Connexion.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { username?: string; password?: string } | null;
  if (!authRequired()) return Response.json({ ok: true });
  if (!checkCredentials(String(body?.username ?? ""), String(body?.password ?? ""))) {
    await wait(800); // ralentit les essais au hasard
    return Response.json({ error: "Identifiant ou mot de passe incorrect." }, { status: 401 });
  }
  return Response.json({ ok: true }, { headers: { "Set-Cookie": createSession() } });
}

// Déconnexion.
export function DELETE() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSession() } });
}
