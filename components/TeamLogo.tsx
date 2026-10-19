"use client";

import { useEffect, useState } from "react";

// Cache partagé : chaque logo n'est demandé qu'une fois, puis gardé dans le navigateur.
const KEY = "pronoradar.logos.v1";
const memory = new Map<string, Promise<string | null>>();

function stored(): Record<string, string | null> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

function fetchLogo(name: string): Promise<string | null> {
  const cached = stored();
  if (name in cached) return Promise.resolve(cached[name]);
  if (!memory.has(name)) {
    memory.set(
      name,
      fetch(`/api/logo?name=${encodeURIComponent(name)}`)
        .then((r) => r.json())
        .then((d: { url: string | null }) => {
          try {
            localStorage.setItem(KEY, JSON.stringify({ ...stored(), [name]: d.url }));
          } catch {}
          return d.url;
        })
        .catch(() => null),
    );
  }
  return memory.get(name)!;
}

const COLORS = ["#60a5fa", "#fb923c", "#3ddc97", "#f2c35b", "#c084fc", "#f87171", "#2dd4bf"];
const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || n.slice(0, 2).toUpperCase();

/** Logo de l'équipe ; à défaut (tennis, logo introuvable), un rond coloré avec les initiales. */
export function TeamLogo({ name, sport = "football", size = 24 }: { name: string; sport?: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (sport !== "football") return;
    let alive = true;
    fetchLogo(name).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [name, sport]);

  if (url && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} loading="lazy" onError={() => setFailed(true)} className="shrink-0 object-contain" style={{ width: size, height: size }} />;
  }
  const color = COLORS[[...name].reduce((h, c) => h + c.charCodeAt(0), 0) % COLORS.length];
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-black"
      style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </span>
  );
}
