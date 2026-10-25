import { cinetpayConfigured } from "@/lib/cinetpay";
import { isDemo } from "@/lib/http";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Réglages publics pour le navigateur : adresse Supabase et clé publishable (faite pour être publique),
// jamais les clés secrètes.
export function GET() {
  return Response.json({
    demo: isDemo(),
    supabaseUrl: supabaseUrl(),
    supabaseKey: supabasePublishableKey(),
    payments: isDemo() || cinetpayConfigured(),
  });
}
