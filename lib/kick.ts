// Relance le moteur quotidien en appelant /api/cron/daily, qui répond tout de suite et travaille en arrière-plan.
import { readKey } from "./env";

let lastKick = 0;

export const appOrigin = (req?: Request) => readKey("APP_URL").replace(/\/$/, "") || (req ? new URL(req.url).origin : "");

export async function kickWorker(origin: string, force = false) {
  const secret = readKey("CRON_SECRET");
  if (!secret || !origin) return;
  if (!force && Date.now() - lastKick < 60_000) return;
  lastKick = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  await fetch(`${origin}/api/cron/daily`, { headers: { authorization: `Bearer ${secret}` }, signal: ctl.signal, cache: "no-store" }).catch(() => null);
  clearTimeout(timer);
}
