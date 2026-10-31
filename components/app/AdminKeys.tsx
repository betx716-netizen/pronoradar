"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type State = Record<string, { source: string; apercu: string }>;
const LABELS: Record<string, string> = {
  GEMINI_API_KEY: "Gemini (IA et recherche Google)",
  TAVILY_API_KEY: "Tavily (recherche de secours)",
  GROQ_API_KEY: "Groq (IA de secours)",
};

/** Administrateur : remplacer les clés des services depuis l'app (prioritaires sur celles de Vercel). */
export function AdminKeys() {
  const [state, setState] = useState<State | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => api<State>("/api/admin/keys").then(setState).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      await api("/api/admin/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      setValues({});
      setNote({ ok: true, text: "Clés enregistrées. Lance le diagnostic pour vérifier." });
      load();
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
    setBusy(false);
  }

  return (
    <section className="space-y-3 rounded-3xl bg-surface p-5">
      <h3 className="font-display text-xl font-bold">Clés des services</h3>
      <p className="text-[0.875rem] text-muted">Une clé saisie ici remplace celle de Vercel, sans redéployer. Laisse vide pour ne pas la changer.</p>
      {Object.keys(LABELS).map((k) => (
        <label key={k} className="block">
          <span className="mb-1 flex items-baseline justify-between gap-2 text-[0.875rem] font-medium">
            {LABELS[k]}
            <span className="text-xs text-muted">
              {state?.[k]?.apercu || "—"} · {state?.[k]?.source === "base" ? "app" : state?.[k]?.source === "vercel" ? "Vercel" : "absente"}
            </span>
          </span>
          <input
            type="password"
            autoComplete="off"
            value={values[k] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
            placeholder="Nouvelle clé"
            className="w-full rounded-2xl border-2 border-border bg-surface-2 px-4 py-2.5 outline-none focus:border-accent"
          />
        </label>
      ))}
      {note && <p className={`text-[0.875rem] ${note.ok ? "text-success" : "text-danger"}`}>{note.text}</p>}
      <button onClick={save} disabled={busy || !Object.values(values).some(Boolean)} className="w-full rounded-full bg-accent py-2.5 font-semibold text-white disabled:opacity-50">
        {busy ? "…" : "Enregistrer les clés"}
      </button>
    </section>
  );
}
