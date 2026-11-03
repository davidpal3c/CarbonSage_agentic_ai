/**
 * The CarbonSage mark: a CO₂ molecule reduced to three nodes and two bonds.
 * The oxygen on the left is the origin (sage), the carbon in the middle is the
 * calculation (ink), and the second bond steps up to the final oxygen the way
 * the evidence trail does on the public site: input, calculation, evidence.
 * Original artwork; nothing is derived from a molecule model or a stock icon.
 */
export default function BrandMark({
  className = "h-7 w-7",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={`text-brand-primary ${className}`}
    >
      {/* Bonds: straight to the carbon, then a stepped line to the end node. */}
      <path d="M8 21.5h4" stroke="currentColor" strokeWidth="2" />
      <path d="M20.5 21.5h3.5v-11h2" stroke="currentColor" strokeWidth="2" />
      <circle cx="5.5" cy="21.5" r="3.3" fill="var(--brand-secondary)" />
      <circle cx="16" cy="21.5" r="4.6" fill="currentColor" />
      <circle cx="28" cy="10.5" r="3.3" fill="var(--brand-secondary)" />
    </svg>
  );
}
