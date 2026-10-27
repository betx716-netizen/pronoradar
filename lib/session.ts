"use client";

// Connexion côté navigateur : numéro de téléphone + mot de passe (sans SMS), ou email + mot de passe
// (inscription confirmée par un lien envoyé par email par Supabase).
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
  sb = createClient(c.supabaseUrl, c.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
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

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
// Les comptes « numéro » utilisent un faux email interne : on ne les traite pas comme de vrais emails.
const realEmail = (s: string) => isEmail(s) && !s.trim().toLowerCase().endsWith("@tel.pronoradar.app");
const back = () => `${window.location.origin}/`;

function emailError(message: string, status?: number) {
  const m = message.toLowerCase();
  if (status === 429 || m.includes("rate limit")) return "Trop d'emails envoyés en peu de temps. Réessaie dans quelques minutes.";
  if (m.includes("not confirmed")) return "Email pas encore confirmé : clique sur le lien reçu par email (regarde aussi dans les spams).";
  if (m.includes("invalid login") || m.includes("invalid credentials")) return "Email ou mot de passe incorrect.";
  if (m.includes("already registered") || m.includes("already exists")) return "Cet email a déjà un compte. Connecte-toi.";
  if (m.includes("password")) return "Mot de passe trop faible : au moins 6 caractères.";
  if (m.includes("invalid") && m.includes("email")) return "Adresse email invalide.";
  return "Service indisponible pour le moment. Réessaie.";
}

/**
 * Crée le compte puis connecte l'utilisateur. Avec un email, Supabase envoie d'abord un lien de confirmation :
 * la fonction renvoie alors "confirm" et la connexion se fait au clic sur ce lien.
 */
export async function signUp(login: string, password: string): Promise<"ok" | "confirm"> {
  if (realEmail(login)) {
    const client = await supabase();
    if (!client) throw new Error("Les comptes ne sont pas encore disponibles.");
    const { data, error } = await client.auth.signUp({ email: login.trim(), password, options: { emailRedirectTo: back() } });
    if (error) throw new Error(emailError(error.message, error.status));
    // Email déjà inscrit : Supabase répond sans identité, pour ne pas révéler les comptes existants.
    if (data.user && (data.user.identities ?? []).length === 0) throw new Error("Cet email a déjà un compte. Connecte-toi.");
    return data.session ? "ok" : "confirm";
  }
  await signUpPhone(login, password);
  return "ok";
}

/** Renvoie l'email de confirmation d'inscription. */
export async function resendConfirmation(email: string) {
  const client = await supabase();
  if (!client) throw new Error("Service indisponible.");
  const { error } = await client.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: back() } });
  if (error) throw new Error(emailError(error.message, error.status));
}

/** Mot de passe oublié pour un compte email : lien envoyé par email, qui ouvre l'app pour choisir le nouveau. */
export async function sendPasswordReset(email: string) {
  const client = await supabase();
  if (!client) throw new Error("Service indisponible.");
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: back() });
  if (error) throw new Error(emailError(error.message, error.status));
}

/** Vrai quand l'utilisateur arrive par le lien « mot de passe oublié » : il doit choisir un nouveau mot de passe. */
export function usePasswordRecovery() {
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    let unsub: (() => void) | undefined;
    supabase().then((client) => {
      if (!client) return;
      const sub = client.auth.onAuthStateChange((event) => event === "PASSWORD_RECOVERY" && setRecovering(true));
      unsub = () => sub.data.subscription.unsubscribe();
    });
    return () => unsub?.();
  }, []);
  return [recovering, () => setRecovering(false)] as const;
}

async function signUpPhone(phoneInput: string, password: string) {
  const res = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: phoneInput, password }) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Impossible de créer le compte.");
  await signIn(phoneInput, password);
}

export async function signIn(login: string, password: string) {
  if (realEmail(login)) {
    const client = await supabase();
    if (!client) throw new Error("La connexion n'est pas encore disponible.");
    const { error } = await client.auth.signInWithPassword({ email: login.trim(), password });
    if (error) throw new Error(emailError(error.message, error.status));
    return;
  }
  const phoneInput = login;
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
