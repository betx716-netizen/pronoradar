// Icônes au trait (style Lucide), dessinées en SVG pour rester nettes et suivre la couleur du texte.
const PATHS = {
  matchs: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 0v4m0 12v4M2 12h4m12 0h4M12 8l3.5 2.5-1.3 4h-4.4l-1.3-4Z",
  analyses: "M3 3v18h18M7 15l4-4 3 3 5-6",
  coupon: "M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4Zm9 0v12",
  suivi: "M3 17l6-6 4 4 8-8M15 7h6v6",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-6 w-6" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
