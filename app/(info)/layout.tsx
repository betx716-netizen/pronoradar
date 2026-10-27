import Link from "next/link";
import { INFO_PAGES, LEGAL } from "@/lib/legal";

// Pages d'information (FAQ, pages légales) : lisibles sans compte et indexées par les moteurs de recherche.
export default function InfoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="bg-gradient-to-r from-header-from to-header-to text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo-mark.png" alt="" className="h-9 w-9 rounded-lg bg-black object-cover" />
            <span className="font-display text-2xl leading-none tracking-wide">
              PRONO<span className="text-white/75">RADAR</span>
            </span>
          </Link>
          <Link href="/" className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25">
            Ouvrir l&apos;app
          </Link>
        </div>
      </header>
      <main className="info mx-auto max-w-3xl px-4 py-8">{children}</main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        <nav className="mb-3 flex flex-wrap justify-center gap-x-4 gap-y-2">
          {INFO_PAGES.map((p) => (
            <Link key={p.href} href={p.href} className="hover:text-accent">
              {p.label}
            </Link>
          ))}
        </nav>
        {LEGAL.brand} · Aide à la décision, aucun gain garanti · Réservé aux personnes majeures (18 ans et plus).
      </footer>
    </div>
  );
}
