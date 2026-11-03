/**
 * Public-site photography. Everything is stored locally under public/media/
 * and sized for responsive delivery through next/image; nothing is hotlinked.
 * Sources and licences for each file are recorded in public/media/README.md.
 * These are temporary, representative images: to replace one, add the file
 * and change `src`, `alt` and `position`, keeping the same art direction
 * (text-safe areas, see README).
 */
export type MediaSlotId =
  | "hero-terminal-night"
  | "mode-air"
  | "mode-sea"
  | "mode-rail"
  | "mode-road";

interface MediaSlot {
  src: string;
  alt: string;
  /** CSS object-position: keeps the subject clear of the text-safe area. */
  position: string;
}

export const mediaSlots: Record<MediaSlotId, MediaSlot> = {
  "hero-terminal-night": {
    src: "/media/hero-terminal-night.jpg",
    alt: "Night aerial view of a freight terminal: stacked containers, trucks and rail lines under floodlights.",
    position: "50% 38%",
  },
  "mode-air": {
    src: "/media/freight-air.jpg",
    alt: "A large cargo aircraft on a wet apron at night with its landing lights on.",
    position: "50% 55%",
  },
  "mode-sea": {
    src: "/media/freight-sea.jpg",
    alt: "Aerial view of a container port, with ships alongside quay cranes and stacked containers.",
    position: "50% 50%",
  },
  "mode-rail": {
    src: "/media/freight-rail.jpg",
    alt: "A freight train on a straight track through desert scrub, with a wind farm on the ridge beyond.",
    position: "50% 60%",
  },
  "mode-road": {
    src: "/media/freight-road.jpg",
    alt: "A container truck on a busy road beside a port area.",
    position: "30% 50%",
  },
};
