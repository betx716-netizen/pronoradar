// Icônes au trait (style Lucide), dessinées en SVG pour rester nettes et suivre la couleur du texte.
const PATHS = {
  matchs: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 0v4m0 12v4M2 12h4m12 0h4M12 8l3.5 2.5-1.3 4h-4.4l-1.3-4Z",
  analyses: "M3 3v18h18M7 15l4-4 3 3 5-6",
  coupon: "M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4Zm9 0v12",
  suivi: "M3 17l6-6 4 4 8-8M15 7h6v6",
  direct: "M5 12a7 7 0 0 1 14 0M8.5 12a3.5 3.5 0 0 1 7 0M12 12v.01M4 19h16",
  lock: "M6 11h12v10H6ZM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  close: "M6 6l12 12M18 6 6 18",
  check: "M5 12.5 10 17 19 7",
  crown: "M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5Z",
  compte: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-6 w-6" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
