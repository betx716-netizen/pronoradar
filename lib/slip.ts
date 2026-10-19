"use client";
// Panier de paris composé à la main, comme sur un site de bookmaker : un pari par match,
// gardé dans le navigateur et partagé entre tous les composants.
import { useSyncExternalStore } from "react";
import type { CouponLeg } from "./coupon";

const KEY = "pronoradar.slip.v1";
const EMPTY: CouponLeg[] = [];
let cache: CouponLeg[] | null = null;
const listeners = new Set<() => void>();

function read(): CouponLeg[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "[]") as CouponLeg[];
  } catch {
    cache = [];
  }
  return cache;
}

function write(legs: CouponLeg[]) {
  cache = legs;
  try {
    localStorage.setItem(KEY, JSON.stringify(legs));
  } catch {}
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useSlip = () => useSyncExternalStore(subscribe, read, () => EMPTY);

export const legKey = (l: Pick<CouponLeg, "match">) => l.match;
export const isInSlip = (legs: CouponLeg[], match: string, selection: string) =>
  legs.some((l) => l.match === match && l.pick.selection === selection);

/** Ajoute le pari, le remplace s'il y a déjà un pari sur ce match, ou le retire s'il était déjà choisi. */
export function toggleLeg(leg: CouponLeg) {
  const legs = read();
  const same = isInSlip(legs, leg.match, leg.pick.selection);
  try {
    navigator.vibrate?.(12);
  } catch {}
  write(same ? legs.filter((l) => l.match !== leg.match) : [...legs.filter((l) => l.match !== leg.match), leg]);
}

export const removeLeg = (match: string) => write(read().filter((l) => l.match !== match));
export const clearSlip = () => write([]);
export const setSlip = (legs: CouponLeg[]) => write(legs);
