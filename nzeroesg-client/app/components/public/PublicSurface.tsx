import { Newsreader } from "next/font/google";

// The editorial serif is public-only. Instantiating it here (not in the root
// layout) keeps its font file off every workspace route.
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-newsreader",
  display: "swap",
});

/**
 * Wrapper that switches its subtree to the public (warm olive and paper)
 * tokens. Workspace screens never render inside it. The body picks the same
 * tokens up through body:has(.surface-public), so overscroll matches the page.
 */
export default function PublicSurface({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`surface-public ${newsreader.variable} min-h-screen bg-background text-foreground [--rail:3.5rem] md:[--rail:7rem] lg:[--rail:14.8rem]`}
    >
      {children}
    </div>
  );
}
