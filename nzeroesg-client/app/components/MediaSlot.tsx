import Image from "next/image";

import { type MediaSlotId, mediaSlots } from "@/app/lib/media-slots";

export default function MediaSlot({
  slot,
  sizes,
  preload = false,
  eager = false,
  className = "",
}: {
  slot: MediaSlotId;
  sizes: string;
  preload?: boolean;
  /** Above-the-fold image that is not preloaded (for example, desktop-only). */
  eager?: boolean;
  className?: string;
}) {
  const media = mediaSlots[slot];
  return (
    <Image
      src={media.photo?.src ?? media.fallback}
      alt={media.photo?.alt ?? media.alt}
      width={media.width}
      height={media.height}
      sizes={sizes}
      preload={preload}
      loading={eager ? "eager" : undefined}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}
