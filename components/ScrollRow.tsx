"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Rangée défilante horizontale, avec des flèches pour la faire défiler à la souris sur ordinateur. */
export function ScrollRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [children]);

  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });

  const arrow = (dir: number, hidden: boolean) => (
    <button
      type="button"
      onClick={() => scroll(dir)}
      aria-label={dir < 0 ? "Défiler vers la gauche" : "Défiler vers la droite"}
      className={`absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-text shadow-lg transition hover:border-accent hover:text-accent active:scale-95 sm:flex ${
        dir < 0 ? "left-0" : "right-0"
      } ${hidden ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
        <path d={dir < 0 ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
      </svg>
    </button>
  );

  return (
    <div className="relative">
      {arrow(-1, edges.start)}
      <div ref={ref} className={`scrollbar-none flex overflow-x-auto ${className}`}>
        {children}
      </div>
      {arrow(1, edges.end)}
    </div>
  );
}
