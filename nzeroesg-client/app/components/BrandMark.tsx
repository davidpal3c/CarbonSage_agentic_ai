/** A stepped line from an origin node to an evidence node: a trail. */
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
      <path d="M5 23h8v-7h14" stroke="currentColor" strokeWidth="1.75" />
      <rect
        x="2.5"
        y="20.5"
        width="5"
        height="5"
        fill="var(--brand-secondary)"
      />
      <rect x="24.5" y="13.5" width="5" height="5" fill="currentColor" />
    </svg>
  );
}
