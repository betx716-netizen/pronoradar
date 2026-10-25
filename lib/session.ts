"use client";

// Connexion côté navigateur : email + code à 6 chiffres envoyé par Supabase (le lien reçu par email marche aussi).
// En mode démo, n'importe quel email et le code 123456 suffisent.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

type Config = { demo: boolean; supabaseUrl: string; supabaseKey: string; payments: boolean; cinetpay: boolean };

let configPromise: Promise<Config> | null = null;
export const loadConfig = () =>
  (configPromise ??= fetch("/api/config")
    .then((r) => r.json())
    .catch(() => ({ demo: false, supabaseUrl: "", supabaseKey: "", payments: false, cinetpay: false }))) as Promise<Config>;

let sb: SupabaseClient | null = null;
async function supabase(): Promise<SupabaseClient | null> {
  if (sb) return sb;
  const c = await loadConfig();
  if (c.demo || !c.supabaseUrl || !c.supabaseKey) return null;
  sb = createClient(c.supabaseUrl, c.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } });
  return sb;
}

const DEMO_KEY = "pronoradar.demoEmail";
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

export async function sendCode(email: string) {
  const c = await loadConfig();
  if (c.demo) return;
  const client = await supabase();
  if (!client) throw new Error("La connexion n'est pas encore disponible.");
  const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: window.location.origin } });
  if (error) throw new Error(error.status === 429 ? "Trop de demandes. Patiente une minute avant de redemander un code." : "Impossible d'envoyer le code. Vérifie l'adresse email.");
}

export async function verifyCode(email: string, code: string) {
  const c = await loadConfig();
  if (c.demo) {
    if (code !== "123456") throw new Error("Code incorrect (démo : 123456).");
    localStorage.setItem(DEMO_KEY, email.toLowerCase());
    window.dispatchEvent(new Event(EVENT));
    return;
  }
  const client = await supabase();
  if (!client) throw new Error("La connexion n'est pas encore disponible.");
  const { error } = await client.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) throw new Error("Code incorrect ou expiré.");
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

/** Email du compte connecté (null si déconnecté), mis à jour à chaque connexion ou déconnexion. */
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
