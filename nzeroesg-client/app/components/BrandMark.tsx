/** A surveyed line between two evidence nodes inside a registration frame. */
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
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <path d="M8 24h7v-8h9" stroke="currentColor" strokeWidth="2.4" />
      <rect x="5.5" y="21.5" width="5" height="5" fill="var(--tertiary)" />
      <rect x="21.5" y="13.5" width="5" height="5" fill="currentColor" />
    </svg>
  );
}
