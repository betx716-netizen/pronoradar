// Mode « site en travaux » : activé par l'administrateur depuis Mon compte, enregistré dans la base
// (table app_settings). Pendant les travaux, seuls les administrateurs utilisent l'application.
import { isDemo } from "./http";
import { db, supabaseConfigured } from "./supabase";

export type Maintenance = { on: boolean; message: string };
export const DEFAULT_MESSAGE = "PronoRadar fait peau neuve. Nous revenons très vite avec une version encore meilleure.";

let cache: { at: number; value: Maintenance } | null = null;
const g = globalThis as unknown as { __prMaintenance?: Maintenance };

export async function getMaintenance(): Promise<Maintenance> {
  if (isDemo() || !supabaseConfigured()) return g.__prMaintenance ?? { on: false, message: DEFAULT_MESSAGE };
  if (cache && Date.now() - cache.at < 15_000) return cache.value;
  const { data } = await db().from("app_settings").select("value").eq("key", "maintenance").maybeSingle();
  const v = (data?.value ?? {}) as Partial<Maintenance>;
  const value = { on: v.on === true, message: (v.message || DEFAULT_MESSAGE).slice(0, 400) };
  cache = { at: Date.now(), value };
  return value;
}

export async function setMaintenance(value: Maintenance) {
  const clean = { on: value.on, message: (value.message || DEFAULT_MESSAGE).trim().slice(0, 400) };
  cache = { at: Date.now(), value: clean };
  if (isDemo() || !supabaseConfigured()) {
    g.__prMaintenance = clean;
    return;
  }
  const { error } = await db().from("app_settings").upsert({ key: "maintenance", value: clean, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export const maintenanceResponse = (message: string) =>
  Response.json({ error: `Site en travaux : ${message}`, code: "maintenance" }, { status: 503 });
