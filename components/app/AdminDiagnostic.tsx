"use client";

import { useState } from "react";
import { api } from "@/lib/client";

type Probe = { status: number; response: string };
type Report = Record<string, unknown>;

// Lecture simple d'une réponse de test : vert si le service répond, rouge sinon, avec la raison.
function verdict(p: Probe) {
  const ok = p.status >= 200 && p.status < 300;
  let why = "";
  if (!ok) {
    const m = p.response.match(/"message"\s*:\s*"([^"]{0,180})/);
    why = m?.[1] ?? p.response.slice(0, 160);
  }
  return { ok, why };
}

function Line({ name, probe }: { name: string; probe: Probe }) {
  const v = verdict(probe);
  return (
    <li className="py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.875rem] font-medium">{name}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${v.ok ? "bg-success-soft text-success" : "bg-danger text-white"}`}>
          {v.ok ? "OK" : `Erreur ${probe.status || ""}`}
        </span>
      </div>
      {v.why && <p className="mt-1 break-words text-xs text-muted">{v.why}</p>}
    </li>
  );
}

/** Administrateur : teste en direct chaque service (recherche Google par modèle, secours, cotes…). */
export function AdminDiagnostic() {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      setReport(await api<Report>("/api/diagnostic"));
    } catch (e) {
      setReport({ Erreur: { status: 0, response: e instanceof Error ? e.message : String(e) } });
    }
    setBusy(false);
  }

  const lines: { name: string; probe: Probe }[] = [];
  for (const [name, v] of Object.entries(report ?? {})) {
    const o = v as Record<string, unknown>;
    if (o && typeof o === "object" && "status" in o) lines.push({ name, probe: o as Probe });
    else if (o && typeof o === "object" && o.test && typeof o.test === "object") lines.push({ name, probe: o.test as Probe });
    else if (o && typeof o === "object")
      for (const [sub, p] of Object.entries(o)) if (p && typeof p === "object" && "status" in p) lines.push({ name: `${name} · ${sub}`, probe: p as Probe });
  }

  return (
    <section className="space-y-3 rounded-3xl bg-surface p-5">
      <h3 className="font-display text-xl font-bold">Diagnostic des services</h3>
      <p className="text-[0.875rem] text-muted">Teste en direct la recherche Google (modèle par modèle), la recherche et l&apos;IA de secours, les cotes.</p>
      {lines.length > 0 && <ul className="divide-y divide-border">{lines.map((l) => <Line key={l.name} {...l} />)}</ul>}
      <button onClick={run} disabled={busy} className="w-full rounded-full bg-accent py-2.5 font-semibold text-white disabled:opacity-60">
        {busy ? "Test en cours…" : "Lancer le diagnostic"}
      </button>
    </section>
  );
}
