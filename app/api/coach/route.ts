import { CoachRequestSchema, demoReview, reviewCoupon } from "@/lib/coach";
import { guard, isDemo, streamTask } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const denied = guard(req);
  if (denied) return denied;
  const parsed = CoachRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Coupon invalide." }, { status: 400 });
  return streamTask((progress) => (isDemo() ? Promise.resolve(demoReview(parsed.data)) : reviewCoupon(parsed.data, progress)));
}
