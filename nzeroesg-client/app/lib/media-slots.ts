/**
 * Replaceable media slots for the public site.
 *
 * Each slot ships with a designed static fallback (original artwork, no
 * licence concerns). To replace one with photography or a screenshot, add the
 * optimized file under `public/media/` and set `photo`, with meaningful alt
 * text. Art direction and licence notes live in `public/media/README.md`.
 */
export type MediaSlotId =
  | "hero-operations-environment"
  | "mode-air"
  | "mode-sea"
  | "mode-rail"
  | "mode-road";

interface MediaSlot {
  fallback: string;
  width: number;
  height: number;
  /** Alt text for the fallback artwork; empty when the caption carries it. */
  alt: string;
  photo?: { src: string; alt: string };
}

export const mediaSlots: Record<MediaSlotId, MediaSlot> = {
  "hero-operations-environment": {
    fallback: "/media/hero-operations-environment.fallback.svg",
    width: 780,
    height: 800,
    alt: "Placeholder artwork: stacked terrain lines beneath an oxide-red sun disc.",
  },
  "mode-air": {
    fallback: "/media/mode-air.fallback.svg",
    width: 640,
    height: 480,
    alt: "",
  },
  "mode-sea": {
    fallback: "/media/mode-sea.fallback.svg",
    width: 640,
    height: 480,
    alt: "",
  },
  "mode-rail": {
    fallback: "/media/mode-rail.fallback.svg",
    width: 640,
    height: 480,
    alt: "",
  },
  "mode-road": {
    fallback: "/media/mode-road.fallback.svg",
    width: 640,
    height: 480,
    alt: "",
  },
};
