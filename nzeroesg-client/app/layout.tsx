import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "CarbonSage | Evidence-grounded ESG intelligence",
  description:
    "An embeddable ESG decision agent for cited evidence, trusted tools, and interactive Scope 3 analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="antialiased scroll-smooth">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
