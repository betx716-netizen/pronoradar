// Notifications sur le téléphone de l'administrateur via ntfy (https://ntfy.sh), gratuit et sans compte :
// l'app ntfy s'abonne au canal NTFY_TOPIC et reçoit chaque message en direct. Sans NTFY_TOPIC, rien n'est envoyé.
import { readKey } from "./env";
import { isDemo } from "./http";

export async function notifyAdmin(title: string, message: string, opts: { tags?: string; priority?: "default" | "high"; click?: string } = {}) {
  const topic = readKey("NTFY_TOPIC");
  if (!topic || isDemo()) return;
  const server = (readKey("NTFY_SERVER") || "https://ntfy.sh").replace(/\/$/, "");
  try {
    await fetch(`${server}/${encodeURIComponent(topic)}`, {
      method: "POST",
      body: message,
      headers: {
        // Les en-têtes HTTP doivent rester en ASCII : le titre accentué passe en encodage RFC 2047.
        Title: `=?UTF-8?B?${Buffer.from(title).toString("base64")}?=`,
        Tags: opts.tags ?? "",
        Priority: opts.priority ?? "default",
        ...(opts.click ? { Click: opts.click } : {}),
      },
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.error("Notification ntfy :", e);
  }
}
