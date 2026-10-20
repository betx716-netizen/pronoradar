"use client";
// Couleurs officielles d'un club (annuaire public ESPN, via /api/logo), mises en cache dans le navigateur.
import { useEffect, useState } from "react";

export type ClubColors = { shirt: string; detail: string };
const KEY = "pronoradar.clubColors.v1";
const memory = new Map<string, Promise<ClubColors | null>>();

function fetchColors(team: string): Promise<ClubColors | null> {
  try {
    const cached = JSON.parse(localStorage.getItem(KEY) ?? "{}")[team];
    if (cached) return Promise.resolve(cached);
  } catch {}
  if (!memory.has(team)) {
    memory.set(
      team,
      fetch(`/api/logo?name=${encodeURIComponent(team)}`)
        .then((r) => r.json())
        .then((d: { color: string | null; alternate: string | null }) => {
          if (!d.color) return null;
          const c = { shirt: d.color, detail: d.alternate && d.alternate !== d.color ? d.alternate : "#ffffff" };
          try {
            localStorage.setItem(KEY, JSON.stringify({ ...JSON.parse(localStorage.getItem(KEY) ?? "{}"), [team]: c }));
          } catch {}
          return c;
        })
        .catch(() => null),
    );
  }
  return memory.get(team)!;
}

export function useClubColors(team: string | null | undefined) {
  const [colors, setColors] = useState<ClubColors | null>(null);
  useEffect(() => {
    if (!team) return;
    let alive = true;
    fetchColors(team).then((c) => alive && setColors(c));
    return () => {
      alive = false;
    };
  }, [team]);
  return colors;
}
