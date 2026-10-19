import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const bebas = Bebas_Neue({ variable: "--font-bebas", weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PronoRadar",
  description: "Recense les pronostics publiés sur le web, les compare et en tire une analyse.",
};

// Empêche le zoom automatique du navigateur mobile (double tap, focus d'un champ).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#e10a17",
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
            __html: `try{var t=localStorage.getItem("pronoradar.theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${bebas.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
