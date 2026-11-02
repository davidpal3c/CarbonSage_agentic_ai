import MediaSlot from "@/app/components/MediaSlot";
import {
  PLATE_HEIGHT,
  PLATE_WIDTH,
  trailNodes,
  trailPath,
} from "@/app/lib/evidence-trail";

/**
 * The hero image field with the evidence trail drawn over it. The trail is an
 * overlay, not part of the artwork, so photography can replace the image
 * slot without losing it. Nodes number the legend beside the headline.
 */
export default function HeroPlate() {
  const d = trailPath();
  return (
    <div>
      <div
        className="relative overflow-hidden bg-secondary-bg"
        style={{ aspectRatio: `${PLATE_WIDTH} / ${PLATE_HEIGHT}` }}
      >
        <MediaSlot
          slot="hero-operations-environment"
          preload
          sizes="(min-width: 1024px) 55vw, 100vw"
        />
        <svg
          viewBox={`0 0 ${PLATE_WIDTH} ${PLATE_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
          fill="none"
        >
          {/* Light underlay keeps the line legible over any future photograph. */}
          <path
            d={d}
            stroke="#f3eee5"
            strokeWidth="8"
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="trail-path"
            d={d}
            pathLength={1}
            stroke="#202326"
            strokeWidth="3.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {trailNodes.map(([x, y], index) => (
          <span
            key={index}
            aria-hidden="true"
            className="trail-node absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center border-2 border-[#f3eee5] bg-[#202326] font-mono text-[12px] font-medium leading-none text-[#f3eee5] sm:h-[26px] sm:w-[26px]"
            style={
              {
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                "--i": index,
              } as React.CSSProperties
            }
          >
            {index + 1}
          </span>
        ))}
      </div>
      <p className="label-mono border-t-[1.5px] border-foreground bg-background px-4 py-2.5 text-[11px] leading-snug tracking-[0.08em] text-muted-foreground max-sm:min-h-[3.25rem]">
        Plate 01 · Designed placeholder — final photography replaces this field
      </p>
    </div>
  );
}
