"use client";

// Connexion côté navigateur : numéro de téléphone + mot de passe, sans SMS ni email.
// En mode démo, les comptes sont gardés en mémoire sur le serveur.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { normalizePhone, phoneLogin } from "./phone";

type Config = { demo: boolean; supabaseUrl: string; supabaseKey: string; payments: boolean; cinetpay: boolean };

let configPromise: Promise<Config> | null = null;
export const loadConfig = () =>
  (configPromise ??= fetch("/api/session-config")
    .then((r) => r.json())
    .catch(() => ({ demo: false, supabaseUrl: "", supabaseKey: "", payments: false, cinetpay: false }))) as Promise<Config>;

let sb: SupabaseClient | null = null;
async function supabase(): Promise<SupabaseClient | null> {
  if (sb) return sb;
  const c = await loadConfig();
  if (c.demo || !c.supabaseUrl || !c.supabaseKey) return null;
  sb = createClient(c.supabaseUrl, c.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  return sb;
}

const DEMO_KEY = "pronoradar.demoAccount";
const EVENT = "pronoradar-session";
const demoEmail = () => {
  try {
    return localStorage.getItem(DEMO_KEY);
  } catch {
    return null;
  }
};

export async function getToken(): Promise<string | null> {
  const c = await loadConfig();
  if (c.demo) {
    const e = demoEmail();
    return e ? `demo:${e}` : null;
  }
  const client = await supabase();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Crée le compte (numéro + mot de passe, sans SMS) puis connecte l'utilisateur. */
export async function signUp(phoneInput: string, password: string) {
  const res = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: phoneInput, password }) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Impossible de créer le compte.");
  await signIn(phoneInput, password);
}

export async function signIn(phoneInput: string, password: string) {
  const phone = normalizePhone(phoneInput);
  if (!phone) throw new Error("Saisis un numéro à 10 chiffres, par exemple 07 59 35 86 62.");
  const c = await loadConfig();
  if (c.demo) {
    const res = await fetch("/api/auth/signup", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, password }) });
    if (!res.ok) throw new Error("Numéro ou mot de passe incorrect.");
    localStorage.setItem(DEMO_KEY, phoneLogin(phone));
    window.dispatchEvent(new Event(EVENT));
    return;
  }
  const client = await supabase();
  if (!client) throw new Error("La connexion n'est pas encore disponible.");
  const { error } = await client.auth.signInWithPassword({ email: phoneLogin(phone), password });
  if (error) throw new Error(error.status === 429 ? "Trop d'essais. Patiente une minute." : "Numéro ou mot de passe incorrect.");
}

/** Change le mot de passe du compte connecté. */
export async function changePassword(password: string) {
  if (password.length < 6) throw new Error("Choisis un mot de passe d'au moins 6 caractères.");
  const c = await loadConfig();
  if (c.demo) return;
  const client = await supabase();
  if (!client) throw new Error("La connexion n'est pas disponible.");
  const { error } = await client.auth.updateUser({ password });
  if (error) throw new Error(/different|same/i.test(error.message) ? "Choisis un mot de passe différent de l'actuel." : "Impossible de changer le mot de passe. Réessaie.");
}

export async function signOut() {
  const c = await loadConfig();
  if (c.demo) {
    localStorage.removeItem(DEMO_KEY);
    window.dispatchEvent(new Event(EVENT));
    return;
  }
  await (await supabase())?.auth.signOut();
}

/** Identifiant du compte connecté (null si déconnecté), mis à jour à chaque connexion ou déconnexion. */
export function useSession() {
  const [state, setState] = useState<{ ready: boolean; email: string | null }>({ ready: false, email: null });
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let alive = true;
    (async () => {
      const c = await loadConfig();
      if (c.demo) {
        const sync = () => alive && setState({ ready: true, email: demoEmail() });
        sync();
        window.addEventListener(EVENT, sync);
        unsub = () => window.removeEventListener(EVENT, sync);
        return;
      }
      const client = await supabase();
      if (!client) return alive && setState({ ready: true, email: null });
      const { data } = await client.auth.getSession();
      if (alive) setState({ ready: true, email: data.session?.user.email ?? null });
      const sub = client.auth.onAuthStateChange((_e, session) => alive && setState({ ready: true, email: session?.user.email ?? null }));
      unsub = () => sub.data.subscription.unsubscribe();
    })();
    return () => {
      alive = false;
      unsub?.();
    };
  }, []);
  return state;
}
