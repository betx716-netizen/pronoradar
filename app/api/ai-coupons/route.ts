import { AiCouponsRequestSchema, buildAiCoupons, type AiCoupons } from "@/lib/aiCoupons";
import { guard, isDemo, streamTask } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 120;

// En démo : un coupon par profil avec les premiers paris de chaque match.
function demo(size: number | null, ids: string[][]): AiCoupons {
  const n = size ?? 3;
  return {
    coupons: (["value", "sur", "equilibre", "audacieux", "jackpot"] as const).map((profile, k) => ({
      profile,
      legs: ids.slice(0, n).map((list) => ({ pick_id: list[k % list.length], reason: "Choix de l'IA (démo)." })),
      comment: "Coupon composé par l'IA (démo).",
      stake_percent: profile === "jackpot" ? 0.5 : 2,
    })),
  };
}

export async function POST(req: Request) {
  const denied = guard(req);
  if (denied) return denied;
  const parsed = AiCouponsRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Analyses invalides." }, { status: 400 });
  const body = parsed.data;
  return streamTask((progress) =>
    isDemo()
      ? Promise.resolve(demo(body.size, body.matches.map((m) => m.picks.map((p) => p.split(" | ")[0]))))
      : buildAiCoupons(body, progress),
  );
}
