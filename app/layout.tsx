import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Geist } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/legal";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const bebas = Bebas_Neue({ variable: "--font-bebas", weight: "400", subsets: ["latin"] });

const DESCRIPTION =
  "Pronostics foot et tennis analysés par l'IA : cotes, forme, confrontations, compositions et avis des pronostiqueurs comparés. Coupons du jour de la cote 2 à 50, en FCFA. Paiement Wave et Orange Money.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "PronoRadar · Pronostics foot analysés par l'IA", template: "%s · PronoRadar" },
  description: DESCRIPTION,
  applicationName: "PronoRadar",
  keywords: [
    "pronostic foot",
    "pronostic football aujourd'hui",
    "coupon du jour",
    "pronostic IA",
    "paris sportifs Côte d'Ivoire",
    "pronostic Ligue des Champions",
    "pronostic tennis",
    "analyse match",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "PronoRadar",
    title: "PronoRadar · Pronostics foot analysés par l'IA",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: "PronoRadar · Pronostics foot analysés par l'IA", description: DESCRIPTION },
  robots: { index: true, follow: true },
  category: "sports",
};

// Empêche le zoom automatique du navigateur mobile (double tap, focus d'un champ).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#050505",
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
            __html: `try{var d=document.documentElement,t=localStorage.getItem("pronoradar.theme"),p=localStorage.getItem("pronoradar.palette.v2");if(t)d.dataset.theme=t;if(p)d.dataset.palette=p}catch(e){}`,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${bebas.variable} font-sans antialiased`}>
        {/* Fiche de l'application pour Google (données structurées). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "PronoRadar",
              url: SITE_URL,
              applicationCategory: "SportsApplication",
              operatingSystem: "Web, Android, iOS",
              inLanguage: "fr",
              description: DESCRIPTION,
              offers: { "@type": "Offer", price: "0", priceCurrency: "XOF" },
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
