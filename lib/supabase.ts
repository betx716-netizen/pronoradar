// Accès serveur à Supabase avec la clé secrète : jamais envoyée au navigateur.
// Les tables ont la sécurité RLS activée sans politique, donc seul ce client peut les lire et les écrire.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readKey } from "./env";

export const supabaseUrl = () => readKey("SUPABASE_URL");
// Clé publishable (sb_publishable_…) : sert au navigateur pour la connexion par email.
export const supabasePublishableKey = () => readKey("SUPABASE_KEY");
const secretKey = () => readKey("SUPABASE_SECRET_KEY") || readKey("SUPABASE_SERVICE_ROLE_KEY");

export const supabaseConfigured = () => Boolean(supabaseUrl() && secretKey());

let admin: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!supabaseConfigured()) throw new Error("Supabase n'est pas configuré (SUPABASE_URL et SUPABASE_SECRET_KEY).");
  admin ??= createClient(supabaseUrl(), secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
