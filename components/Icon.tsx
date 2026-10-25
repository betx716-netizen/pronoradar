// Icônes au trait (style Lucide), dessinées en SVG pour rester nettes et suivre la couleur du texte.
const PATHS = {
  coupons: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Zm6-2v12",
  matchs: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 6 3.5 2.5-1.3 4h-4.4l-1.3-4ZM12 2v6m3.5 2.5L21 9m-6.8 5.5 2.3 5.5m-6.7-5.5L7.5 20M8.5 10.5 3 9",
  ticket: "M6 2h12v20l-3-2-3 2-3-2-3 2ZM9 7h6M9 11h6M9 15h3",
  suivi: "M3 17l6-6 4 4 8-8M15 7h6v6",
  compte: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0",
  direct: "M5 12a7 7 0 0 1 14 0M8.5 12a3.5 3.5 0 0 1 7 0M12 12v.01M4 19h16",
  lock: "M6 11h12v10H6ZM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  close: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5 10 17 19 7",
  crown: "M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5Z",
  trash: "M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3",
  chevron: "M9 6l6 6-6 6",
  spark: "M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M6 18l2.5-2.5m7-7L18 6",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-6 w-6" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
