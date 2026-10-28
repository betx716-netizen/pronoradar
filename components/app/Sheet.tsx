"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../Icon";

/** Panneau qui monte du bas de l'écran (ou fenêtre centrée sur ordinateur). */
export function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    // Bloque le défilement de la page derrière (iPhone compris, qui ignore overflow: hidden sur le body).
    const y = window.scrollY;
    const body = document.body.style;
    const prev = { overflow: body.overflow, position: body.position, top: body.top, width: body.width };
    Object.assign(body, { overflow: "hidden", position: "fixed", top: `-${y}px`, width: "100%" });
    return () => {
      window.removeEventListener("keydown", key);
      Object.assign(body, prev);
      window.scrollTo(0, y);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Fermer" className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] bg-bg sm:rounded-[28px] ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
      >
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
          <h2 className="font-display text-2xl font-bold leading-tight">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-muted">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
