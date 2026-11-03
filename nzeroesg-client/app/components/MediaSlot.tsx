import Image from "next/image";

import { type MediaSlotId, mediaSlots } from "@/app/lib/media-slots";

/** A photograph that fills its positioned parent. */
export default function MediaSlot({
  slot,
  sizes,
  preload = false,
  className = "",
}: {
  slot: MediaSlotId;
  sizes: string;
  /** Preload the image: for the one above-the-fold image per page. */
  preload?: boolean;
  className?: string;
}) {
  const media = mediaSlots[slot];
  return (
    <Image
      src={media.src}
      alt={media.alt}
      fill
      sizes={sizes}
      quality={60}
      preload={preload}
      loading={preload ? undefined : "lazy"}
      style={{ objectPosition: media.position }}
      className={`object-cover ${className}`}
    />
  );
}
