// Identifie l'utilisateur d'une requête à partir du jeton de session Supabase (en-tête Authorization)
// et calcule son offre. En mode démo, un faux compte en mémoire permet de tester tout le parcours.
import { isDemo } from "./http";
import { normalizePhone, phoneLogin } from "./phone";
import { db, supabaseConfigured } from "./supabase";

export type Viewer = {
  id: string;
  email: string;
  premium: boolean;
  premiumUntil: string | null;
  admin: boolean;
};

// Stockage du mode démo, partagé entre les requêtes d'un même serveur.
export type DemoPayment = { user: string; days: number; status: string; plan?: string; amount?: number; method?: string; reference?: string; payerPhone?: string; createdAt?: string };
type DemoStore = { premium: Map<string, string>; bets: Map<string, unknown[]>; payments: Map<string, DemoPayment>; users: Map<string, string> };
const g = globalThis as unknown as { __prDemo?: DemoStore };
export const demoStore = (): DemoStore => (g.__prDemo ??= { premium: new Map(), bets: new Map(), payments: new Map(), users: new Map() });

// Administrateurs : numéros listés dans ADMIN_PHONES (et emails dans ADMIN_EMAILS, pour d'anciens comptes).
const admins = () => [
  ...(process.env.ADMIN_PHONES ?? "").split(",").flatMap((p) => {
    const n = normalizePhone(p);
    return n ? [phoneLogin(n)] : [];
  }),
  ...(process.env.ADMIN_EMAILS ?? "").toLowerCase().split(",").map((e) => e.trim()).filter(Boolean),
];

const bearer = (req: Request) => req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;

export async function getViewer(req: Request): Promise<Viewer | null> {
  const token = bearer(req);
  if (!token) return null;

  if (isDemo()) {
    if (!token.startsWith("demo:")) return null;
    const email = token.slice(5).toLowerCase();
    const until = demoStore().premium.get(email) ?? null;
    const admin = admins().includes(email);
    return { id: `demo-${email}`, email, premium: admin || Boolean(until && until > new Date().toISOString()), premiumUntil: until, admin };
  }

  if (!supabaseConfigured()) return null;
  const { data, error } = await db().auth.getUser(token);
  if (error || !data.user) return null;
  const email = (data.user.email ?? "").toLowerCase();
  const { data: profile } = await db().from("profiles").select("premium_until").eq("id", data.user.id).maybeSingle();
  if (!profile) await db().from("profiles").upsert({ id: data.user.id, email }, { onConflict: "id", ignoreDuplicates: true });
  const until: string | null = profile?.premium_until ?? null;
  const admin = admins().includes(email);
  return {
    id: data.user.id,
    email,
    premium: admin || Boolean(until && new Date(until).getTime() > Date.now()),
    premiumUntil: until,
    admin,
  };
}

export const unauthorized = () => Response.json({ error: "Connecte-toi pour continuer." }, { status: 401 });
export const premiumRequired = () => Response.json({ error: "Réservé aux membres Premium.", code: "premium" }, { status: 402 });
