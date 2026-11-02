import type { Metadata } from "next";
import { Archivo, DM_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

// One variable family covers body and display (the width axis gives the
// semi-expanded headline voice); the mono face is for labels and numerals.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CarbonSage | Evidence-grounded Scope 3 decision intelligence",
  description:
    "See the evidence behind Scope 3 decisions. The current demo connects freight emissions, transportation-supplier evidence, and decision support with cited answers and deterministic calculations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${archivo.variable} ${dmMono.variable}`}
    >
      <body className="antialiased scroll-smooth">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
