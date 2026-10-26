"use client";

// « Mon ticket » : le combiné que l'utilisateur compose lui-même à partir des choix de l'IA.
// Une sélection par match ; gardé sur le téléphone pour la journée.
import { useCallback, useEffect, useState } from "react";
import type { CouponLeg } from "./coupon";

export type TicketLeg = CouponLeg & { matchId: string };

const KEY = "pronoradar.ticket.v1";
const EVENT = "pronoradar-ticket";

function read(day: string): TicketLeg[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { day: string; legs: TicketLeg[] } | null;
    return saved && saved.day === day ? saved.legs : [];
  } catch {
    return [];
  }
}

export function useTicket(day: string) {
  const [legs, setLegs] = useState<TicketLeg[]>([]);

  useEffect(() => {
    if (!day) return;
    const sync = () => setLegs(read(day));
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, [day]);

  const save = useCallback(
    (next: TicketLeg[]) => {
      setLegs(next);
      try {
        localStorage.setItem(KEY, JSON.stringify({ day, legs: next }));
        window.dispatchEvent(new Event(EVENT));
      } catch {}
    },
    [day],
  );

  /** Ajoute la sélection, remplace celle du même match, ou la retire si elle y est déjà. */
  const toggle = (leg: TicketLeg) => {
    const same = legs.find((l) => l.matchId === leg.matchId);
    if (same && same.pick.selection === leg.pick.selection) return save(legs.filter((l) => l.matchId !== leg.matchId));
    save([...legs.filter((l) => l.matchId !== leg.matchId), leg]);
  };

  const replaceAll = (next: TicketLeg[]) => save(next);
  const remove = (matchId: string) => save(legs.filter((l) => l.matchId !== matchId));
  const clear = () => save([]);
  const has = (matchId: string, selection: string) => legs.some((l) => l.matchId === matchId && l.pick.selection === selection);

  const totalOdds = Math.round(legs.reduce((t, l) => t * l.pick.odds, 1) * 100) / 100;
  const probability = Math.round(legs.reduce((t, l) => t * (l.pick.probability / 100), 1) * 1000) / 10;

  return { legs, toggle, replaceAll, remove, clear, has, totalOdds, probability };
}

export type Ticket = ReturnType<typeof useTicket>;
