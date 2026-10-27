// Notifications sur le téléphone de l'administrateur via ntfy (https://ntfy.sh), gratuit et sans compte :
// l'app ntfy s'abonne au canal NTFY_TOPIC et reçoit chaque message en direct. Sans NTFY_TOPIC, rien n'est envoyé.
import { readKey } from "./env";
import { isDemo } from "./http";

export type NotifyResult = { sent: boolean; reason?: string; topicHint?: string };

export async function notifyAdmin(
  title: string,
  message: string,
  opts: { tags?: string; priority?: "default" | "high"; click?: string } = {},
): Promise<NotifyResult> {
  const topic = readKey("NTFY_TOPIC").trim();
  if (!topic) return { sent: false, reason: "La variable NTFY_TOPIC n'est pas définie sur Vercel (ou le site n'a pas été redéployé depuis)." };
  if (isDemo()) return { sent: false, reason: "Mode démo." };
  // Début et fin du canal seulement, pour vérifier le nom sans l'exposer.
  const topicHint = topic.length > 6 ? `${topic.slice(0, 3)}…${topic.slice(-3)} (${topic.length} caractères)` : `${topic.length} caractères`;
  const server = (readKey("NTFY_SERVER") || "https://ntfy.sh").replace(/\/$/, "");
  try {
    const res = await fetch(`${server}/${encodeURIComponent(topic)}`, {
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
    return res.ok ? { sent: true, topicHint } : { sent: false, topicHint, reason: `ntfy a refusé l'envoi (erreur ${res.status}).` };
  } catch (e) {
    console.error("Notification ntfy :", e);
    return { sent: false, topicHint, reason: "ntfy injoignable depuis le serveur." };
  }
}
