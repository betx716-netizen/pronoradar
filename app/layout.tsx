import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Polices hébergées avec l'application (licence OFL) : rien à télécharger chez Google au chargement.
const barlow = localFont({
  variable: "--font-barlow",
  display: "swap",
  src: [
    { path: "./fonts/barlow-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/barlow-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/barlow-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/barlow-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
});
const barlowCondensed = localFont({
  variable: "--font-barlow-condensed",
  display: "swap",
  src: [
    { path: "./fonts/barlow-condensed-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/barlow-condensed-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/barlow-condensed-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/barlow-condensed-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "PronoRadar",
  description: "Chaque jour, l'IA analyse les matchs et prépare tes coupons. Paiement par Orange Money, MTN, Moov et Wave.",
};

// Empêche le zoom automatique du navigateur mobile (double tap, focus d'un champ).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#073d27",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Applique le thème choisi avant l'affichage, pour éviter un flash de la mauvaise couleur. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var d=document.documentElement,t=localStorage.getItem("pronoradar.theme");if(t)d.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className={`${barlow.variable} ${barlowCondensed.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
