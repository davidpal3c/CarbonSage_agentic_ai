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
  | "env-forest"
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
  "env-forest": {
    src: "/media/env-forest.jpg",
    alt: "Shafts of light through a dark spruce forest.",
    position: "50% 40%",
  },
  "mode-air": {
    src: "/media/freight-air.jpg",
    alt: "Runways and taxiways of a regional airport below a mountain range.",
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
    alt: "A two-lane road curving through green hills.",
    position: "50% 50%",
  },
};

/**
 * Photographs under a licence that asks for attribution. Shown in the site
 * footer; the public-domain and CC0 images are credited in
 * public/media/README.md only.
 */
export const photoCredits = [
  {
    subject: "Runway, mode: air",
    title: "Palm Springs International Airport",
    author: "Don Ramey Logan",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    source:
      "https://commons.wikimedia.org/wiki/File:Palm_Springs_International_Airport_photo_Don_Ramey_Logan.jpg",
  },
  {
    subject: "Road, mode: road",
    title: "A591 road, Lake District",
    author: "Diliff",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    source:
      "https://commons.wikimedia.org/wiki/File:A591_road,_Lake_District_-_June_2009_Edit_1.jpg",
  },
  {
    subject: "Forest",
    title: "Bois Raquet, in the High Fens, Eifel Nature Park",
    author: "Trougnouf (Benoit Brummer)",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    source:
      "https://commons.wikimedia.org/wiki/File:Bois_Raquet,_in_the_High_Fens_%E2%80%93_Eifel_Nature_Park_(DSCF6655).jpg",
  },
] as const;
