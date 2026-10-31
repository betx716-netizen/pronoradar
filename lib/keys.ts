// Clés des services (Gemini, Tavily, Groq) remplaçables par l'administrateur depuis l'app, sans passer par Vercel :
// elles sont gardées dans la base (table app_settings, lisible seulement par le serveur) et priment sur Vercel.
import { setKeyOverrides } from "./env";
import { db, supabaseConfigured } from "./supabase";

export const EDITABLE_KEYS = ["GEMINI_API_KEY", "TAVILY_API_KEY", "GROQ_API_KEY"] as const;
let loadedAt = 0;

/** Recharge les clés de la base (au plus une fois par minute). */
export async function loadKeyOverrides(force = false) {
  if (!supabaseConfigured() || (!force && Date.now() - loadedAt < 60_000)) return;
  loadedAt = Date.now();
  try {
    const { data } = await db().from("app_settings").select("value").eq("key", "api_keys").maybeSingle();
    setKeyOverrides((data?.value ?? {}) as Record<string, string>);
  } catch {}
}

export async function saveKeyOverrides(values: Partial<Record<(typeof EDITABLE_KEYS)[number], string>>) {
  const { data } = await db().from("app_settings").select("value").eq("key", "api_keys").maybeSingle();
  const current = (data?.value ?? {}) as Record<string, string>;
  for (const k of EDITABLE_KEYS) {
    const v = values[k];
    if (v === undefined) continue;
    const clean = v.trim().replace(/^["']|["']$/g, "");
    if (clean) current[k] = clean;
    else delete current[k]; // vide : on revient à la clé de Vercel
  }
  const { error } = await db().from("app_settings").upsert({ key: "api_keys", value: current, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  await loadKeyOverrides(true);
}
