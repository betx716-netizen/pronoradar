import { isDemo } from "@/lib/http";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Réglages publics pour la connexion dans le navigateur (clé publishable, faite pour être publique).
export function GET() {
  return Response.json({ demo: isDemo(), supabaseUrl: supabaseUrl(), supabaseKey: supabasePublishableKey(), payments: true, cinetpay: false });
}
