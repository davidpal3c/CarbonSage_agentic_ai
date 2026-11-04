import type { Metadata } from "next";
import { Archivo, DM_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

// One variable family covers body, workspace and the public site's light
// display weight; the mono face is for workspace figures. The public serif
// lives with the public surface.
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

// Applies the saved or system theme before first paint, so a dark preference
// never flashes light while the client hydrates. It mirrors getClientTheme in
// ThemeContext (saved value first, then the system preference).
const themeScript = `var t;try{t=localStorage.getItem("theme")}catch(e){}try{if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased scroll-smooth">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
