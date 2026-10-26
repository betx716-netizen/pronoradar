import { servicesStatus } from "@/lib/http";

export const dynamic = "force-dynamic";

// Indique au navigateur quels services sont configurés (jamais les clés elles-mêmes).
export function GET() {
  return Response.json(servicesStatus());
}
