"use client";

import { useEffect, useState } from "react";

const KEY = "pronoradar.leagueLogos.v1";
const memory = new Map<string, Promise<string | null>>();

function fetchLogo(name: string): Promise<string | null> {
  try {
    const cached = JSON.parse(localStorage.getItem(KEY) ?? "{}")[name];
    if (cached) return Promise.resolve(cached);
  } catch {}
  if (!memory.has(name)) {
    memory.set(
      name,
      fetch(`/api/league-logo?name=${encodeURIComponent(name)}`)
        .then((r) => r.json())
        .then((d: { url: string | null }) => {
          try {
            if (d.url) localStorage.setItem(KEY, JSON.stringify({ ...JSON.parse(localStorage.getItem(KEY) ?? "{}"), [name]: d.url }));
          } catch {}
          return d.url;
        })
        .catch(() => null),
    );
  }
  return memory.get(name)!;
}

/** Logo du championnat ; à défaut (tennis, logo introuvable), un pictogramme de coupe. */
export function LeagueLogo({ name, size = 24 }: { name: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    fetchLogo(name).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [name]);

  if (url && !failed) {
    // Pastille blanche : les logos sont faits pour un fond clair, y compris en mode sombre.
    return (
      <span className="flex shrink-0 items-center justify-center rounded-lg bg-white p-0.5" style={{ width: size + 4, height: size + 4 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" width={size} height={size} loading="lazy" onError={() => setFailed(true)} className="object-contain" style={{ width: size, height: size }} />
      </span>
    );
  }
  return (
    <span aria-hidden className="flex shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent" style={{ width: size + 4, height: size + 4 }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: size * 0.7, height: size * 0.7 }}>
        <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />
      </svg>
    </span>
  );
}
