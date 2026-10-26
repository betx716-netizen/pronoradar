// Connexion par identifiant et mot de passe (APP_USERNAME / APP_PASSWORD) : une fois connecté, le navigateur garde
// un cookie de session signé, valable 30 jours. Sans APP_PASSWORD, l'application reste ouverte.
import { createHmac, timingSafeEqual } from "node:crypto";
import { readKey } from "./env";

export const SESSION_COOKIE = "pr_session";
const MAX_AGE = 30 * 86400;

const password = () => process.env.APP_PASSWORD ?? "";
const username = () => readKey("APP_USERNAME");
export const authRequired = () => Boolean(password());

// La signature dépend du mot de passe : le changer déconnecte tous les appareils.
const secret = () => `${process.env.APP_SECRET ?? ""}|${password()}|${username()}`;
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkCredentials(user: string, pass: string) {
  const u = username();
  return safeEqual(pass, password()) && (!u || safeEqual(user.trim().toLowerCase(), u.toLowerCase()));
}

export function createSession() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  const value = `${payload}.${sign(payload)}`;
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;
}

export const clearSession = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

function validSession(req: Request) {
  const raw = req.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`))?.[1];
  if (!raw) return false;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return false;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()).exp > Date.now();
  } catch {
    return false;
  }
}

/** Vrai si la requête vient d'un appareil connecté (ou si l'application n'est pas protégée). */
export function isAuthorized(req: Request) {
  if (!authRequired()) return true;
  // L'ancien en-tête avec le mot de passe reste accepté pour les appareils pas encore reconnectés.
  return validSession(req) || req.headers.get("x-app-password") === password();
}
